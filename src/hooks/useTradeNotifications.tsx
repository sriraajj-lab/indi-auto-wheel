import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface TradeNotification {
  id: string;
  logType: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const ALERT_LOG_TYPES = [
  'TRADE_EXECUTED', 'STOP_LOSS', 'EXPIRY_CLOSE',
  'ORDER_FAILED', 'RISK_HALT', 'ERROR',
];

const LOG_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  TRADE_EXECUTED: { label: 'Trade Executed', emoji: '🔔' },
  STOP_LOSS: { label: 'Stop Loss Hit', emoji: '🛑' },
  EXPIRY_CLOSE: { label: 'Option Expired', emoji: '⏰' },
  ORDER_FAILED: { label: 'Order Failed', emoji: '❌' },
  RISK_HALT: { label: 'Risk Halt', emoji: '⚠️' },
  ERROR: { label: 'Error', emoji: '🚨' },
};

export function useTradeNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<TradeNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load recent alerts on mount
  useEffect(() => {
    if (!user) return;

    supabase
      .from('bot_logs')
      .select('id, log_type, message, created_at')
      .eq('user_id', user.id)
      .in('log_type', ALERT_LOG_TYPES)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          const notifs = data.map((log) => ({
            id: log.id,
            logType: log.log_type,
            message: log.message,
            timestamp: log.created_at,
            read: true, // existing ones are "read"
          }));
          setNotifications(notifs);
        }
      });

    // Subscribe to new bot_logs
    const channel = supabase
      .channel('trade-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bot_logs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const log = payload.new as any;
          if (!ALERT_LOG_TYPES.includes(log.log_type)) return;

          const notif: TradeNotification = {
            id: log.id,
            logType: log.log_type,
            message: log.message,
            timestamp: log.created_at,
            read: false,
          };

          setNotifications((prev) => [notif, ...prev].slice(0, 50));
          setUnreadCount((c) => c + 1);

          // Show toast for critical events
          const meta = LOG_TYPE_LABELS[log.log_type] || { label: 'Alert', emoji: '🔔' };
          toast({
            title: `${meta.emoji} ${meta.label}`,
            description: log.message.length > 100 ? log.message.slice(0, 100) + '…' : log.message,
            variant: ['ORDER_FAILED', 'ERROR', 'RISK_HALT', 'STOP_LOSS'].includes(log.log_type)
              ? 'destructive'
              : 'default',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, markAllRead, clearAll };
}

export { LOG_TYPE_LABELS };
