// @ts-check
/**
 * DSGAMES fork: smoke test of the built editor, in a headless Chromium.
 *
 * The unit tests check the editor's code piece by piece; this checks that
 * the built editor actually works, and what it talks to:
 *   1. the editor starts, straight into a new project (the DSGAMES toolbar
 *      button "Publish to DSGAMES" shows up);
 *   2. "Preview" opens the game (through the /browser_sw_preview/ service
 *      worker);
 *   3. the third party editors (Jfxr, Piskel, Yarn) load.
 *
 * Every request is recorded: pages, popups, workers and service workers.
 * The test fails if any of them goes to another host than the one serving
 * the editor: a tracker, or any call to GDevelop's servers, shows up here
 * whatever its name, unlike the text search of check-dsgames-privacy.js.
 *
 * Serve the build with serve.js first. Usage:
 *   node smoke-test.js [editor URL] [report folder]
 * The report folder gets network.json, the screenshots and summary.md.
 */

// Report the requests made by service workers too (the preview runs in one).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const editorUrl = process.argv[2] || 'http://127.0.0.1:8769/editor/';
const reportPath = path.resolve(process.argv[3] || 'smoke-test-report');
const allowedHosts = new Set([
  new URL(editorUrl).hostname,
  '127.0.0.1',
  'localhost',
]);
const thirdPartyEditors = [
  ['Jfxr', 'external/jfxr/jfxr-editor/index.html'],
  ['Piskel', 'external/piskel/piskel-editor/index.html'],
  ['Yarn', 'external/yarn/yarn-editor/index.html'],
];
const STARTUP_TIMEOUT_MS = 180 * 1000;
const PREVIEW_TIMEOUT_MS = 120 * 1000;
// Analytics are often sent a few seconds after a page loads.
const SETTLE_MS = 5000;

/** @type {Array<{step: string, url: string, resourceType: string, from: string}>} */
const requests = [];
/** @type {Array<{step: string, text: string}>} */
const pageErrors = [];
/** @type {Array<{step: string, error: string}>} */
const failedSteps = [];
let currentStep = 'startup';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** @param {string} url */
const isExternal = url => {
  if (!/^(https?|wss?):/.test(url)) return false; // data:, blob:...
  return !allowedHosts.has(new URL(url).hostname);
};

/**
 * @param {import('playwright').Page} page
 * @param {string} from
 */
const watchPage = (page, from) => {
  page.on('websocket', webSocket =>
    requests.push({
      step: currentStep,
      url: webSocket.url(),
      resourceType: 'websocket',
      from,
    })
  );
  page.on('pageerror', error =>
    pageErrors.push({ step: currentStep, text: String(error) })
  );
};

/**
 * @param {string} name
 * @param {() => Promise<void>} run
 */
const step = async (name, run) => {
  currentStep = name;
  console.info(`▶ ${name}`);
  try {
    await run();
    console.info(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    failedSteps.push({ step: name, error: error.message.split('\n')[0] });
  }
};

/** @param {import('playwright').Page} page @param {string} name */
const screenshot = (page, name) =>
  page
    .screenshot({ path: path.join(reportPath, `${name}.png`) })
    .catch(() => {});

(async () => {
  fs.mkdirSync(reportPath, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    locale: 'en-US',
  });
  context.on('request', request => {
    let from = 'worker';
    if (request.serviceWorker()) {
      from = 'service worker';
    } else {
      try {
        from = request.frame().url();
      } catch (error) {
        // Requests of dedicated workers have no frame.
      }
    }
    requests.push({
      step: currentStep,
      url: request.url(),
      resourceType: request.resourceType(),
      from,
    });
  });
  context.on('page', page => watchPage(page, 'popup'));

  const editor = await context.newPage();
  watchPage(editor, 'editor');

  await step('Editor starts', async () => {
    await editor.goto(editorUrl);
    await editor
      .getByText('Publish to DSGAMES')
      .first()
      .waitFor({ timeout: STARTUP_TIMEOUT_MS });
    await wait(SETTLE_MS);
    await screenshot(editor, '1-editor');
  });

  await step('Preview opens the game', async () => {
    const previewButton = editor.locator('#toolbar-preview-button');
    await previewButton.waitFor({ timeout: 30 * 1000 });
    const [preview] = await Promise.all([
      context.waitForEvent('page', { timeout: PREVIEW_TIMEOUT_MS }),
      previewButton.click(),
    ]);
    // The window opens on about:blank, then goes to the exported game.
    await preview.waitForURL(/\/browser_sw_preview\//, {
      timeout: PREVIEW_TIMEOUT_MS,
    });
    await preview.waitForLoadState('load', { timeout: PREVIEW_TIMEOUT_MS });
    // The new project's scene is empty: check the game engine runs it.
    await preview.waitForFunction(
      () => {
        const gdjs = /** @type {any} */ (window).gdjs;
        return (
          !!gdjs && !!gdjs.RuntimeGame && !!document.querySelector('canvas')
        );
      },
      null,
      { timeout: PREVIEW_TIMEOUT_MS }
    );
    await wait(SETTLE_MS);
    await screenshot(preview, '2-preview');
    await preview.close();
  });

  for (const [name, editorPath] of thirdPartyEditors) {
    await step(`${name} loads`, async () => {
      const page = await context.newPage();
      watchPage(page, name);
      const response = await page.goto(new URL(editorPath, editorUrl).href);
      if (!response || !response.ok()) {
        throw new Error(`HTTP ${response ? response.status() : 'no response'}`);
      }
      await wait(SETTLE_MS);
      await screenshot(page, `3-${name.toLowerCase()}`);
      await page.close();
    });
  }

  currentStep = 'end';
  await wait(SETTLE_MS);
  await browser.close();

  const external = requests.filter(request => isExternal(request.url));
  fs.writeFileSync(
    path.join(reportPath, 'network.json'),
    JSON.stringify({ requests, pageErrors, failedSteps }, null, 2)
  );

  const externalHosts = new Map();
  for (const request of external) {
    const host = new URL(request.url).hostname;
    if (!externalHosts.has(host)) externalHosts.set(host, []);
    externalHosts.get(host).push(request);
  }
  const summary = [
    `# Editor smoke test`,
    ``,
    `${requests.length} requests, ${external.length} to other hosts than ${[
      ...allowedHosts,
    ].join(', ')}.`,
    ``,
    ...failedSteps.map(({ step, error }) => `- ❌ ${step}: ${error}`),
    ...[...externalHosts].map(
      ([host, hostRequests]) =>
        `- 🌐 ${host}: ${hostRequests.length} requests (${[
          ...new Set(hostRequests.map(request => request.step)),
        ].join(', ')}), e.g. ${hostRequests[0].url.slice(0, 200)}`
    ),
  ].join('\n');
  fs.writeFileSync(path.join(reportPath, 'summary.md'), summary + '\n');
  console.info('\n' + summary);

  if (failedSteps.length > 0 || external.length > 0) {
    console.error('\n❌ Smoke test failed (see the report above).');
    process.exit(1);
  }
  console.info('\n✅ The editor works and only talks to its own server.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
