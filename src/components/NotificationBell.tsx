import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { TradeNotification, LOG_TYPE_LABELS } from '@/hooks/useTradeNotifications';

interface NotificationBellProps {
  notifications: TradeNotification[];
  unreadCount: number;
  onOpen: () => void;
  onClear: () => void;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const LOG_TYPE_COLORS: Record<string, string> = {
  TRADE_EXECUTED: 'bg-profit/10 text-profit border-profit/20',
  STOP_LOSS: 'bg-destructive/10 text-destructive border-destructive/20',
  EXPIRY_CLOSE: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  ORDER_FAILED: 'bg-destructive/10 text-destructive border-destructive/20',
  RISK_HALT: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  ERROR: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function NotificationBell({ notifications, unreadCount, onOpen, onClear }: NotificationBellProps) {
  return (
    <Popover onOpenChange={(open) => open && onOpen()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 bg-card border-border"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Trade Alerts</h3>
          {notifications.length > 0 && (
            <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Clear all
            </button>
          )}
        </div>

        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No alerts yet</p>
              <p className="text-xs">Notifications appear when the bot trades</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => {
                const meta = LOG_TYPE_LABELS[notif.logType] || { label: 'Alert', emoji: '🔔' };
                const colorClasses = LOG_TYPE_COLORS[notif.logType] || 'bg-muted/50 text-foreground border-border';

                return (
                  <div
                    key={notif.id}
                    className={cn(
                      'px-4 py-3 transition-colors',
                      !notif.read && 'bg-accent/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs',
                          colorClasses
                        )}
                      >
                        {meta.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">{meta.label}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {timeAgo(notif.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-all">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
