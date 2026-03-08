import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, Key, Wallet, Shield, Zap, ListChecks, Link, Unlink, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const DEFAULT_STOCKS = ['RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'ICICIBANK', 'SBIN', 'ITC'];

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    broker_api_key: '',
    broker_api_secret: '',
    allocated_capital: 500000,
    max_daily_loss_pct: 1.5,
    max_risk_per_trade_pct: 1.0,
    approved_stocks: DEFAULT_STOCKS,
    aggressiveness: 'Balanced',
    bot_enabled: false,
  });
  const [brokerStatus, setBrokerStatus] = useState<{
    connected: boolean;
    expiresAt: string | null;
    expired: boolean;
  }>({ connected: false, expiresAt: null, expired: false });
  const [newStock, setNewStock] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('bot_settings').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setSettings({
          broker_api_key: data.broker_api_key ?? '',
          broker_api_secret: data.broker_api_secret ?? '',
          allocated_capital: data.allocated_capital,
          max_daily_loss_pct: data.max_daily_loss_pct,
          max_risk_per_trade_pct: data.max_risk_per_trade_pct,
          approved_stocks: data.approved_stocks,
          aggressiveness: data.aggressiveness,
          bot_enabled: data.bot_enabled,
        });

        const hasToken = !!data.broker_access_token;
        const expiresAt = data.broker_access_token_expires_at;
        const expired = expiresAt ? new Date(expiresAt) < new Date() : false;
        setBrokerStatus({ connected: hasToken && !expired, expiresAt, expired: hasToken && expired });
      }
      setLoading(false);
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      ...settings,
      broker_api_key: settings.broker_api_key || null,
      broker_api_secret: settings.broker_api_secret || null,
    };

    const { error } = await supabase.from('bot_settings').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Settings saved ✓' });
    }
    setSaving(false);
  };

  const handleKiteConnect = () => {
    if (!settings.broker_api_key) {
      toast({ title: 'API Key required', description: 'Save your Kite API Key first.', variant: 'destructive' });
      return;
    }
    // Redirect to Kite login — redirect_url points to our callback page
    const redirectUrl = `${window.location.origin}/kite-callback`;
    const kiteLoginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(settings.broker_api_key)}&redirect_url=${encodeURIComponent(redirectUrl)}`;
    window.location.href = kiteLoginUrl;
  };

  const handleKiteDisconnect = async () => {
    if (!user) return;
    const { error } = await supabase.from('bot_settings').update({
      broker_access_token: null,
      broker_access_token_expires_at: null,
      broker_request_token: null,
    }).eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setBrokerStatus({ connected: false, expiresAt: null, expired: false });
      toast({ title: 'Kite Disconnected' });
    }
  };

  const addStock = () => {
    const s = newStock.trim().toUpperCase();
    if (s && !settings.approved_stocks.includes(s)) {
      setSettings(prev => ({ ...prev, approved_stocks: [...prev.approved_stocks, s] }));
      setNewStock('');
    }
  };

  const removeStock = (stock: string) => {
    setSettings(prev => ({ ...prev, approved_stocks: prev.approved_stocks.filter(s => s !== stock) }));
  };

  const formatExpiry = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
      <h1 className="text-2xl font-bold font-mono">Settings</h1>

      {/* Broker Connection */}
      <Card className="p-5 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-4 w-4 text-profit" />
          <h2 className="font-semibold">Zerodha Kite Connect</h2>
        </div>

        {/* Connection Status */}
        <div className={`rounded-lg p-3 mb-4 border ${
          brokerStatus.connected
            ? 'bg-profit/5 border-profit/20'
            : brokerStatus.expired
              ? 'bg-yellow-500/5 border-yellow-500/20'
              : 'bg-muted/50 border-border'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {brokerStatus.connected ? (
                <CheckCircle2 className="h-4 w-4 text-profit" />
              ) : brokerStatus.expired ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <Unlink className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-mono">
                {brokerStatus.connected
                  ? 'Connected'
                  : brokerStatus.expired
                    ? 'Token Expired'
                    : 'Not Connected'}
              </span>
            </div>
            {brokerStatus.connected ? (
              <Button variant="outline" size="sm" onClick={handleKiteDisconnect} className="text-xs">
                <Unlink className="h-3 w-3 mr-1" />
                Disconnect
              </Button>
            ) : (
              <Button variant="profit" size="sm" onClick={handleKiteConnect} className="text-xs">
                <Link className="h-3 w-3 mr-1" />
                {brokerStatus.expired ? 'Reconnect' : 'Connect Kite'}
              </Button>
            )}
          </div>
          {brokerStatus.expiresAt && brokerStatus.connected && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Expires: {formatExpiry(brokerStatus.expiresAt)}</span>
            </div>
          )}
        </div>

        {/* API Credentials */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">API Key</label>
            <Input
              value={settings.broker_api_key}
              onChange={e => setSettings(s => ({ ...s, broker_api_key: e.target.value }))}
              placeholder="Your Kite API Key"
              className="bg-muted border-border font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">API Secret</label>
            <Input
              type="password"
              value={settings.broker_api_secret}
              onChange={e => setSettings(s => ({ ...s, broker_api_secret: e.target.value }))}
              placeholder="Your Kite API Secret"
              className="bg-muted border-border font-mono text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Get credentials from{' '}
            <a href="https://developers.kite.trade" target="_blank" rel="noopener noreferrer" className="text-profit hover:underline">
              developers.kite.trade
            </a>
            . Save settings before connecting.
          </p>
        </div>
      </Card>

      {/* Capital & Risk */}
      <Card className="p-5 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-4 w-4 text-profit" />
          <h2 className="font-semibold">Capital & Risk</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Allocated Capital (₹)</label>
            <Input
              type="number"
              value={settings.allocated_capital}
              onChange={e => setSettings(s => ({ ...s, allocated_capital: Number(e.target.value) }))}
              className="bg-muted border-border font-mono"
              min={100000}
              max={50000000}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Max Daily Loss %</label>
            <Input
              type="number"
              value={settings.max_daily_loss_pct}
              onChange={e => setSettings(s => ({ ...s, max_daily_loss_pct: Number(e.target.value) }))}
              className="bg-muted border-border font-mono"
              step={0.1}
              min={0.5}
              max={5}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Max Risk Per Trade %</label>
            <Input
              type="number"
              value={settings.max_risk_per_trade_pct}
              onChange={e => setSettings(s => ({ ...s, max_risk_per_trade_pct: Number(e.target.value) }))}
              className="bg-muted border-border font-mono"
              step={0.1}
              min={0.1}
              max={3}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Aggressiveness</label>
            <Select
              value={settings.aggressiveness}
              onValueChange={v => setSettings(s => ({ ...s, aggressiveness: v }))}
            >
              <SelectTrigger className="bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Conservative">Conservative</SelectItem>
                <SelectItem value="Balanced">Balanced</SelectItem>
                <SelectItem value="Aggressive">Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Approved Stocks */}
      <Card className="p-5 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="h-4 w-4 text-profit" />
          <h2 className="font-semibold">Approved Stocks</h2>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {settings.approved_stocks.map(stock => (
            <Badge
              key={stock}
              variant="secondary"
              className="font-mono cursor-pointer hover:bg-destructive/20 hover:text-loss transition-colors"
              onClick={() => removeStock(stock)}
            >
              {stock} ×
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newStock}
            onChange={e => setNewStock(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStock()}
            placeholder="Add stock symbol"
            className="bg-muted border-border font-mono text-sm max-w-xs"
          />
          <Button variant="terminal" size="sm" onClick={addStock}>Add</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Only liquid large-caps with weekly options. Click to remove.</p>
      </Card>

      {/* Bot Toggle */}
      <Card className="p-5 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-profit" />
          <h2 className="font-semibold">Bot Control</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Enable Autonomous Trading</p>
            <p className="text-xs text-muted-foreground">Bot will trade during market hours when enabled</p>
          </div>
          <Switch
            checked={settings.bot_enabled}
            onCheckedChange={v => setSettings(s => ({ ...s, bot_enabled: v }))}
          />
        </div>
        {settings.bot_enabled && !brokerStatus.connected && (
          <p className="text-xs text-yellow-500 mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Kite not connected — bot will skip trading until connected.
          </p>
        )}
      </Card>

      <Button onClick={handleSave} disabled={saving} variant="profit" className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saving ? 'Saving...' : 'Save All Settings'}
      </Button>
    </div>
  );
}
