// @ts-check
const fs = require('fs');
const path = require('path');

/**
 * DSGAMES fork: remove the trackers that third party editors bring into the
 * built editor. Run after the build, so the editors in public/external stay
 * exactly as downloaded (their folder hash is verified in
 * import-zipped-editor.js).
 *
 * - Jfxr (sound effects editor) sends a Google Analytics pageview each time
 *   it's opened. Its own code doesn't use Google Analytics, so the snippet
 *   can go.
 *
 * check-dsgames-privacy.js fails the build if anything is left.
 *
 * Usage: node scripts/dsgames-remove-trackers.js [build folder]
 */
const buildPath = path.resolve(
  process.argv[2] || path.join(__dirname, '..', 'build')
);
const jfxrIndexPath = path.join(
  buildPath,
  'external/jfxr/jfxr-editor/index.html'
);
const googleAnalyticsScript = /<script>(?:(?!<\/script>)[\s\S])*google-analytics\.com(?:(?!<\/script>)[\s\S])*<\/script>/g;

const html = fs.readFileSync(jfxrIndexPath, 'utf8');
const cleanedHtml = html.replace(googleAnalyticsScript, '');
if (cleanedHtml !== html) {
  fs.writeFileSync(jfxrIndexPath, cleanedHtml);
  console.info('✅ Removed Google Analytics from Jfxr.');
} else {
  console.info('ℹ️ No Google Analytics found in Jfxr.');
}
