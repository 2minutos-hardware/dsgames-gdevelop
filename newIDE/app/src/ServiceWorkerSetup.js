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
    // unregister the one scoped under our own deployment path. This must
    // not touch the /browser_sw_preview/ scope either - see
    // registerBrowserSWPreviewWorker below.
    const ownScope = new URL(PUBLIC_URL || '/', window.location.href).href;
    serviceWorker.getRegistrations().then(registrations => {
      registrations
        .filter(
          registration =>
            registration.scope.startsWith(ownScope) &&
            !registration.scope.includes('/browser_sw_preview/')
        )
        .forEach(registration => registration.unregister());
    });
  });
}

// DSGAMES: "Preview" (and the old "3D" mode) exports the game to files kept
// in IndexedDB, and expects a service worker to intercept requests under
// /browser_sw_preview/<instance>/... and serve them from there (see
// BrowserSWPreviewIndexedDB.js and scripts/service-worker-template). That
// URL is at the domain root, not under our /editor/ subpath, so the
// registerServiceWorker() above being fully disabled left nothing to ever
// intercept it - previews 404'd straight through to Django.
//
// This can't just reuse registerServiceWorker(): upstream registers it with
// the default scope (the directory of the script, i.e. /editor/ here, and
// even the *root* on upstream's own un-prefixed deployment) - covering
// /browser_sw_preview/ there would mean registering at the root scope "/",
// which is already claimed by DSGAMES's own service worker for push
// notifications, and only one worker can control a given scope.
//
// Instead, register the exact same generated service-worker.js (it already
// has the /browser_sw_preview/ fetch handler - see the top of
// scripts/service-worker-template/service-worker-template.js) but with an
// explicit, narrow scope of /browser_sw_preview/ only. That doesn't overlap
// with DSGAMES's root-scoped worker (different scopes coexist fine), and it
// also means this worker never sees any navigation under /editor/ at all,
// so the Workbox navigation-fallback bug that led to disabling this file
// for our own app pages is moot here, regardless of what's still in the
// script.
//
// Registering a scope outside the script's own directory requires the
// server to send `Service-Worker-Allowed: /browser_sw_preview/` when
// serving it (see the nginx config) - the browser refuses the scope
// otherwise.
export function registerBrowserSWPreviewWorker() {
  if (isNativeMobileApp() || !!electron) {
    return;
  }

  if (!serviceWorker) {
    return;
  }

  window.addEventListener('load', () => {
    // Resolve against document.baseURI (not window.location.href): this
    // build is served under a relative "homepage" (PUBLIC_URL is "."), so
    // the correct base for its own assets is the <base> tag the page sets
    // at load time, not whatever path happens to be in the address bar -
    // same reasoning as BrowserS3GDJSFinder.js's gdjsRoot resolution.
    const swUrl = new URL('service-worker.js', document.baseURI).href;
    serviceWorker
      .register(swUrl, { scope: '/browser_sw_preview/' })
      .catch(error => {
        console.error(
          '[DSGAMES] Failed to register the browser_sw_preview service worker - "Preview" will not work:',
          error
        );
      });
  });
}
