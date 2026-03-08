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

// ── Main Engine ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Check market hours
    if (!isMarketOpen()) {
      console.log("Market is closed. Skipping engine run.");
      return new Response(JSON.stringify({ status: "market_closed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

      // Check broker credentials
      if (!apiKey || !accessToken) {
        await supabase.from("bot_logs").insert({
          user_id: userId,
          log_type: "ERROR",
          message: "Broker credentials not configured. Skipping.",
        });
        continue;
      }

      // Check token expiry
      if (settings.broker_access_token_expires_at) {
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
        const prices = await fetchKiteHistorical(symbol, accessToken, apiKey);
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
