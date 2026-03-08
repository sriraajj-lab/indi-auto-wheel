import { cn } from '@/lib/utils';
import { AlertCircle, Bot, TrendingUp, AlertTriangle, Info } from 'lucide-react';

interface LogEntry {
  id: string;
  log_type: string;
  message: string;
  metadata: any;
  created_at: string;
}

const logIcons: Record<string, any> = {
  AI_DECISION: Bot,
  TRADE: TrendingUp,
  WARNING: AlertTriangle,
  ERROR: AlertCircle,
  INFO: Info,
};

const logColors: Record<string, string> = {
  AI_DECISION: 'text-info',
  TRADE: 'text-profit',
  WARNING: 'text-warning',
  ERROR: 'text-loss',
  INFO: 'text-muted-foreground',
};

export default function BotLogFeed({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <Bot className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">No bot activity yet</p>
        <p className="text-xs text-muted-foreground mt-1">Logs will appear here when the bot starts trading</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border/50 max-h-[400px] overflow-y-auto">
      {logs.map(log => {
        const Icon = logIcons[log.log_type] || Info;
        return (
          <div key={log.id} className="p-3 flex gap-3 hover:bg-accent/20 transition-colors">
            <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', logColors[log.log_type])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-relaxed">{log.message}</p>
              <span className="text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleTimeString('en-IN')}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
