// @flow
import { getNetworkDecision, installNetworkPolicy } from './NetworkPolicy';

describe('DSGAMES network policy', () => {
  describe('getNetworkDecision', () => {
    it('answers listings of hidden features with an empty list', () => {
      [
        'https://api.gdevelop.io/shop/course',
        'https://api.gdevelop.io/shop/bundle?clientId=1',
        'https://api.gdevelop.io/shop/game-template',
        'https://api.gdevelop.io/shop/credits-package',
        'https://api.gdevelop.io/shop/product-license?userId=1',
        'https://api.gdevelop.io/release/announcement',
        'https://api.gdevelop.io/release/promotion',
        'https://api.gdevelop.io/user/achievement',
        'https://api.gdevelop.io/user/recommendation',
        'https://api.gdevelop.io/game/marketing-plan',
        'https://api-dev.gdevelop.io/shop/course',
      ].forEach(url =>
        expect(getNetworkDecision('GET', url)).toBe('empty-list')
      );
    });

    it('blocks trackers, the other requests to hidden features, and the upload of preview screenshots', () => {
      [
        ['GET', 'https://app.posthog.com/decide'],
        ['POST', 'https://eu.i.posthog.com/e/'],
        ['GET', 'https://resources.gdevelop.io/a/gea.js'],
        ['GET', 'https://resources.gdevelop.io/a/ggm-web.js'],
        ['GET', 'https://www.google-analytics.com/analytics.js'],
        ['GET', 'https://www.googletagmanager.com/gtag/js'],
        ['GET', 'https://connect.facebook.net/en_US/fbevents.js'],
        ['GET', 'https://analytics.tiktok.com/i18n/pixel/events.js'],
        ['GET', 'https://snap.licdn.com/li.lms-analytics/insight.min.js'],
        ['GET', 'https://platform.twitter.com/widgets.js'],
        ['GET', 'https://public-resources.gdevelop.io/ai/ai-settings-v2.json'],
        ['GET', 'https://api.gdevelop.io/shop/course/some-course-id'],
        ['POST', 'https://api.gdevelop.io/shop/purchase'],
        ['POST', 'https://api.gdevelop.io/game/resource-signed-url'],
      ].forEach(([method, url]) =>
        expect(getNetworkDecision(method, url)).toBe('block')
      );
    });

    it('lets the rest through, like the catalogs opened by the user', () => {
      [
        'https://api.gdevelop.io/asset/asset?environment=live',
        'https://api.gdevelop.io/asset/extension',
        'https://api.gdevelop.io/asset/example',
        'https://resources.gdevelop-app.com/assets-database/assets/abc.json',
        'https://asset-resources.gdevelop.io/public-resources/image.png',
        'https://games.dosminutos.es/publish/',
        '/publish/',
        'data:application/json,[]',
        'blob:https://games.dosminutos.es/1234',
      ].forEach(url => expect(getNetworkDecision('GET', url)).toBe('allow'));
    });
  });

  describe('installNetworkPolicy', () => {
    class FakeXMLHttpRequest extends EventTarget {
      openedWith: ?{| method: string, url: string |} = null;
      sent = false;
      open(method: string, url: string) {
        this.openedWith = { method, url };
      }
      send() {
        this.sent = true;
      }
    }

    const makeTarget = () => {
      const fetch = jest.fn(() => Promise.resolve('network response'));
      const sendBeacon = jest.fn(() => true);
      const target: any = {
        fetch,
        Response: class {
          body: string;
          status: number;
          constructor(body: string, init: {| status: number |}) {
            this.body = body;
            this.status = init.status;
          }
        },
        XMLHttpRequest: class extends FakeXMLHttpRequest {},
        navigator: { sendBeacon },
      };
      installNetworkPolicy(target);
      return { target, fetch, sendBeacon };
    };

    it('wraps fetch', async () => {
      const { target, fetch } = makeTarget();

      await expect(
        target.fetch('https://api.gdevelop.io/asset/extension')
      ).resolves.toBe('network response');
      expect(fetch).toHaveBeenCalledTimes(1);

      const emptyList = await target.fetch(
        'https://api.gdevelop.io/release/announcement'
      );
      expect(emptyList.status).toBe(200);
      expect(emptyList.body).toBe('[]');

      await expect(
        target.fetch('https://api.gdevelop.io/game/resource-signed-url', {
          method: 'POST',
        })
      ).rejects.toThrow('Blocked by the DSGAMES network policy');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('wraps XMLHttpRequest, used by axios', async () => {
      const { target } = makeTarget();

      const allowed = new target.XMLHttpRequest();
      allowed.open('GET', 'https://api.gdevelop.io/asset/object');
      allowed.send();
      expect(allowed.openedWith).toEqual({
        method: 'GET',
        url: 'https://api.gdevelop.io/asset/object',
      });
      expect(allowed.sent).toBe(true);

      const emptyList = new target.XMLHttpRequest();
      emptyList.open('GET', 'https://api.gdevelop.io/shop/bundle');
      emptyList.send();
      expect(emptyList.openedWith).toEqual({
        method: 'GET',
        url: 'data:application/json,%5B%5D',
      });
      expect(emptyList.sent).toBe(true);

      const blocked = new target.XMLHttpRequest();
      const onError = jest.fn();
      blocked.addEventListener('error', onError);
      blocked.open('GET', 'https://www.google-analytics.com/collect');
      blocked.send();
      expect(blocked.sent).toBe(false);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(onError).toHaveBeenCalled();
    });

    it('wraps navigator.sendBeacon', () => {
      const { target, sendBeacon } = makeTarget();
      expect(
        target.navigator.sendBeacon('https://app.posthog.com/e/', 'data')
      ).toBe(false);
      expect(sendBeacon).not.toHaveBeenCalled();
      expect(
        target.navigator.sendBeacon('https://games.dosminutos.es/x', 'data')
      ).toBe(true);
      expect(sendBeacon).toHaveBeenCalledTimes(1);
    });
  });
});
