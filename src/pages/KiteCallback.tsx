import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Activity, CheckCircle, XCircle } from 'lucide-react';

export default function KiteCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Connecting to Zerodha Kite...');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const requestToken = searchParams.get('request_token');
    const kiteStatus = searchParams.get('status');

    if (kiteStatus === 'cancelled') {
      setStatus('error');
      setMessage('Kite login was cancelled.');
      setTimeout(() => navigate('/settings'), 2000);
      return;
    }

    if (!requestToken) {
      setStatus('error');
      setMessage('No request token received from Kite.');
      setTimeout(() => navigate('/settings'), 2000);
      return;
    }

    if (!user) return;

    const exchangeToken = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kite-auth`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ request_token: requestToken }),
          }
        );

        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.error || 'Token exchange failed');
        }

        setStatus('success');
        setMessage(`Connected as ${data.kite_user || 'Kite user'}`);
        toast({ title: 'Kite Connected ✓', description: `Logged in as ${data.kite_user || 'Kite user'}` });
        setTimeout(() => navigate('/settings'), 2000);
      } catch (err: any) {
        console.error('Kite auth error:', err);
        setStatus('error');
        setMessage(err.message || 'Failed to connect');
        toast({ title: 'Kite Connection Failed', description: err.message, variant: 'destructive' });
        setTimeout(() => navigate('/settings'), 3000);
      }
    };

    exchangeToken();
  }, [user, searchParams, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center terminal-grid p-4">
      <div className="text-center space-y-4 animate-slide-up">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Activity className="h-8 w-8 text-profit" />
          <h1 className="text-2xl font-bold font-mono tracking-tight">
            Indi<span className="text-profit">Auto</span>Wheel
          </h1>
        </div>

        <div className="flex justify-center">
          {status === 'processing' && (
            <div className="h-12 w-12 rounded-full border-4 border-profit/30 border-t-profit animate-spin" />
          )}
          {status === 'success' && <CheckCircle className="h-12 w-12 text-profit" />}
          {status === 'error' && <XCircle className="h-12 w-12 text-loss" />}
        </div>

        <p className={`font-mono text-sm ${
          status === 'success' ? 'text-profit' : status === 'error' ? 'text-loss' : 'text-muted-foreground'
        }`}>
          {message}
        </p>

        <p className="text-xs text-muted-foreground">Redirecting to settings...</p>
      </div>
    </div>
  );
}
