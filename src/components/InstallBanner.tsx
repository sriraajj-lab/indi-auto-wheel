import { usePWA } from "@/hooks/usePWA";
import { X, Share, Plus, Bell, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function InstallBanner() {
  const {
    isStandalone: isInstalled, isIOS, deferredPrompt: canInstall, showIOSPrompt,
    notificationsGranted, installApp: installPrompt,
    requestNotifications, dismissIOSPrompt,
  } = usePWA();

  const [notifDone, setNotifDone] = useState(false);
  const [asking, setAsking] = useState(false);

  // Already installed — ask for notifications
  if (isInstalled && !notificationsGranted && !notifDone) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xl max-w-sm mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Enable trade alerts</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get notified for every trade and P&L update — even when app is closed.
              </p>
            </div>
            <button onClick={() => setNotifDone(true)} className="text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="flex-1 bg-green-500 hover:bg-green-600 text-black font-bold text-xs"
              onClick={async () => {
                setAsking(true);
                await requestNotifications();
                setNotifDone(true);
              }}
            >
              {asking ? "Requesting..." : "Enable Notifications"}
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setNotifDone(true)}>
              Later
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // iPhone — show "Add to Home Screen" instructions
  if (isIOS && showIOSPrompt) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
        <div className="bg-card border border-green-500/30 rounded-2xl p-5 shadow-2xl max-w-sm mx-auto relative">
          <button
            onClick={dismissIOSPrompt}
            className="absolute top-4 right-4 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-green-500/15 border border-green-500/25 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="font-bold text-sm">Add to iPhone</p>
              <p className="text-xs text-muted-foreground">Install for quick access</p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-3 p-3 bg-secondary/40 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Share className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-xs font-bold">Step 1 — Tap Share ⎙</p>
                <p className="text-xs text-muted-foreground">Bottom of Safari browser</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-secondary/40 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-xs font-bold">Step 2 — "Add to Home Screen"</p>
                <p className="text-xs text-muted-foreground">Scroll down in the share menu</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-secondary/40 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-green-400 font-bold text-sm">✓</span>
              </div>
              <div>
                <p className="text-xs font-bold">Step 3 — Tap Add</p>
                <p className="text-xs text-muted-foreground">App appears on your home screen</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Look for <span className="font-mono bg-muted px-1 rounded text-foreground">⎙ Share</span> at the bottom ↓
          </p>
        </div>
      </div>
    );
  }

  // Android — native install prompt
  if (canInstall && installPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
        <div className="bg-card border border-green-500/30 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Install IndiAutoWheel</p>
              <p className="text-xs text-muted-foreground">Add to home screen</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="flex-1 bg-green-500 hover:bg-green-600 text-black font-bold text-xs"
              onClick={installPrompt}
            >
              Install App
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={dismissIOSPrompt}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
