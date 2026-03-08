import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Check if current time is within Indian market hours (9:15 AM – 3:20 PM IST, Mon-Fri) */
function isMarketOpen(): boolean {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);

  const day = ist.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  const minutes = ist.getHours() * 60 + ist.getMinutes();
  const marketOpen = 9 * 60 + 15;  // 9:15
  const marketClose = 15 * 60 + 20; // 15:20
  return minutes >= marketOpen && minutes <= marketClose;
}

// ── Technical Indicators ─────────────────────────────────────────────

/** Exponential Moving Average */
function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

/** RSI (Relative Strength Index) – classic 14-period */
function calcRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50; // neutral fallback

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** EMA Cloud status: bullish when short EMA > long EMA */
function emaCloudStatus(prices: number[]): { status: string; shortEma: number; longEma: number } {
  const shortEma = calcEMA(prices, 9);
  const longEma = calcEMA(prices, 21);
  const lastShort = shortEma[shortEma.length - 1];
  const lastLong = longEma[longEma.length - 1];
  return {
    status: lastShort > lastLong ? "BULLISH" : "BEARISH",
    shortEma: Math.round(lastShort * 100) / 100,
    longEma: Math.round(lastLong * 100) / 100,
  };
}

// ── Market Data (Kite Connect) ───────────────────────────────────────

interface KiteOHLC {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Fetch historical candle data from Kite Connect */
async function fetchKiteHistorical(
  symbol: string,
  accessToken: string,
  apiKey: string,
): Promise<number[] | null> {
  try {
    // Kite instrument token lookup (NSE equity)
    const searchUrl = `https://api.kite.trade/instruments/NSE`;
    const instrumentsResp = await fetch(searchUrl, {
      headers: { Authorization: `token ${apiKey}:${accessToken}` },
    });

    if (!instrumentsResp.ok) {
      console.error(`Kite instruments fetch failed: ${instrumentsResp.status}`);
      await instrumentsResp.text();
      return null;
    }

    const csvText = await instrumentsResp.text();
    // Parse CSV to find instrument token for the symbol
    const lines = csvText.split("\n");
    let instrumentToken = "";
    for (const line of lines) {
      const cols = line.split(",");
      if (cols[2]?.replace(/"/g, "") === symbol && cols[11]?.replace(/"/g, "") === "NSE") {
        instrumentToken = cols[0].replace(/"/g, "");
        break;
      }
    }

    if (!instrumentToken) {
      console.error(`Instrument token not found for ${symbol}`);
      return null;
    }

    // Fetch 30-day historical data (15-min candles)
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const histUrl = `https://api.kite.trade/instruments/historical/${instrumentToken}/15minute?from=${fmt(from)}&to=${fmt(to)}`;
    const histResp = await fetch(histUrl, {
      headers: { Authorization: `token ${apiKey}:${accessToken}` },
    });

    if (!histResp.ok) {
      console.error(`Kite historical fetch failed: ${histResp.status}`);
      await histResp.text();
      return null;
    }

    const histData = await histResp.json();
    const candles = histData?.data?.candles;
    if (!candles || candles.length === 0) return null;

    // Return close prices
    return candles.map((c: any[]) => c[4]);
  } catch (err) {
    console.error(`Error fetching Kite data for ${symbol}:`, err);
    return null;
  }
}

/** Fetch current LTP from Kite */
async function fetchKiteLTP(
  symbol: string,
  accessToken: string,
  apiKey: string,
): Promise<number | null> {
  try {
    const url = `https://api.kite.trade/quote/ltp?i=NSE:${symbol}`;
    const resp = await fetch(url, {
      headers: { Authorization: `token ${apiKey}:${accessToken}` },
    });
    if (!resp.ok) {
      await resp.text();
      return null;
    }
    const data = await resp.json();
    return data?.data?.[`NSE:${symbol}`]?.last_price ?? null;
  } catch {
    return null;
  }
}

// ── Kite Order Placement ─────────────────────────────────────────────

interface KiteOrderParams {
  tradingsymbol: string;
  exchange: string;
  transaction_type: "BUY" | "SELL";
  order_type: "MARKET" | "LIMIT";
  product: "MIS" | "CNC" | "NRML";
  quantity: number;
  price?: number;
  trigger_price?: number;
  validity?: "DAY" | "IOC";
  tag?: string;
}

interface KiteOrderResult {
  success: boolean;
  orderId: string | null;
  error: string | null;
}

/** Place an order on Kite Connect */
async function placeKiteOrder(
  params: KiteOrderParams,
  accessToken: string,
  apiKey: string,
): Promise<KiteOrderResult> {
  try {
    const body = new URLSearchParams();
    body.append("tradingsymbol", params.tradingsymbol);
    body.append("exchange", params.exchange);
    body.append("transaction_type", params.transaction_type);
    body.append("order_type", params.order_type);
    body.append("product", params.product);
    body.append("quantity", String(params.quantity));
    if (params.price) body.append("price", String(params.price));
    if (params.trigger_price) body.append("trigger_price", String(params.trigger_price));
    body.append("validity", params.validity || "DAY");
    if (params.tag) body.append("tag", params.tag);

    const resp = await fetch("https://api.kite.trade/orders/regular", {
      method: "POST",
      headers: {
        Authorization: `token ${apiKey}:${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await resp.json();
    if (resp.ok && data?.data?.order_id) {
      return { success: true, orderId: data.data.order_id, error: null };
    }
    return { success: false, orderId: null, error: data?.message || `HTTP ${resp.status}` };
  } catch (err) {
    return { success: false, orderId: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Build Kite trading symbol for options (e.g., RELIANCE2560320PE) */
function buildOptionSymbol(symbol: string, strikePrice: number, optionType: "PE" | "CE"): string {
  const now = new Date();
  // Find nearest Thursday (weekly expiry)
  const dayOfWeek = now.getDay();
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7;
  const expiry = new Date(now.getTime() + daysUntilThursday * 24 * 60 * 60 * 1000);
  const yy = String(expiry.getFullYear()).slice(-2);
  const mmm = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][expiry.getMonth()];
  const dd = String(expiry.getDate()).padStart(2, "0");
  const roundedStrike = Math.round(strikePrice);
  return `${symbol}${yy}${mmm}${dd}${roundedStrike}${optionType}`;
}

/** Standard NSE lot sizes for common stocks */
const NSE_LOT_SIZES: Record<string, number> = {
  RELIANCE: 250, HDFCBANK: 550, TCS: 175, INFY: 400,
  ICICIBANK: 700, SBIN: 1500, ITC: 1600, BAJFINANCE: 125,
  TATAMOTORS: 1400, AXISBANK: 900, KOTAKBANK: 400,
  WIPRO: 1500, MARUTI: 100, HCLTECH: 350, LT: 300,
};

function getLotSize(symbol: string): number {
  return NSE_LOT_SIZES[symbol] || 1;
}

/** Execute a trade decision via Kite Connect */
async function executeKiteOrder(
  decision: AIDecision,
  analysis: StockAnalysis,
  accessToken: string,
  apiKey: string,
  settings: any,
): Promise<KiteOrderResult> {
  const lotSize = getLotSize(decision.symbol);
  const quantity = decision.quantity || lotSize;

  // Capital check
  const maxRiskAmount = (settings.allocated_capital * settings.max_risk_per_trade_pct) / 100;

  switch (decision.action) {
    case "SELL_PUT": {
      const strike = decision.strikePrice || Math.round(analysis.currentPrice * 0.97);
      const tradingsymbol = buildOptionSymbol(decision.symbol, strike, "PE");
      return placeKiteOrder({
        tradingsymbol,
        exchange: "NFO",
        transaction_type: "SELL",
        order_type: "MARKET",
        product: "NRML",
        quantity,
        tag: "IAW_SP",
      }, accessToken, apiKey);
    }
    case "SELL_CALL": {
      const strike = decision.strikePrice || Math.round(analysis.currentPrice * 1.03);
      const tradingsymbol = buildOptionSymbol(decision.symbol, strike, "CE");
      return placeKiteOrder({
        tradingsymbol,
        exchange: "NFO",
        transaction_type: "SELL",
        order_type: "MARKET",
        product: "NRML",
        quantity,
        tag: "IAW_SC",
      }, accessToken, apiKey);
    }
    case "BUY_STOCK": {
      return placeKiteOrder({
        tradingsymbol: decision.symbol,
        exchange: "NSE",
        transaction_type: "BUY",
        order_type: "MARKET",
        product: "CNC",
        quantity,
        tag: "IAW_BUY",
      }, accessToken, apiKey);
    }
    case "CLOSE": {
      // For close, we need to determine if it's an option or equity position
      // Default: buy back the option (assuming short option)
      const strike = decision.strikePrice || Math.round(analysis.currentPrice);
      // Try CE first, could be PE — the AI reasoning should guide this
      const isCall = decision.reasoning?.toLowerCase().includes("call");
      const optionType = isCall ? "CE" : "PE";
      const tradingsymbol = buildOptionSymbol(decision.symbol, strike, optionType);
      return placeKiteOrder({
        tradingsymbol,
        exchange: "NFO",
        transaction_type: "BUY",
        order_type: "MARKET",
        product: "NRML",
        quantity,
        tag: "IAW_CLS",
      }, accessToken, apiKey);
    }
    default:
      return { success: false, orderId: null, error: `Unknown action: ${decision.action}` };
  }
  }
}

// ── AI Decision Engine ───────────────────────────────────────────────

interface StockAnalysis {
  symbol: string;
  currentPrice: number;
  rsi: number;
  emaCloud: string;
  shortEma: number;
  longEma: number;
}

interface AIDecision {
  action: "SELL_PUT" | "SELL_CALL" | "BUY_STOCK" | "HOLD" | "CLOSE";
  symbol: string;
  reasoning: string;
  strikePrice?: number;
  quantity?: number;
  confidence: number;
}

async function getAIDecision(
  analyses: StockAnalysis[],
  settings: any,
  openPositions: any[],
): Promise<AIDecision[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = `You are IndiAutoWheel, an autonomous options wheel strategy bot for Indian equity markets (NSE).

WHEEL STRATEGY RULES:
1. SELL PUT: When stock is bullish (EMA Cloud BULLISH) and RSI < 65 (not overbought). Choose OTM strike ~2-5% below current price.
2. If PUT is assigned (stock bought), SELL COVERED CALL at strike ~2-5% above cost basis.
3. If CALL is assigned (stock sold), go back to step 1.
4. HOLD: When signals are mixed or RSI is in no-man's land (45-55).
5. CLOSE: Exit a position if stop-loss is hit or conditions drastically change.

RISK PARAMETERS:
- Allocated Capital: ₹${settings.allocated_capital}
- Max Daily Loss: ${settings.max_daily_loss_pct}%
- Max Risk Per Trade: ${settings.max_risk_per_trade_pct}%
- Aggressiveness: ${settings.aggressiveness}
- Lot sizes: NIFTY=25, BANKNIFTY=15, stocks vary (use standard NSE lot sizes)

CURRENT OPEN POSITIONS:
${openPositions.length > 0 ? JSON.stringify(openPositions, null, 2) : "None"}

Respond ONLY with valid JSON. Return an array of trade decisions.`;

  const userPrompt = `Market analysis at ${new Date().toISOString()}:

${analyses.map((a) => `${a.symbol}: Price ₹${a.currentPrice}, RSI ${a.rsi.toFixed(1)}, EMA Cloud ${a.emaCloud} (Short EMA ${a.shortEma}, Long EMA ${a.longEma})`).join("\n")}

Based on the wheel strategy rules and risk parameters, what trades should I make? Consider existing positions.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "submit_trade_decisions",
            description: "Submit an array of trade decisions based on market analysis",
            parameters: {
              type: "object",
              properties: {
                decisions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      action: { type: "string", enum: ["SELL_PUT", "SELL_CALL", "BUY_STOCK", "HOLD", "CLOSE"] },
                      symbol: { type: "string" },
                      reasoning: { type: "string" },
                      strikePrice: { type: "number" },
                      quantity: { type: "integer" },
                      confidence: { type: "number", minimum: 0, maximum: 1 },
                    },
                    required: ["action", "symbol", "reasoning", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["decisions"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "submit_trade_decisions" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.error("No tool call in AI response:", JSON.stringify(data));
    return [];
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  return parsed.decisions || [];
}

// ── Simulated Data (Test Mode) ───────────────────────────────────────

/** Generate realistic simulated price data for testing */
function generateSimulatedPrices(symbol: string): number[] {
  const basePrices: Record<string, number> = {
    RELIANCE: 2450, HDFCBANK: 1680, TCS: 3850, INFY: 1520,
    ICICIBANK: 1050, SBIN: 780, ITC: 440,
  };
  const base = basePrices[symbol] || 1000;
  const prices: number[] = [];
  let price = base * (0.95 + Math.random() * 0.1); // start within ±5%

  for (let i = 0; i < 100; i++) {
    // Random walk with slight upward bias
    const change = price * (Math.random() * 0.03 - 0.013);
    price = Math.max(price * 0.8, price + change);
    prices.push(Math.round(price * 100) / 100);
  }
  return prices;
}

// ── Main Engine ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Parse test mode from body
  let testMode = false;
  try {
    const body = await req.json();
    testMode = body?.test === true;
  } catch { /* no body or invalid JSON */ }

  try {
    // 1. Check market hours (skip in test mode)
    if (!testMode && !isMarketOpen()) {
      console.log("Market is closed. Skipping engine run.");
      return new Response(JSON.stringify({ status: "market_closed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (testMode) console.log("🧪 TEST MODE — market hours check bypassed, using simulated data");

    // 2. Fetch all active users with bot enabled
    const { data: activeSettings, error: settingsErr } = await supabase
      .from("bot_settings")
      .select("*")
      .eq("bot_enabled", true)
      .eq("emergency_stop", false);

    if (settingsErr) throw settingsErr;
    if (!activeSettings || activeSettings.length === 0) {
      console.log("No active bots found.");
      return new Response(JSON.stringify({ status: "no_active_bots" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    // 3. Process each user
    for (const settings of activeSettings) {
      const userId = settings.user_id;
      const apiKey = settings.broker_api_key;
      const accessToken = settings.broker_access_token;
      const useSimulated = testMode || !apiKey || !accessToken;

      // In production, skip users without broker creds
      if (!testMode && !apiKey || !testMode && !accessToken) {
        await supabase.from("bot_logs").insert({
          user_id: userId,
          log_type: "ERROR",
          message: "Broker credentials not configured. Skipping.",
        });
        continue;
      }

      // Check token expiry (skip in test/simulated mode)
      if (!useSimulated && settings.broker_access_token_expires_at) {
        const expiresAt = new Date(settings.broker_access_token_expires_at);
        if (expiresAt < new Date()) {
          await supabase.from("bot_logs").insert({
            user_id: userId,
            log_type: "ERROR",
            message: "Broker access token expired. Please reconnect Kite.",
          });
          continue;
        }
      }

      // Check daily loss limit
      const today = new Date().toISOString().split("T")[0];
      const { data: dailyPnl } = await supabase
        .from("daily_pnl")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      const maxDailyLoss = (settings.allocated_capital * settings.max_daily_loss_pct) / 100;
      if (dailyPnl && dailyPnl.total_pnl < -maxDailyLoss) {
        await supabase.from("bot_logs").insert({
          user_id: userId,
          log_type: "RISK_HALT",
          message: `Daily loss limit hit: ₹${Math.abs(dailyPnl.total_pnl).toFixed(0)} / ₹${maxDailyLoss.toFixed(0)}. Bot paused for today.`,
        });
        continue;
      }

      // Fetch open positions
      const { data: openTrades } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "OPEN");

      // Analyze each approved stock
      const analyses: StockAnalysis[] = [];
      for (const symbol of settings.approved_stocks) {
        let prices: number[] | null;
        if (useSimulated) {
          prices = generateSimulatedPrices(symbol);
          console.log(`🧪 Using simulated data for ${symbol}`);
        } else {
          prices = await fetchKiteHistorical(symbol, accessToken!, apiKey!);
        }
        if (!prices || prices.length < 30) {
          console.log(`Insufficient data for ${symbol}, skipping.`);
          continue;
        }
        const rsi = calcRSI(prices);
        const ema = emaCloudStatus(prices);
        const currentPrice = prices[prices.length - 1];

        analyses.push({
          symbol,
          currentPrice,
          rsi,
          emaCloud: ema.status,
          shortEma: ema.shortEma,
          longEma: ema.longEma,
        });
      }

      if (analyses.length === 0) {
        await supabase.from("bot_logs").insert({
          user_id: userId,
          log_type: "WARNING",
          message: "No stock data available for analysis. Check Kite connection.",
        });
        continue;
      }

      // Get AI decisions
      let decisions: AIDecision[];
      try {
        decisions = await getAIDecision(analyses, settings, openTrades || []);
      } catch (aiErr) {
        await supabase.from("bot_logs").insert({
          user_id: userId,
          log_type: "ERROR",
          message: `AI decision error: ${aiErr instanceof Error ? aiErr.message : String(aiErr)}`,
        });
        continue;
      }

      // Log AI analysis
      await supabase.from("bot_logs").insert({
        user_id: userId,
        log_type: "AI_DECISION",
        message: `Analyzed ${analyses.length} stocks. ${decisions.filter((d) => d.action !== "HOLD").length} actionable signals.`,
        metadata: { analyses, decisions },
      });

      // Execute decisions (log trades, actual order placement via Kite would go here)
      for (const decision of decisions) {
        if (decision.action === "HOLD") continue;

        const analysis = analyses.find((a) => a.symbol === decision.symbol);
        if (!analysis) continue;

        // Only execute high-confidence trades
        if (decision.confidence < 0.6) {
          await supabase.from("bot_logs").insert({
            user_id: userId,
            log_type: "SKIPPED",
            message: `${decision.action} ${decision.symbol} skipped — low confidence (${(decision.confidence * 100).toFixed(0)}%)`,
          });
          continue;
        }

        // TODO: Place actual order via Kite Connect API
        // For now, log the trade as a paper trade
        const { error: tradeErr } = await supabase.from("trades").insert({
          user_id: userId,
          symbol: decision.symbol,
          trade_type: decision.action,
          entry_price: analysis.currentPrice,
          strike_price: decision.strikePrice || null,
          quantity: decision.quantity || 1,
          rsi_value: analysis.rsi,
          ema_cloud_status: analysis.emaCloud,
          ai_reasoning: decision.reasoning,
          status: "OPEN",
        });

        if (tradeErr) {
          console.error("Trade insert error:", tradeErr);
        } else {
          await supabase.from("bot_logs").insert({
            user_id: userId,
            log_type: "TRADE_EXECUTED",
            message: `${decision.action} ${decision.symbol} @ ₹${analysis.currentPrice} | Strike: ₹${decision.strikePrice || "N/A"} | Confidence: ${(decision.confidence * 100).toFixed(0)}%`,
            metadata: { decision, analysis },
          });
        }
      }

      results.push({ userId, stocksAnalyzed: analyses.length, decisions: decisions.length });
    }

    return new Response(JSON.stringify({ status: "completed", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Trading engine error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
