import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import StatCard from '@/components/dashboard/StatCard';
import PositionsTable from '@/components/dashboard/PositionsTable';
import BotLogFeed from '@/components/dashboard/BotLogFeed';
import DemoTour from '@/components/DemoTour';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Wallet, TrendingUp, TrendingDown, ShieldAlert,
  Activity, StopCircle, Play, Clock, HelpCircle
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [dailyPnl, setDailyPnl] = useState<any>(null);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [settingsRes, tradesRes, logsRes, pnlRes] = await Promise.all([
        supabase.from('bot_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('trades').select('*').eq('user_id', user.id).eq('status', 'OPEN').order('created_at', { ascending: false }),
        supabase.from('bot_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('daily_pnl').select('*').eq('user_id', user.id).eq('date', new Date().toISOString().split('T')[0]).maybeSingle(),
      ]);

      if (settingsRes.data) setSettings(settingsRes.data);
      if (tradesRes.data) setTrades(tradesRes.data);
      if (logsRes.data) setLogs(logsRes.data);
      if (pnlRes.data) setDailyPnl(pnlRes.data);
    };

    fetchData();

    // Realtime subscriptions
    const tradesChannel = supabase.channel('trades-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `user_id=eq.${user.id}` },
        () => { supabase.from('trades').select('*').eq('user_id', user.id).eq('status', 'OPEN').order('created_at', { ascending: false }).then(r => r.data && setTrades(r.data)); }
      ).subscribe();

    const logsChannel = supabase.channel('logs-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bot_logs', filter: `user_id=eq.${user.id}` },
        (payload) => { setLogs(prev => [payload.new as any, ...prev].slice(0, 50)); }
      ).subscribe();

    return () => {
      supabase.removeChannel(tradesChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [user]);

  const handleEmergencyStop = async () => {
    if (!user) return;
    const { error } = await supabase.from('bot_settings').update({ emergency_stop: true, bot_enabled: false }).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSettings((s: any) => s ? { ...s, emergency_stop: true, bot_enabled: false } : s);
      toast({ title: '🛑 Emergency Stop Activated', description: 'Bot halted. No new trades will be placed.' });
    }
  };

  const handleResume = async () => {
    if (!user) return;
    const { error } = await supabase.from('bot_settings').update({ emergency_stop: false, bot_enabled: true }).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSettings((s: any) => s ? { ...s, emergency_stop: false, bot_enabled: true } : s);
      toast({ title: '▶️ Bot Resumed', description: 'Trading will resume at next cycle.' });
    }
  };

  const capital = settings?.allocated_capital ?? 0;
  const todayPnl = dailyPnl?.total_pnl ?? 0;
  const maxLossRemaining = dailyPnl?.max_loss_remaining ?? (capital * (settings?.max_daily_loss_pct ?? 1.5) / 100);
  const botActive = settings?.bot_enabled && !settings?.emergency_stop;

  const isMarketHours = () => {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const h = ist.getHours();
    const m = ist.getMinutes();
    const totalMin = h * 60 + m;
    return totalMin >= 555 && totalMin <= 930; // 9:15 - 15:30
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`h-2 w-2 rounded-full ${botActive ? 'bg-profit animate-pulse-profit' : 'bg-muted-foreground'}`} />
            <span className="text-sm text-muted-foreground">
              {botActive ? 'Bot Active' : settings?.emergency_stop ? 'Emergency Stopped' : 'Bot Inactive'}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              <Clock className="h-3 w-3 inline mr-1" />
              {isMarketHours() ? 'Market Open' : 'Market Closed'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDemo(true)}
            className="gap-1 text-muted-foreground border-border hover:text-foreground"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Demo</span>
          </Button>
          {settings?.emergency_stop ? (
            <Button variant="profit" size="sm" onClick={handleResume}>
              <Play className="h-4 w-4 mr-1" />
              Resume Bot
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="danger" size="sm" disabled={!botActive}>
                  <StopCircle className="h-4 w-4 mr-1" />
                  Emergency Stop
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>🛑 Emergency Stop</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately halt all bot trading activity. No new trades will be placed until you manually resume. Are you sure?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleEmergencyStop} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Stop All Trading
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Capital"
          value={`₹${capital.toLocaleString('en-IN')}`}
          icon={Wallet}
        />
        <StatCard
          title="Today's P&L"
          value={`₹${todayPnl.toLocaleString('en-IN')}`}
          icon={todayPnl >= 0 ? TrendingUp : TrendingDown}
          variant={todayPnl > 0 ? 'profit' : todayPnl < 0 ? 'loss' : 'default'}
        />
        <StatCard
          title="Max Loss Left"
          value={`₹${Math.round(maxLossRemaining).toLocaleString('en-IN')}`}
          icon={ShieldAlert}
          variant="warning"
        />
        <StatCard
          title="Open Positions"
          value={String(trades.length)}
          subtitle={`${trades.filter(t => t.trade_type === 'SELL_PUT').length} puts`}
          icon={Activity}
        />
      </div>

      {/* Active positions */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Active Positions</h2>
        <PositionsTable positions={trades} />
      </div>

      {/* Bot logs */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Bot Activity</h2>
        <BotLogFeed logs={logs} />
      </div>
    </div>
  );
}
