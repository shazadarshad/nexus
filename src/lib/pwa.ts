import { create } from 'zustand';
import { toast } from '../store/ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  canInstall: boolean;
  installed: boolean;
  isIOS: boolean;
  offlineReady: boolean;
}

export const usePwa = create<PwaState>()(() => ({
  canInstall: false,
  installed: false,
  isIOS: false,
  offlineReady: false,
}));

let deferred: BeforeInstallPromptEvent | null = null;

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Fetch every lazily-loaded page once so the whole app works offline, not just visited pages. */
function warmCache() {
  const run = () =>
    Promise.all([
      import('../pages/Dashboard'),
      import('../pages/Tasks'),
      import('../pages/Notes'),
      import('../pages/Calendar'),
      import('../pages/Habits'),
      import('../pages/Focus'),
      import('../pages/Goals'),
      import('../pages/Journal'),
      import('../pages/Finance'),
      import('../pages/Analytics'),
      import('../pages/Settings'),
      import('../pages/Landing'),
    ])
      .then(() => usePwa.setState({ offlineReady: true }))
      .catch(() => undefined);
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 2500);
}

export function initPwa() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  usePwa.setState({ isIOS, installed: standalone() });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    usePwa.setState({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    usePwa.setState({ canInstall: false, installed: true });
    toast('Nexus installed', { kind: 'success' });
  });

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        const promptUpdate = (w: ServiceWorker) =>
          toast('A new version of Nexus is ready', {
            action: { label: 'Reload', run: () => w.postMessage('skip-waiting') },
          });
        if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
          });
        });
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloaded) return;
          reloaded = true;
          location.reload();
        });
        warmCache();
      })
      .catch(() => undefined);
  });
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  usePwa.setState({ canInstall: false });
  return outcome;
}
