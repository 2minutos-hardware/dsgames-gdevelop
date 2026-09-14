// @flow
import optionalRequire from './Utils/OptionalRequire';
import { isNativeMobileApp } from './Utils/Platform';

// $FlowFixMe[cannot-resolve-name]
const PUBLIC_URL: string = process.env.PUBLIC_URL || '';

const electron = optionalRequire('electron');
const serviceWorker =
  typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;

export function isServiceWorkerSupported(): boolean {
  return !!serviceWorker;
}

// DSGAMES: upstream's service worker hardcodes '/index.html' as the
// Workbox navigation fallback (see public/service-worker.js), which only
// works when the app is hosted at the domain root. We serve it under a
// subpath (/editor/), so that fallback never matches anything in the
// precache and navigations can fail (observed as an unrelated 404 on
// repeat visits, until the stale worker is unregistered). This editor
// doesn't need offline/PWA support, so instead of patching the fallback
// path we just don't register a service worker at all — and actively
// unregister any that a previous build already installed in the visitor's
// browser, so anyone who hit the bug self-heals on their next load.
export function registerServiceWorker() {
  if (isNativeMobileApp() || !!electron) {
    return;
  }

  if (!serviceWorker) {
    return;
  }

  window.addEventListener('load', () => {
    // getRegistrations() is origin-wide, not scoped to this page — DSGAMES
    // itself registers an unrelated service worker at the site root for
    // push notifications (scope "/"), which must be left alone. Only
    // unregister the one scoped under our own deployment path.
    const ownScope = new URL(PUBLIC_URL || '/', window.location.href).href;
    serviceWorker.getRegistrations().then(registrations => {
      registrations
        .filter(registration => registration.scope.startsWith(ownScope))
        .forEach(registration => registration.unregister());
    });
  });
}
