import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Price Simulation ─────────────────────────────────────────────────

interface SimDay {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function generateHistoricalData(symbol: string, days: number, seed: number): SimDay[] {
  const basePrices: Record<string, number> = {
    RELIANCE: 2450, HDFCBANK: 1680, TCS: 3850, INFY: 1520,
    ICICIBANK: 1050, SBIN: 780, ITC: 440, BAJFINANCE: 6800,
  };
  let price = basePrices[symbol] || 1500;

  // Simple seeded random for reproducibility
  let s = seed + symbol.charCodeAt(0) * 1000;
  const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

  const data: SimDay[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends

    const dailyReturn = (rand() - 0.48) * 0.035; // slight upward bias
    const volatility = 0.008 + rand() * 0.015;

    const open = price;
    const close = price * (1 + dailyReturn);
    const high = Math.max(open, close) * (1 + volatility * rand());
    const low = Math.min(open, close) * (1 - volatility * rand());

    data.push({
      date: d.toISOString().split("T")[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    });

    price = close;
  }
  return data;
}

// ── Indicators ───────────────────────────────────────────────────────

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// ── Backtest Engine ──────────────────────────────────────────────────

interface BacktestConfig {
  symbols: string[];
  capital: number;
  maxRiskPct: number;
  maxDailyLossPct: number;
  aggressiveness: string;
  durationDays: number;
  seed?: number;
}

interface BacktestTrade {
  date: string;
  symbol: string;
  action: string;
  entryPrice: number;
  strikePrice: number;
  exitPrice: number | null;
  exitDate: string | null;
  pnl: number;
  premium: number;
  quantity: number;
  rsi: number;
  emaCloud: string;
}

interface DailyEquity {
  date: string;
  equity: number;
  dailyPnl: number;
}

function runBacktest(config: BacktestConfig) {
  const { symbols, capital, maxRiskPct, maxDailyLossPct, durationDays, aggressiveness } = config;
  const seed = config.seed || 42;

  // Generate data for all symbols
  const allData: Record<string, SimDay[]> = {};
  for (const sym of symbols) {
    allData[sym] = generateHistoricalData(sym, durationDays, seed);
  }

  // Get all unique trading dates
  const allDates = [...new Set(Object.values(allData).flatMap(d => d.map(x => x.date)))].sort();

  let equity = capital;
  const trades: BacktestTrade[] = [];
  const equityCurve: DailyEquity[] = [];
  const openPositions: Map<string, BacktestTrade> = new Map();

  // Risk multiplier based on aggressiveness
  const riskMult = aggressiveness === "Aggressive" ? 1.5 : aggressiveness === "Conservative" ? 0.6 : 1.0;
  const maxTradeRisk = (capital * maxRiskPct * riskMult) / 100;

  let totalWins = 0, totalLosses = 0;
  let maxDrawdown = 0, peakEquity = capital;

  for (const date of allDates) {
    let dailyPnl = 0;
    const maxDailyLoss = (equity * maxDailyLossPct) / 100;

    // Check existing positions for expiry (every 5 trading days ~ 1 week)
    for (const [key, pos] of openPositions) {
      const symData = allData[pos.symbol];
      const dayData = symData.find(d => d.date === date);
      if (!dayData) continue;

      const daysSinceEntry = allDates.indexOf(date) - allDates.indexOf(pos.date);

      // Options expire after ~5 trading days
      if (daysSinceEntry >= 5) {
        let pnl = 0;
        if (pos.action === "SELL_PUT") {
          if (dayData.close < pos.strikePrice) {
            // Assigned: bought stock at strike, current price is lower
            pnl = (dayData.close - pos.strikePrice) * pos.quantity + pos.premium;
          } else {
            // Expired worthless — keep premium
            pnl = pos.premium;
          }
        } else if (pos.action === "SELL_CALL") {
          if (dayData.close > pos.strikePrice) {
            // Assigned: must sell at strike
            pnl = (pos.strikePrice - pos.entryPrice) * pos.quantity + pos.premium;
          } else {
            pnl = pos.premium;
          }
        }

        pos.exitPrice = dayData.close;
        pos.exitDate = date;
        pos.pnl = Math.round(pnl);
        dailyPnl += pnl;
        if (pnl > 0) totalWins++; else totalLosses++;
        openPositions.delete(key);
      }

      // Stop-loss check
      if (openPositions.has(key)) {
        let unrealized = 0;
        if (pos.action === "SELL_PUT" && dayData.close < pos.strikePrice) {
          unrealized = (dayData.close - pos.strikePrice) * pos.quantity;
        }
        if (unrealized < -maxTradeRisk) {
          pos.exitPrice = dayData.close;
          pos.exitDate = date;
          pos.pnl = Math.round(unrealized + pos.premium);
          dailyPnl += pos.pnl;
          totalLosses++;
          openPositions.delete(key);
        }
      }
    }

    // Skip new trades if daily loss exceeded
    if (dailyPnl < -maxDailyLoss) {
      equity += dailyPnl;
      equityCurve.push({ date, equity: Math.round(equity), dailyPnl: Math.round(dailyPnl) });
      continue;
    }

    // Scan for new opportunities
    for (const sym of symbols) {
      if (openPositions.has(sym)) continue; // already have position

      const symData = allData[sym];
      const idx = symData.findIndex(d => d.date === date);
      if (idx < 21) continue; // need enough data for indicators

      const closePrices = symData.slice(0, idx + 1).map(d => d.close);
      const rsi = calcRSI(closePrices);
      const ema9 = calcEMA(closePrices, 9);
      const ema21 = calcEMA(closePrices, 21);
      const lastEma9 = ema9[ema9.length - 1];
      const lastEma21 = ema21[ema21.length - 1];
      const emaCloud = lastEma9 > lastEma21 ? "BULLISH" : "BEARISH";
      const currentPrice = closePrices[closePrices.length - 1];

      // Wheel strategy logic
      if (emaCloud === "BULLISH" && rsi < 65 && rsi > 30) {
        // SELL PUT
        const strikePrice = Math.round(currentPrice * 0.97);
        const premium = Math.round(currentPrice * 0.015 * (rsi > 50 ? 1.2 : 0.8) * riskMult);
        const quantity = Math.max(1, Math.floor(maxTradeRisk / (currentPrice * 0.03)));

        const trade: BacktestTrade = {
          date, symbol: sym, action: "SELL_PUT",
          entryPrice: currentPrice, strikePrice,
          exitPrice: null, exitDate: null,
          pnl: 0, premium: premium * quantity,
          quantity, rsi: Math.round(rsi * 10) / 10, emaCloud,
        };
        openPositions.set(sym, trade);
        trades.push(trade);
      } else if (emaCloud === "BEARISH" && rsi > 60) {
        // SELL CALL (covered call scenario)
        const strikePrice = Math.round(currentPrice * 1.03);
        const premium = Math.round(currentPrice * 0.012 * riskMult);
        const quantity = Math.max(1, Math.floor(maxTradeRisk / (currentPrice * 0.03)));

        const trade: BacktestTrade = {
          date, symbol: sym, action: "SELL_CALL",
          entryPrice: currentPrice, strikePrice,
          exitPrice: null, exitDate: null,
          pnl: 0, premium: premium * quantity,
          quantity, rsi: Math.round(rsi * 10) / 10, emaCloud,
        };
        openPositions.set(sym, trade);
        trades.push(trade);
      }
    }

    equity += dailyPnl;
    peakEquity = Math.max(peakEquity, equity);
    const drawdown = ((peakEquity - equity) / peakEquity) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    equityCurve.push({ date, equity: Math.round(equity), dailyPnl: Math.round(dailyPnl) });
  }

  // Close remaining open positions at last price
  for (const [, pos] of openPositions) {
    const symData = allData[pos.symbol];
    const lastDay = symData[symData.length - 1];
    pos.exitPrice = lastDay.close;
    pos.exitDate = lastDay.date;
    let pnl = pos.premium;
    if (pos.action === "SELL_PUT" && lastDay.close < pos.strikePrice) {
      pnl += (lastDay.close - pos.strikePrice) * pos.quantity;
    }
    pos.pnl = Math.round(pnl);
    if (pnl > 0) totalWins++; else totalLosses++;
  }

  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
  const returnPct = (totalPnl / capital) * 100;
  const avgTradeReturn = totalTrades > 0 ? totalPnl / totalTrades : 0;

  // Sharpe ratio approximation (annualized)
  const dailyReturns = equityCurve.map(e => e.dailyPnl / capital);
  const avgDailyReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const stdDev = Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgDailyReturn) ** 2, 0) / dailyReturns.length);
  const sharpeRatio = stdDev > 0 ? (avgDailyReturn / stdDev) * Math.sqrt(252) : 0;

  return {
    summary: {
      totalPnl: Math.round(totalPnl),
      returnPct: Math.round(returnPct * 100) / 100,
      totalTrades,
      winRate: Math.round(winRate * 10) / 10,
      wins: totalWins,
      losses: totalLosses,
      maxDrawdownPct: Math.round(maxDrawdown * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      avgTradeReturn: Math.round(avgTradeReturn),
      startingCapital: capital,
      endingCapital: Math.round(capital + totalPnl),
    },
    trades: trades.slice(0, 200), // cap for response size
    equityCurve: equityCurve.filter((_, i) => i % Math.max(1, Math.floor(equityCurve.length / 200)) === 0), // downsample
  };
}

// ── Server ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const config: BacktestConfig = {
      symbols: body.symbols || ["RELIANCE", "HDFCBANK", "TCS", "INFY", "ICICIBANK"],
      capital: body.capital || 500000,
      maxRiskPct: body.maxRiskPct || 1.0,
      maxDailyLossPct: body.maxDailyLossPct || 1.5,
      aggressiveness: body.aggressiveness || "Balanced",
      durationDays: Math.min(body.durationDays || 180, 365),
      seed: body.seed,
    };

    const result = runBacktest(config);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
