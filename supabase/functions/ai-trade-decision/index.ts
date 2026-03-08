import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { news, symbol } = await req.json();

    if (!news || typeof news !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'news' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a conservative Intraday Trader for the Indian Market.

Analyze the provided news for sentiment.

If sentiment is strongly positive (>0.7), suggest a Buy.

Constraint: Never risk more than 1% of the total ₹40k capital.

If the news is uncertain or 'noise,' suggest NO TRADE.

Return a JSON object with exactly these fields:
- "decision": one of "BUY", "SELL", or "NO TRADE"
- "confidence": a number from 0 to 100
- "sentiment_score": a number from 0.0 to 1.0 representing sentiment strength
- "reasoning": a concise 1-2 sentence explanation
- "max_risk": the maximum amount in ₹ you'd risk on this trade (max 1% of ₹40,000 = ₹400)

Only return the JSON object, no other text.`;

    const userPrompt = `Stock: ${symbol || "GENERAL MARKET"}

News: ${news}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          { role: "user", content: `${systemPrompt}\n\n${userPrompt}` },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";

    // Parse the JSON from Claude's response
    let tradeDecision;
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      tradeDecision = JSON.parse(jsonMatch[0]);
    } catch {
      tradeDecision = {
        decision: "SIT",
        confidence: 0,
        reasoning: "Could not parse AI response. Raw: " + content.slice(0, 200),
      };
    }

    return new Response(
      JSON.stringify({
        decision: tradeDecision.decision,
        confidence: tradeDecision.confidence,
        reasoning: tradeDecision.reasoning,
        symbol: symbol || "GENERAL",
        model: "claude-3-5-sonnet",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-trade-decision error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
