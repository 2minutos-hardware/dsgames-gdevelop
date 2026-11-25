// @ts-check
const fs = require('fs');
const path = require('path');

/**
 * DSGAMES fork: remove what makes third party editors contact other servers
 * (trackers, and resources that tell them who opened the editor). Run after
 * the build, so the editors in public/external stay exactly as downloaded
 * (their folder hash is verified in import-zipped-editor.js).
 *
 * - Jfxr (sound effects editor):
 *   - sends a Google Analytics pageview each time it's opened. Its own code
 *     doesn't use Google Analytics, so the snippet can go;
 *   - loads its fonts from Google Fonts: the page falls back to the
 *     system's fonts;
 *   - shows a "Fork me on GitHub" ribbon, an image from GitHub's servers.
 * - Yarn (dialogue editor) loads Twitter's widget, only used to show the
 *   tweets linked in a dialogue: it's replaced by an empty one, the links
 *   stay links.
 *
 * Running it twice changes nothing. check-dsgames-privacy.js fails the build
 * if any tracker is left, and the smoke test (scripts/dsgames-smoke-test)
 * fails if any request leaves the server.
 *
 * Usage: node scripts/dsgames-remove-trackers.js [build folder]
 */
const buildPath = path.resolve(
  process.argv[2] || path.join(__dirname, '..', 'build')
);

const editors = [
  {
    name: 'Jfxr',
    indexPath: 'external/jfxr/jfxr-editor/index.html',
    removals: [
      [
        'Google Analytics',
        /<script>(?:(?!<\/script>)[\s\S])*google-analytics\.com(?:(?!<\/script>)[\s\S])*<\/script>/g,
        '',
      ],
      ['Google Fonts', /<link\b[^>]*fonts\.googleapis\.com[^>]*>/g, ''],
      [
        'the GitHub ribbon',
        /<a\b[^>]*title="Fork me on GitHub"[^>]*>\s*<\/a>/g,
        '',
      ],
    ],
  },
  {
    name: 'Yarn',
    indexPath: 'external/yarn/yarn-editor/index.html',
    removals: [
      [
        "Twitter's widget",
        /<script\b[^>]*platform\.twitter\.com[^>]*>\s*<\/script>/g,
        '<script>window.twttr={widgets:{createTweet:function(){}}};</script>',
      ],
    ],
  },
];

for (const { name, indexPath, removals } of editors) {
  const filePath = path.join(buildPath, indexPath);
  let html = fs.readFileSync(filePath, 'utf8');
  for (const [what, pattern, replacement] of removals) {
    /** @type {RegExp} */ (pattern).lastIndex = 0;
    const cleanedHtml = html.replace(
      /** @type {RegExp} */ (pattern),
      /** @type {string} */ (replacement)
    );
    if (cleanedHtml !== html) {
      console.info(`✅ Removed ${what} from ${name}.`);
      html = cleanedHtml;
    } else {
      console.info(`ℹ️ ${name} doesn't have ${what}.`);
    }
  }
  fs.writeFileSync(filePath, html);
}
