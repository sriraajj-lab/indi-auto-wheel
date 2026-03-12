import { useState, useEffect } from "react";

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);

  useEffect(() => {
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (ios && !standalone) {
      const dismissed = localStorage.getItem("iaw_ios_prompt_dismissed");
      const dismissedAt = dismissed ? new Date(dismissed) : null;
      const daysSince = dismissedAt
        ? (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;
      if (!dismissedAt || daysSince > 7) {
        setTimeout(() => setShowIOSPrompt(true), 3000);
      }
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[PWA] Service worker registered:", reg.scope);
          setSwReady(true);
          localStorage.setItem("iaw_last_seen", new Date().toISOString());
        })
        .catch((err) => console.error("[PWA] SW failed:", err));
    }

    if ("Notification" in window) {
      setNotificationsGranted(Notification.permission === "granted");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") setIsStandalone(true);
    setDeferredPrompt(null);
  };

  const dismissIOSPrompt = () => {
    setShowIOSPrompt(false);
    localStorage.setItem("iaw_ios_prompt_dismissed", new Date().toISOString());
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotificationsGranted(perm === "granted");
  };

  return {
    deferredPrompt,
    isStandalone,
    isIOS,
    showIOSPrompt,
    swReady,
    notificationsGranted,
    installApp,
    dismissIOSPrompt,
    requestNotifications,
  };
}
