import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  RefreshCw,
  Share,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useOfflineStore } from '../../stores/offlineStore';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  const isIos =
    typeof window !== 'undefined' &&
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream;

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
      return true;
    }
    return false;
  };

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled && !isStandalone,
    isIos: isIos && !isStandalone && !isInstalled,
    isInstalled: isInstalled || isStandalone,
    promptInstall,
  };
}

export function PWAInstallButton({
  variant = 'outline',
}: {
  variant?: 'outline' | 'dark' | 'compact';
}) {
  const { canInstall, isIos, promptInstall } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (!canInstall && !isIos) return null;

  const baseClass =
    variant === 'dark'
      ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-[#FFF8ED] text-xs font-semibold hover:bg-white/20 transition-colors whitespace-nowrap'
      : variant === 'compact'
      ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#245C45]/25 text-[#245C45] text-xs font-semibold hover:bg-[#245C45]/5 transition-colors whitespace-nowrap'
      : 'inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#245C45]/25 text-[#245C45] text-xs font-semibold hover:bg-[#245C45]/5 transition-colors whitespace-nowrap';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canInstall) {
            void promptInstall();
          } else if (isIos) {
            setShowIosGuide(true);
          }
        }}
        className={baseClass}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install SAUTI App</span>
      </button>

      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install SAUTI on iPhone or iPad"
        >
          <div className="bg-[#FFF8ED] text-[#17201C] rounded-3xl max-w-sm w-full p-6 border border-[#245C45]/20 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#245C45]">Offline-Ready App</p>
                <h2 className="font-display text-xl font-bold">Install SAUTI on iOS</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                aria-label="Close install instructions"
                className="p-1.5 rounded-lg text-[#4A5851] hover:bg-[#245C45]/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-2.5 text-sm text-[#4A5851]">
              <li className="flex items-start gap-2">
                <span className="font-mono font-bold text-[#245C45]">1.</span>
                <span>
                  Tap the <Share className="w-3.5 h-3.5 inline text-[#245C45]" /> Share button in
                  Safari&apos;s toolbar.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono font-bold text-[#245C45]">2.</span>
                <span>Scroll down and choose &ldquo;Add to Home Screen&rdquo;.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono font-bold text-[#245C45]">3.</span>
                <span>Tap &ldquo;Add&rdquo; to open SAUTI offline anytime.</span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function ConnectivityBanner() {
  const {
    isOnline,
    lowBandwidthMode,
    pendingSyncCount,
    isSyncing,
    syncMessage,
    syncError,
    setLowBandwidthMode,
    syncPendingQueue,
  } = useOfflineStore();

  return (
    <div className="mb-6 rounded-2xl border border-[#245C45]/15 bg-[#FDF6EA] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 font-semibold ${
            isOnline ? 'text-[#245C45]' : 'text-[#B43C25]'
          }`}
        >
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span>{isOnline ? 'Online' : 'Offline mode'}</span>
        </span>

        {!isOnline && (
          <span className="text-[#4A5851]">
            Downloaded lessons, offline listening, and local recordings remain available. Progress queues safely.
          </span>
        )}

        {pendingSyncCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F6C96B]/35 text-[#17201C] font-semibold tabular-nums">
            <span>
              {pendingSyncCount} update{pendingSyncCount === 1 ? '' : 's'} queued
            </span>
          </span>
        )}

        {syncMessage && pendingSyncCount === 0 && (
          <span className="inline-flex items-center gap-1 text-[#245C45]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{syncMessage}</span>
          </span>
        )}

        {syncError && <span className="text-[#B43C25]">{syncError}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {isOnline && pendingSyncCount > 0 && (
          <button
            type="button"
            disabled={isSyncing}
            onClick={() => void syncPendingQueue()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#245C45] text-[#FFF8ED] font-semibold hover:bg-[#194231] disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync now'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setLowBandwidthMode(!lowBandwidthMode)}
          aria-pressed={lowBandwidthMode}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
            lowBandwidthMode
              ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
              : 'bg-white text-[#4A5851] border-[#245C45]/20 hover:text-[#17201C]'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Data-Saving: {lowBandwidthMode ? 'On' : 'Off'}</span>
        </button>

        <PWAInstallButton variant="compact" />
      </div>
    </div>
  );
}
