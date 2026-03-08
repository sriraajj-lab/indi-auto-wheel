import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'profit' | 'loss' | 'warning';
}

export default function StatCard({ title, value, subtitle, icon: Icon, variant = 'default' }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 bg-card transition-all',
        variant === 'profit' && 'border-profit/30 glow-profit',
        variant === 'loss' && 'border-loss/30 glow-loss',
        variant === 'warning' && 'border-warning/30',
        variant === 'default' && 'border-border'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{title}</span>
        <Icon
          className={cn(
            'h-4 w-4',
            variant === 'profit' && 'text-profit',
            variant === 'loss' && 'text-loss',
            variant === 'warning' && 'text-warning',
            variant === 'default' && 'text-muted-foreground'
          )}
        />
      </div>
      <div
        className={cn(
          'text-2xl font-mono font-bold',
          variant === 'profit' && 'text-profit',
          variant === 'loss' && 'text-loss',
          variant === 'warning' && 'text-warning'
        )}
      >
        {value}
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
