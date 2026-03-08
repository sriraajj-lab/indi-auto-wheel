import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Brain, TrendingUp, TrendingDown, MinusCircle, Loader2,
  ShieldCheck, Target, Clock, Zap, AlertTriangle, Newspaper
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const STOCKS = ['RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'ICICIBANK', 'SBIN', 'ITC', 'BAJFINANCE'];

interface LongTerm {
  suggestion: string;
  horizon: string;
  reasoning: string;
}

interface TradeResult {
  decision: string;
  confidence: number;
  sentiment_score: number;
  reasoning: string;
  max_risk: number;
  long_term: LongTerm;
  symbol: string;
  model: string;
}

export default function NewsAnalysisPage() {
  const { toast } = useToast();
  const [news, setNews] = useState('');
  const [symbol, setSymbol] = useState('RELIANCE');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);

  const analyze = async () => {
    if (news.trim().length < 10) {
      toast({ title: 'Too short', description: 'Paste at least a sentence of market news.', variant: 'destructive' });
      return;
    }
    if (news.trim().length > 5000) {
      toast({ title: 'Too long', description: 'News must be under 5000 characters.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-trade-decision', {
        body: { news: news.trim(), symbol },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data as TradeResult);
    } catch (err: any) {
      toast({ title: 'Analysis failed', description: err.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono">News Analysis</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Paste market news → get an AI-powered intraday trade decision + long-term outlook
        </p>
      </div>

      {/* Input Section */}
      <Card className="p-5 bg-card border-border space-y-4">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-info" />
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Market News Input</h2>
        </div>

        <Textarea
          value={news}
          onChange={e => setNews(e.target.value)}
          placeholder="Paste a news headline or paragraph here… e.g. 'Reliance Industries reports record quarterly profit, beats analyst estimates by 15%'"
          className="min-h-[120px] bg-muted/50 border-border font-mono text-sm resize-none"
          maxLength={5000}
        />

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1 max-w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">Stock</label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCKS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={analyze}
            disabled={loading || news.trim().length < 10}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {loading ? 'Analyzing…' : 'Analyze with Claude'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{news.length}/5000 characters</p>
      </Card>

      {/* Result Section */}
      {result && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          {/* Intraday Decision Hero */}
          <DecisionCard result={result} />

          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Sentiment"
              value={result.sentiment_score.toFixed(2)}
              icon={<Zap className="h-4 w-4" />}
              color={result.sentiment_score > 0.7 ? 'text-profit' : result.sentiment_score < 0.3 ? 'text-loss' : 'text-warning'}
            />
            <MetricCard
              label="Confidence"
              value={`${result.confidence}%`}
              icon={<Target className="h-4 w-4" />}
              color={result.confidence > 70 ? 'text-profit' : 'text-warning'}
            />
            <MetricCard
              label="Max Risk"
              value={`₹${result.max_risk}`}
              icon={<ShieldCheck className="h-4 w-4" />}
              color="text-info"
            />
            <MetricCard
              label="Model"
              value={result.model}
              icon={<Brain className="h-4 w-4" />}
              color="text-muted-foreground"
            />
          </div>

          {/* Reasoning */}
          <Card className="p-5 bg-card border-border">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">AI Reasoning</h3>
            <p className="text-sm leading-relaxed">{result.reasoning}</p>
          </Card>

          {/* Long-Term Outlook */}
          {result.long_term && result.long_term.suggestion !== 'NONE' && (
            <LongTermCard longTerm={result.long_term} symbol={result.symbol} />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function DecisionCard({ result }: { result: TradeResult }) {
  const config = {
    BUY: { icon: TrendingUp, color: 'text-profit', bg: 'bg-profit/10', border: 'border-profit/30', label: 'BUY' },
    SELL: { icon: TrendingDown, color: 'text-loss', bg: 'bg-loss/10', border: 'border-loss/30', label: 'SELL' },
    'NO TRADE': { icon: MinusCircle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', label: 'NO TRADE' },
  }[result.decision] || { icon: MinusCircle, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', label: result.decision };

  const Icon = config.icon;

  return (
    <Card className={`p-6 ${config.bg} border ${config.border}`}>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className={`p-4 rounded-full ${config.bg}`}>
          <Icon className={`h-10 w-10 ${config.color}`} />
        </div>
        <div className="text-center sm:text-left flex-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Intraday Decision</p>
          <h2 className={`text-3xl font-mono font-bold ${config.color}`}>{config.label}</h2>
          <p className="text-sm text-muted-foreground mt-1">{result.symbol}</p>
        </div>
        <div className="w-full sm:w-40">
          <p className="text-xs text-muted-foreground mb-1 text-center">Confidence</p>
          <Progress value={result.confidence} className="h-2" />
          <p className={`text-center text-lg font-mono font-bold mt-1 ${config.color}`}>{result.confidence}%</p>
        </div>
      </div>
    </Card>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={`text-lg font-mono font-bold ${color}`}>{value}</p>
    </Card>
  );
}

function LongTermCard({ longTerm, symbol }: { longTerm: LongTerm; symbol: string }) {
  const suggestionColor = {
    BUY: 'text-profit',
    SELL: 'text-loss',
    HOLD: 'text-warning',
  }[longTerm.suggestion] || 'text-muted-foreground';

  return (
    <Card className="p-5 bg-secondary/50 border-border">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-info" />
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Long-Term Outlook</h3>
        <Badge variant="outline" className="ml-auto text-xs">{longTerm.horizon}</Badge>
      </div>
      <div className="flex items-center gap-3">
        <Badge className={`text-sm font-mono ${suggestionColor} bg-transparent border`}>
          {longTerm.suggestion} {symbol}
        </Badge>
        <p className="text-sm text-muted-foreground flex-1">{longTerm.reasoning}</p>
      </div>
      <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
        <AlertTriangle className="h-3 w-3" />
        <span>Advisory only — not an intraday signal</span>
      </div>
    </Card>
  );
}
