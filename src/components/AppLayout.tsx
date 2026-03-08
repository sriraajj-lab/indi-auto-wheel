import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTradeNotifications } from '@/hooks/useTradeNotifications';
import NotificationBell from '@/components/NotificationBell';
import { Activity, LayoutDashboard, Settings, ScrollText, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/trades', icon: ScrollText, label: 'Trade Log' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const location = useLocation();
  const { notifications, unreadCount, markAllRead, clearAll } = useTradeNotifications();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-profit" />
              <span className="font-mono font-bold text-sm">
                Indi<span className="text-profit">Auto</span>Wheel
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ path, icon: Icon, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                    location.pathname === path
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onOpen={markAllRead}
              onClear={clearAll}
            />
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 flex">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={cn(
              'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
              location.pathname === path ? 'text-profit' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>

      <main className="flex-1 container py-4 md:py-6 pb-20 md:pb-6">
        {children}
      </main>
    </div>
  );
}
