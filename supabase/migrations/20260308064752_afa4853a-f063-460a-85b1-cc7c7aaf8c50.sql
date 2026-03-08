
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Bot settings (owner-only, single row)
CREATE TABLE public.bot_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_api_key TEXT,
  broker_api_secret TEXT,
  broker_request_token TEXT,
  broker_access_token TEXT,
  broker_access_token_expires_at TIMESTAMP WITH TIME ZONE,
  allocated_capital NUMERIC NOT NULL DEFAULT 500000,
  max_daily_loss_pct NUMERIC NOT NULL DEFAULT 1.5,
  max_risk_per_trade_pct NUMERIC NOT NULL DEFAULT 1.0,
  approved_stocks TEXT[] NOT NULL DEFAULT ARRAY['RELIANCE','HDFCBANK','TCS','INFY','ICICIBANK','SBIN','ITC'],
  aggressiveness TEXT NOT NULL DEFAULT 'Balanced' CHECK (aggressiveness IN ('Conservative','Balanced','Aggressive')),
  bot_enabled BOOLEAN NOT NULL DEFAULT false,
  emergency_stop BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON public.bot_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_bot_settings_updated_at BEFORE UPDATE ON public.bot_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trades log
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('SELL_PUT','SELL_CALL','BUY_SHARES','SELL_SHARES')),
  strike_price NUMERIC,
  premium NUMERIC,
  quantity INTEGER NOT NULL DEFAULT 1,
  expiry_date DATE,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','ASSIGNED','EXPIRED','CANCELLED')),
  pnl NUMERIC,
  broker_order_id TEXT,
  ai_reasoning TEXT,
  ema_cloud_status TEXT,
  rsi_value NUMERIC,
  news_sentiment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own trades" ON public.trades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Daily P&L
CREATE TABLE public.daily_pnl (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  realized_pnl NUMERIC NOT NULL DEFAULT 0,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  capital_used NUMERIC NOT NULL DEFAULT 0,
  max_loss_remaining NUMERIC NOT NULL DEFAULT 0,
  trades_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_pnl ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own daily_pnl" ON public.daily_pnl FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bot activity log
CREATE TABLE public.bot_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL CHECK (log_type IN ('INFO','TRADE','WARNING','ERROR','AI_DECISION')),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own logs" ON public.bot_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert logs" ON public.bot_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE trades;
ALTER PUBLICATION supabase_realtime ADD TABLE bot_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_pnl;
