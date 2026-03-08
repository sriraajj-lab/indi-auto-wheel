import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Rocket, Settings, Link2, Brain, Play, StopCircle,
  ShieldCheck, ScrollText, FlaskConical, ChevronRight, ChevronLeft,
  CheckCircle2, Zap, BarChart3
} from 'lucide-react';

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
  details: string[];
  color: string;
}

const STEPS: Step[] = [
  {
    icon: Rocket,
    title: 'Welcome to IndiAutoWheel',
    description: 'Your autonomous options wheel strategy bot for Indian markets (NSE).',
    details: [
      'This bot automates the wheel strategy: Sell Puts → Get Assigned → Sell Covered Calls → Repeat.',
      'It uses AI + technical indicators (RSI, EMA Cloud) + news sentiment to make trade decisions.',
      'Works with Zerodha Kite for live trading, or runs in paper-trade mode for testing.',
    ],
    color: 'text-profit',
  },
  {
    icon: Settings,
    title: 'Step 1: Configure Settings',
    description: 'Go to Settings to set your capital, risk limits, and approved stocks.',
    details: [
      '💰 Set your Allocated Capital (e.g., ₹5,00,000).',
      '🛡️ Set Max Daily Loss % (default 1.5%) and Max Risk Per Trade % (default 1%).',
      '📊 Choose Aggressiveness: Conservative, Balanced, or Aggressive.',
      '📋 Add/remove stocks from the Approved Stocks list (only liquid large-caps).',
    ],
    color: 'text-info',
  },
  {
    icon: Link2,
    title: 'Step 2: Connect Zerodha Kite',
    description: 'Link your Kite account for live order execution.',
    details: [
      '🔑 Get your API Key & Secret from developers.kite.trade.',
      '📝 Paste them in Settings → Zerodha Kite Connect section.',
      '🔗 Click "Connect Kite" to authorize — you\'ll be redirected to Zerodha to log in.',
      '⚠️ Skip this step to run in Paper Trade mode (simulated, no real orders).',
    ],
    color: 'text-warning',
  },
  {
    icon: Play,
    title: 'Step 3: Enable the Bot',
    description: 'Toggle "Enable Autonomous Trading" in Settings and save.',
    details: [
      '⚡ The bot runs automatically during market hours (9:15 AM – 3:20 PM IST, Mon-Fri).',
      '🤖 Each cycle: fetches market data → runs technical analysis → checks news sentiment → asks AI for decisions → executes trades.',
      '📝 Without Kite connected, trades run in Paper Mode (logged but not placed).',
      '✅ Click "Save All Settings" to activate.',
    ],
    color: 'text-profit',
  },
  {
    icon: Brain,
    title: 'Step 4: Use News AI Analysis',
    description: 'Manually analyze market news for trade signals anytime.',
    details: [
      '📰 Go to "News AI" in the navigation bar.',
      '📋 Paste a market news article or headline.',
      '🏷️ Select the relevant stock from the dropdown.',
      '🧠 Click "Analyze with Claude" to get an intraday decision + long-term outlook with confidence scores.',
    ],
    color: 'text-info',
  },
  {
    icon: BarChart3,
    title: 'Step 5: Monitor Your Dashboard',
    description: 'Track everything in real-time from the Dashboard.',
    details: [
      '📈 Capital, Today\'s P&L, Max Loss Remaining, and Open Positions at a glance.',
      '📋 Active Positions table shows all open trades with entry price, type, and P&L.',
      '📜 Bot Activity feed shows every action: trades, sentiment checks, AI decisions, stop-losses.',
      '🔔 Notification bell alerts you to new trades and important events.',
    ],
    color: 'text-profit',
  },
  {
    icon: StopCircle,
    title: 'How to Stop the Bot',
    description: 'Two ways to halt trading immediately.',
    details: [
      '🛑 Emergency Stop (Dashboard): Instantly halts ALL trading. Use in urgent situations.',
      '⏸️ Disable Bot (Settings): Turn off "Enable Autonomous Trading" and save.',
      '▶️ Resume: Click "Resume Bot" on Dashboard, or re-enable in Settings.',
      '💡 Emergency Stop closes no positions — it just prevents new trades.',
    ],
    color: 'text-loss',
  },
  {
    icon: ShieldCheck,
    title: 'Safety & Risk Controls',
    description: 'Built-in protections to keep your capital safe.',
    details: [
      '🛡️ Max Risk Per Trade: Never risks more than your configured % per trade.',
      '📉 Daily Loss Limit: Bot auto-pauses if daily loss exceeds your threshold.',
      '🧠 Sentiment Gate: Blocks bullish entries when news sentiment is bearish.',
      '⏰ Market Hours Only: Bot only operates during NSE trading hours.',
    ],
    color: 'text-warning',
  },
  {
    icon: FlaskConical,
    title: 'Backtest & Trade Log',
    description: 'Review past performance and test strategies.',
    details: [
      '📊 Backtest: Run the trading engine in test mode with simulated data to see how it performs.',
      '📜 Trade Log: View all historical trades with entry/exit prices, P&L, and AI reasoning.',
      '🔍 Filter by stock, date, or trade type to analyze patterns.',
      '💡 Use these tools to refine your strategy before going live.',
    ],
    color: 'text-info',
  },
];

interface DemoTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DemoTour({ open, onOpenChange }: DemoTourProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleClose = () => {
    setStep(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg border-border bg-card p-0 gap-0 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6 space-y-5">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg bg-muted ${current.color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-mono">
                  {step + 1} / {STEPS.length}
                </p>
                <DialogTitle className="text-lg font-bold">{current.title}</DialogTitle>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{current.description}</p>
          </DialogHeader>

          <div className="space-y-2.5 bg-muted/50 rounded-lg p-4">
            {current.details.map((detail, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-profit mt-0.5 shrink-0" />
                <span className="text-foreground/90 leading-relaxed">{detail}</span>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(s => s - 1)}
              disabled={isFirst}
              className="gap-1 text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                />
              ))}
            </div>

            {isLast ? (
              <Button size="sm" onClick={handleClose} className="gap-1">
                <Zap className="h-4 w-4" />
                Get Started
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(s => s + 1)} className="gap-1">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
