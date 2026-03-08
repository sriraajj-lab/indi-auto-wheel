import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Play, TrendingUp, TrendingDown, BarChart3, Target, Shield, Zap, Trophy, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

const DEFAULT_STOCKS = ['RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'ICICIBANK', 'SBIN', 'ITC'];

interface BacktestSummary {
  totalPnl: number;
  returnPct: number;
  totalTrades: number;
  winRate: number;
  wins: number;
  losses: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  avgTradeReturn: number;
  startingCapital: number;
  endingCapital: number;
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

interface EquityPoint {
  date: string;
  equity: number;
  dailyPnl: number;
}

export default function BacktestPage() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [config, setConfig] = useState({
    capital: 500000,
    maxRiskPct: 1.0,
    maxDailyLossPct: 1.5,
    aggressiveness: 'Balanced',
    durationDays: 180,
    symbols: DEFAULT_STOCKS,
  });
  const [results, setResults] = useState<{
    summary: BacktestSummary;
    trades: BacktestTrade[];
    equityCurve: EquityPoint[];
  } | null>(null);

  const runBacktest = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('backtest', {
        body: {
          ...config,
          seed: Math.floor(Math.random() * 100000),
        },
      });
      if (error) throw error;
      setResults(data);
      toast({ title: '✅ Backtest Complete', description: `${data.summary.totalTrades} trades simulated over ${config.durationDays} days` });
    } catch (err: any) {
      toast({ title: 'Backtest Failed', description: err.message, variant: 'destructive' });
    }
    setRunning(false);
  };

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold font-mono">Backtest</h1>
        <p className="text-sm text-muted-foreground mt-1">Simulate the wheel strategy on historical data before going live</p>
      </div>

      {/* Config */}
      <Card className="p-5 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-profit" />
          <h2 className="font-semibold">Simulation Parameters</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Capital (₹)</label>
            <Input
              type="number"
              value={config.capital}
              onChange={e => setConfig(c => ({ ...c, capital: Number(e.target.value) }))}
              className="bg-muted border-border font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Duration (days)</label>
            <Input
              type="number"
              value={config.durationDays}
              onChange={e => setConfig(c => ({ ...c, durationDays: Math.min(365, Number(e.target.value)) }))}
              className="bg-muted border-border font-mono"
              max={365}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Max Risk/Trade %</label>
            <Input
              type="number"
              value={config.maxRiskPct}
              onChange={e => setConfig(c => ({ ...c, maxRiskPct: Number(e.target.value) }))}
              className="bg-muted border-border font-mono"
              step={0.1}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Max Daily Loss %</label>
            <Input
              type="number"
              value={config.maxDailyLossPct}
              onChange={e => setConfig(c => ({ ...c, maxDailyLossPct: Number(e.target.value) }))}
              className="bg-muted border-border font-mono"
              step={0.1}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Aggressiveness</label>
            <Select value={config.aggressiveness} onValueChange={v => setConfig(c => ({ ...c, aggressiveness: v }))}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Conservative">Conservative</SelectItem>
                <SelectItem value="Balanced">Balanced</SelectItem>
                <SelectItem value="Aggressive">Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={runBacktest} disabled={running} variant="profit" className="w-full">
              <Play className="h-4 w-4 mr-2" />
              {running ? 'Running…' : 'Run Backtest'}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {config.symbols.map(s => (
            <Badge key={s} variant="secondary" className="font-mono text-xs">{s}</Badge>
          ))}
        </div>
      </Card>

      {/* Results */}
      {results && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Total Return"
              value={`${results.summary.returnPct > 0 ? '+' : ''}${results.summary.returnPct}%`}
              subValue={formatINR(results.summary.totalPnl)}
              icon={results.summary.totalPnl >= 0 ? TrendingUp : TrendingDown}
              variant={results.summary.totalPnl >= 0 ? 'profit' : 'loss'}
            />
            <SummaryCard
              label="Win Rate"
              value={`${results.summary.winRate}%`}
              subValue={`${results.summary.wins}W / ${results.summary.losses}L`}
              icon={Target}
              variant={results.summary.winRate >= 50 ? 'profit' : 'loss'}
            />
            <SummaryCard
              label="Max Drawdown"
              value={`${results.summary.maxDrawdownPct}%`}
              subValue={`Sharpe: ${results.summary.sharpeRatio}`}
              icon={Shield}
              variant={results.summary.maxDrawdownPct < 10 ? 'profit' : 'loss'}
            />
            <SummaryCard
              label="Total Trades"
              value={String(results.summary.totalTrades)}
              subValue={`Avg: ${formatINR(results.summary.avgTradeReturn)}`}
              icon={Activity}
              variant="default"
            />
          </div>

          {/* Equity Curve */}
          <Card className="p-5 bg-card border-border">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4 text-profit" />
              <h2 className="font-semibold">Equity Curve</h2>
            </div>
            <div className="h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }}
                    tickFormatter={d => d.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                    domain={['dataMin - 10000', 'dataMax + 10000']}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(220 18% 10%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [formatINR(v), 'Equity']}
                    labelFormatter={l => `Date: ${l}`}
                  />
                  <ReferenceLine y={config.capital} stroke="hsl(215 12% 50%)" strokeDasharray="5 5" label="" />
                  <Line type="monotone" dataKey="equity" stroke="hsl(142 70% 45%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Daily P&L Bars */}
          <Card className="p-5 bg-card border-border">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-profit" />
              <h2 className="font-semibold">Daily P&L</h2>
            </div>
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results.equityCurve.filter(e => e.dailyPnl !== 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }} tickFormatter={v => `₹${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(220 18% 10%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [formatINR(v), 'P&L']}
                  />
                  <ReferenceLine y={0} stroke="hsl(215 12% 50%)" />
                  <Bar dataKey="dailyPnl" fill="hsl(142 70% 45%)" radius={[2, 2, 0, 0]}>
                    {results.equityCurve.filter(e => e.dailyPnl !== 0).map((entry, index) => (
                      <rect key={index} fill={entry.dailyPnl >= 0 ? 'hsl(142 70% 45%)' : 'hsl(0 72% 51%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Trade Log */}
          <Card className="p-5 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Trade Log</h2>
              <span className="text-xs text-muted-foreground">{results.trades.length} trades</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Symbol</th>
                    <th className="text-left py-2 px-2">Action</th>
                    <th className="text-right py-2 px-2">Entry</th>
                    <th className="text-right py-2 px-2">Strike</th>
                    <th className="text-right py-2 px-2">Exit</th>
                    <th className="text-right py-2 px-2">P&L</th>
                    <th className="text-right py-2 px-2 hidden sm:table-cell">RSI</th>
                    <th className="text-left py-2 px-2 hidden sm:table-cell">EMA</th>
                  </tr>
                </thead>
                <tbody>
                  {results.trades.map((t, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="py-2 px-2 whitespace-nowrap">{t.date}</td>
                      <td className="py-2 px-2">{t.symbol}</td>
                      <td className="py-2 px-2">
                        <Badge variant="secondary" className="text-[10px] font-mono">{t.action}</Badge>
                      </td>
                      <td className="py-2 px-2 text-right">₹{t.entryPrice.toFixed(0)}</td>
                      <td className="py-2 px-2 text-right">₹{t.strikePrice}</td>
                      <td className="py-2 px-2 text-right">{t.exitPrice ? `₹${t.exitPrice.toFixed(0)}` : '—'}</td>
                      <td className={`py-2 px-2 text-right font-semibold ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {t.pnl >= 0 ? '+' : ''}{formatINR(t.pnl)}
                      </td>
                      <td className="py-2 px-2 text-right hidden sm:table-cell">{t.rsi}</td>
                      <td className="py-2 px-2 hidden sm:table-cell">
                        <span className={t.emaCloud === 'BULLISH' ? 'text-profit' : 'text-loss'}>{t.emaCloud}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Sub-component ────────────────────────────────────────────────────

function SummaryCard({ label, value, subValue, icon: Icon, variant }: {
  label: string; value: string; subValue: string;
  icon: React.ElementType; variant: 'profit' | 'loss' | 'default';
}) {
  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={`h-4 w-4 ${variant === 'profit' ? 'text-profit' : variant === 'loss' ? 'text-loss' : 'text-muted-foreground'}`} />
      </div>
      <p className={`text-xl font-bold font-mono ${variant === 'profit' ? 'text-profit' : variant === 'loss' ? 'text-loss' : 'text-foreground'}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>
    </Card>
  );
}
