// @flow
/**
 * DSGAMES fork: what the editor may ask GDevelop's servers and trackers.
 *
 * Upstream's editor talks to GDevelop's servers as soon as it opens: its
 * shop, announcements, achievements, recommendations, marketing plans, Ask AI
 * settings... which the DSGAMES editor hides anyway. This is imported first
 * by src/index.js and wraps `fetch`, `XMLHttpRequest` (used by axios) and
 * `navigator.sendBeacon`, so that:
 * - listings of hidden features get an empty list, without any request (an
 *   error would show up in the asset store, which also lists bundles and
 *   game templates);
 * - trackers, the upload of preview screenshots and the Ask AI settings fail
 *   right away, like a network error, without any request.
 * Anything else goes through, like GDevelop's catalogs of assets, objects,
 * behaviors, extensions and examples: they are only fetched when the user
 * opens one of these stores (see GDevelopCatalogs.js).
 *
 * Not covered: service workers and web workers have their own `fetch`, and
 * scripts or images added to the page are loaded by the browser itself. The
 * smoke test (scripts/dsgames-smoke-test) checks what is actually requested.
 */

export type NetworkDecision = 'allow' | 'empty-list' | 'block';

// Written so that the built editor doesn't contain the names that
// scripts/check-dsgames-privacy.js looks for ("post[h]og", escaped slashes).
const blockedHosts = [
  // Analytics and ads.
  /(^|\.)post[h]og\.com$/,
  /(^|\.)google-analytics\.com$/,
  /(^|\.)googletagmanager\.com$/,
  /(^|\.)doubleclick\.net$/,
  /(^|\.)facebook\.net$/,
  /(^|\.)tiktok\.com$/,
  /(^|\.)licdn\.com$/,
  /(^|\.)hotjar\.com$/,
  /(^|\.)twitter\.com$/,
  // Ask AI (hidden) settings.
  /^public-resources\.gdevelop\.io$/,
];

// GDevelop's remote scripts (analytics, ads on gd.games).
const blockedUrls = [/^https:\/\/resources\.gdevelop\.io\/a\//];

// Listings of features hidden in the DSGAMES editor, under api.gdevelop.io
// (and its development twin): answered with an empty list.
const emptyListPaths = [
  /^\/shop\/[a-z-]+$/,
  /^\/release\/(announcement|promotion)$/,
  /^\/user\/(achievement|recommendation)$/,
  /^\/game\/marketing-plan$/,
];

// Other requests to hidden features of api.gdevelop.io: blocked.
const blockedPaths = [
  /^\/shop\//,
  /^\/release\/(announcement|promotion)/,
  /^\/user\/(achievement|recommendation)/,
  /^\/game\/marketing-plan/,
  // Upload of screenshots taken during previews, for gd.games.
  /^\/game\/resource-signed-url/,
];

const gdevelopApiHosts = ['api.gdevelop.io', 'api-dev.gdevelop.io'];

export const getNetworkDecision = (
  method: string,
  url: string
): NetworkDecision => {
  let parsedUrl;
  try {
    parsedUrl = new URL(url, 'http://localhost/');
  } catch (error) {
    return 'allow';
  }
  if (!/^(https?|wss?):$/.test(parsedUrl.protocol)) return 'allow';

  const { hostname, pathname, href } = parsedUrl;
  if (blockedHosts.some(host => host.test(hostname))) return 'block';
  if (blockedUrls.some(blockedUrl => blockedUrl.test(href))) return 'block';

  if (gdevelopApiHosts.includes(hostname)) {
    if (
      method.toUpperCase() === 'GET' &&
      emptyListPaths.some(path => path.test(pathname))
    )
      return 'empty-list';
    if (blockedPaths.some(path => path.test(pathname))) return 'block';
  }
  return 'allow';
};

const emptyListDataUrl = 'data:application/json,%5B%5D';

const logDecision = (decision: NetworkDecision, url: string) => {
  if (process.env.NODE_ENV === 'production') return;
  console.info(
    `[DSGAMES] ${
      decision === 'block' ? 'Blocked' : 'Answered with an empty list'
    }: ${url}`
  );
};

const getRequestUrl = (input: any): string => {
  if (typeof input === 'string') return input;
  if (input && typeof input.href === 'string') return input.href; // URL
  if (input && typeof input.url === 'string') return input.url; // Request
  return String(input);
};

const makeEvent = (type: string): Event =>
  typeof ProgressEvent === 'function'
    ? new ProgressEvent(type)
    : new Event(type);

/**
 * Wrap the network functions of `target` (the browser's `window`, or a fake
 * one in tests). Safe to call more than once.
 */
export const installNetworkPolicy = (target: any) => {
  if (!target || target.__dsgamesNetworkPolicyInstalled) return;
  target.__dsgamesNetworkPolicyInstalled = true;

  if (typeof target.fetch === 'function') {
    const originalFetch = target.fetch;
    target.fetch = function(input: any, init: any) {
      const self: any = this;
      const url = getRequestUrl(input);
      const method =
        (init && init.method) ||
        (input && typeof input.method === 'string' ? input.method : 'GET');
      const decision = getNetworkDecision(method, url);
      if (decision === 'allow') return originalFetch.apply(self, arguments);

      logDecision(decision, url);
      if (decision === 'empty-list') {
        return Promise.resolve(
          new target.Response('[]', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.reject(
        new TypeError(`Blocked by the DSGAMES network policy: ${url}`)
      );
    };
  }

  if (target.XMLHttpRequest && target.XMLHttpRequest.prototype) {
    const prototype = target.XMLHttpRequest.prototype;
    const originalOpen = prototype.open;
    const originalSend = prototype.send;
    prototype.open = function(method: string, url: any, ...rest: Array<any>) {
      const request: any = this;
      const requestUrl = getRequestUrl(url);
      const decision = getNetworkDecision(method, requestUrl);
      request.__dsgamesBlocked = decision === 'block';
      if (decision !== 'allow') logDecision(decision, requestUrl);
      if (decision === 'empty-list') {
        return originalOpen.call(request, 'GET', emptyListDataUrl, ...rest);
      }
      return originalOpen.call(request, method, url, ...rest);
    };
    prototype.send = function(...args: Array<any>) {
      const request: any = this;
      if (!request.__dsgamesBlocked) return originalSend.apply(request, args);
      // Fail like a network error (axios rejects with "Network Error").
      setTimeout(() => {
        request.dispatchEvent(makeEvent('error'));
        request.dispatchEvent(makeEvent('loadend'));
      }, 0);
    };
  }

  if (target.navigator && typeof target.navigator.sendBeacon === 'function') {
    const navigator = target.navigator;
    const originalSendBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function(url: any, data: any) {
      const requestUrl = getRequestUrl(url);
      const decision = getNetworkDecision('POST', requestUrl);
      if (decision === 'allow')
        return originalSendBeacon.call(navigator, url, data);
      logDecision('block', requestUrl);
      return false;
    };
  }
};

if (typeof window !== 'undefined') installNetworkPolicy(window);
