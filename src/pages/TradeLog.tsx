import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Bot, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

export default function TradeLog() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('trades').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => data && setTrades(data));
  }, [user]);

  return (
    <div className="space-y-4 animate-slide-up">
      <h1 className="text-2xl font-bold font-mono">Trade Log</h1>

      {trades.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No trades yet</p>
          <p className="text-xs text-muted-foreground mt-1">Trades will appear here once the bot starts executing</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trades.map(trade => (
            <div key={trade.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <button
                className="w-full p-4 flex items-center justify-between text-left hover:bg-accent/20 transition-colors"
                onClick={() => setExpandedId(expandedId === trade.id ? null : trade.id)}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded font-mono',
                    trade.trade_type === 'SELL_PUT' ? 'bg-profit/10 text-profit' : 'bg-info/10 text-info'
                  )}>
                    {trade.trade_type.replace('_', ' ')}
                  </span>
                  <span className="font-mono font-semibold">{trade.symbol}</span>
                  <span className="text-sm text-muted-foreground font-mono">
                    ₹{trade.strike_price?.toLocaleString('en-IN') ?? '—'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'font-mono text-sm font-semibold',
                    (trade.pnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'
                  )}>
                    {trade.pnl !== null ? `₹${trade.pnl.toLocaleString('en-IN')}` : '—'}
                  </span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded',
                    trade.status === 'OPEN' ? 'bg-warning/10 text-warning' :
                    trade.status === 'CLOSED' ? 'bg-profit/10 text-profit' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {trade.status}
                  </span>
                  {expandedId === trade.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {expandedId === trade.id && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Entry</span>
                      <p className="font-mono">₹{trade.entry_price?.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Exit</span>
                      <p className="font-mono">{trade.exit_price ? `₹${trade.exit_price.toLocaleString('en-IN')}` : '—'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">RSI</span>
                      <p className="font-mono">{trade.rsi_value ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">EMA Cloud</span>
                      <p className={cn('font-mono', trade.ema_cloud_status === 'BULLISH' ? 'text-profit' : 'text-loss')}>
                        {trade.ema_cloud_status ?? '—'}
                      </p>
                    </div>
                  </div>

                  {trade.ai_reasoning && (
                    <div className="bg-muted/50 rounded-md p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <Bot className="h-3 w-3 text-info" />
                        <span className="text-xs text-info font-semibold">AI Reasoning</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{trade.ai_reasoning}</p>
                    </div>
                  )}

                  {trade.news_sentiment && (
                    <div>
                      <span className="text-xs text-muted-foreground">News Sentiment</span>
                      <p className="text-sm">{trade.news_sentiment}</p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {new Date(trade.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
