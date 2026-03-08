import { cn } from '@/lib/utils';

interface Position {
  id: string;
  symbol: string;
  trade_type: string;
  strike_price: number | null;
  premium: number | null;
  quantity: number;
  status: string;
  pnl: number | null;
  expiry_date: string | null;
}

export default function PositionsTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground text-sm">No active positions</p>
        <p className="text-xs text-muted-foreground mt-1">The bot will open trades when market conditions align</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Symbol</th>
            <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Type</th>
            <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider font-mono">Strike</th>
            <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider font-mono">Premium</th>
            <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Qty</th>
            <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Expiry</th>
            <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider font-mono">P&L</th>
            <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(pos => (
            <tr key={pos.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
              <td className="p-3 font-mono font-semibold">{pos.symbol}</td>
              <td className="p-3">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded',
                  pos.trade_type === 'SELL_PUT' ? 'bg-profit/10 text-profit' : 'bg-info/10 text-info'
                )}>
                  {pos.trade_type.replace('_', ' ')}
                </span>
              </td>
              <td className="p-3 font-mono">₹{pos.strike_price?.toLocaleString('en-IN') ?? '—'}</td>
              <td className="p-3 font-mono">₹{pos.premium?.toLocaleString('en-IN') ?? '—'}</td>
              <td className="p-3">{pos.quantity}</td>
              <td className="p-3 text-muted-foreground">{pos.expiry_date ?? '—'}</td>
              <td className={cn('p-3 font-mono font-semibold', (pos.pnl ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
                {pos.pnl !== null ? `₹${pos.pnl.toLocaleString('en-IN')}` : '—'}
              </td>
              <td className="p-3">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded',
                  pos.status === 'OPEN' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
                )}>
                  {pos.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
