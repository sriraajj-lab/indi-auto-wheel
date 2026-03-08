import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { request_token } = await req.json();

    if (!request_token || typeof request_token !== "string" || request_token.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid request_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's API key and secret from bot_settings using service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: settings, error: settingsErr } = await adminClient
      .from("bot_settings")
      .select("broker_api_key, broker_api_secret")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsErr || !settings) {
      return new Response(
        JSON.stringify({ error: "Bot settings not found. Save your API key and secret first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { broker_api_key, broker_api_secret } = settings;
    if (!broker_api_key || !broker_api_secret) {
      return new Response(
        JSON.stringify({ error: "API Key and Secret must be saved before connecting." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate checksum: SHA-256(api_key + request_token + api_secret)
    const checksumInput = broker_api_key + request_token + broker_api_secret;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(checksumInput));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksum = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Exchange request_token for access_token via Kite API
    const kiteResp = await fetch("https://api.kite.trade/session/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        api_key: broker_api_key,
        request_token: request_token,
        checksum: checksum,
      }),
    });

    const kiteData = await kiteResp.json();

    if (!kiteResp.ok || kiteData.status === "error") {
      console.error("Kite token exchange failed:", kiteData);
      return new Response(
        JSON.stringify({
          error: kiteData.message || "Token exchange failed. The request token may have expired.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = kiteData.data?.access_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "No access token returned from Kite." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Store access token with expiry (Kite tokens expire at 6 AM next day IST)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
    const tomorrow6am = new Date(istNow);
    tomorrow6am.setDate(tomorrow6am.getDate() + 1);
    tomorrow6am.setHours(6, 0, 0, 0);
    // Convert back to UTC for storage
    const expiresAtUtc = new Date(tomorrow6am.getTime() - istOffset - now.getTimezoneOffset() * 60 * 1000);

    const { error: updateErr } = await adminClient
      .from("bot_settings")
      .update({
        broker_access_token: accessToken,
        broker_request_token: request_token,
        broker_access_token_expires_at: expiresAtUtc.toISOString(),
      })
      .eq("user_id", userId);

    if (updateErr) {
      console.error("Failed to store access token:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to store access token." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Log the connection
    await adminClient.from("bot_logs").insert({
      user_id: userId,
      log_type: "BROKER_CONNECTED",
      message: `Kite Connect authenticated successfully. Token expires at ${expiresAtUtc.toISOString()}.`,
      metadata: { user_name: kiteData.data?.user_name, user_id: kiteData.data?.user_id },
    });

    return new Response(
      JSON.stringify({
        success: true,
        kite_user: kiteData.data?.user_name || kiteData.data?.user_id,
        expires_at: expiresAtUtc.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("kite-auth error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
