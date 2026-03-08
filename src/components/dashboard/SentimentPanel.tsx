import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Newspaper } from 'lucide-react';

interface SentimentData {
  symbol: string;
  sentiment: string;
  score: number;
  timestamp: string;
}

export default function SentimentPanel({ userId, approvedStocks }: { userId: string; approvedStocks: string[] }) {
  const [sentiments, setSentiments] = useState<SentimentData[]>([]);

  useEffect(() => {
    if (!userId || approvedStocks.length === 0) return;

    const fetchSentiments = async () => {
      const { data } = await supabase
        .from('bot_logs')
        .select('message, metadata, created_at')
        .eq('user_id', userId)
        .eq('log_type', 'SENTIMENT')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!data) return;

      const latest = new Map<string, SentimentData>();
      for (const log of data) {
        const meta = log.metadata as any;
        if (meta?.symbol && !latest.has(meta.symbol)) {
          latest.set(meta.symbol, {
            symbol: meta.symbol,
            sentiment: meta.sentiment ?? 'NEUTRAL',
            score: meta.score ?? 0.5,
            timestamp: log.created_at,
          });
        }
      }

      // Fill missing stocks
      for (const stock of approvedStocks) {
        if (!latest.has(stock)) {
          latest.set(stock, { symbol: stock, sentiment: 'NO_DATA', score: 0, timestamp: '' });
        }
      }

      setSentiments(
        Array.from(latest.values()).sort((a, b) => {
          const order = approvedStocks.indexOf(a.symbol) - approvedStocks.indexOf(b.symbol);
          return order !== 0 ? order : 0;
        })
      );
    };

    fetchSentiments();

    const channel = supabase
      .channel('sentiment-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bot_logs',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as any;
        if (row.log_type === 'SENTIMENT' && row.metadata?.symbol) {
          setSentiments(prev => {
            const updated = prev.map(s =>
              s.symbol === row.metadata.symbol
                ? { symbol: row.metadata.symbol, sentiment: row.metadata.sentiment, score: row.metadata.score, timestamp: row.created_at }
                : s
            );
            return updated;
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, approvedStocks]);

  if (sentiments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <Newspaper className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No sentiment data yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
      {sentiments.map(s => {
        const isBullish = s.sentiment === 'BULLISH';
        const isBearish = s.sentiment === 'BEARISH';
        const noData = s.sentiment === 'NO_DATA';
        const Icon = isBullish ? TrendingUp : isBearish ? TrendingDown : Minus;

        return (
          <div
            key={s.symbol}
            className={cn(
              'rounded-lg border p-3 bg-card text-center transition-all',
              isBullish && 'border-profit/30',
              isBearish && 'border-loss/30',
              !isBullish && !isBearish && 'border-border'
            )}
          >
            <p className="font-mono text-xs font-semibold truncate">{s.symbol}</p>
            <div className="flex items-center justify-center gap-1 mt-1.5">
              <Icon
                className={cn(
                  'h-3.5 w-3.5',
                  isBullish && 'text-profit',
                  isBearish && 'text-loss',
                  !isBullish && !isBearish && 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-xs font-semibold',
                  isBullish && 'text-profit',
                  isBearish && 'text-loss',
                  !isBullish && !isBearish && 'text-muted-foreground'
                )}
              >
                {noData ? '—' : (s.score * 100).toFixed(0) + '%'}
              </span>
            </div>
            <p className={cn(
              'text-[10px] mt-1',
              isBullish && 'text-profit',
              isBearish && 'text-loss',
              !isBullish && !isBearish && 'text-muted-foreground'
            )}>
              {noData ? 'No data' : s.sentiment}
            </p>
          </div>
        );
      })}
    </div>
  );
}
