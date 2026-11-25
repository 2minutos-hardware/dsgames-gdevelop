// @ts-check
const fs = require('fs');
const path = require('path');

/**
 * DSGAMES fork: verify that the built editor doesn't track its users.
 * Upstream GDevelop sends events to Posthog and loads a remote script
 * (resources.gdevelop.io/a/gea.js) that pulls in ad trackers. We removed
 * them in src/Utils/Analytics/EventSender.js, but a GDevelop update could
 * bring them back through another file: this looks at what actually ships.
 *
 * The game engine (GDJS/) is skipped: it is the code of the games, where
 * trackers are extensions that game creators choose to use (Firebase,
 * Facebook Instant Games...).
 *
 * Usage: node scripts/check-dsgames-privacy.js [build folder]
 */
const buildPath = path.resolve(
  process.argv[2] || path.join(__dirname, '..', 'build')
);
const skippedDirectories = ['GDJS', 'JsPlatform', 'CppPlatform'];
const forbiddenPatterns = [
  /posthog/i,
  /resources\.gdevelop\.io\/a\//,
  /\bgea\.js\b/,
  /googletagmanager\.com/,
  /google-analytics\.com/,
  /connect\.facebook\.net/,
  /analytics\.tiktok\.com/,
  /snap\.licdn\.com/,
  /static\.hotjar\.com/,
  /(platform|syndication)\.twitter\.com/,
  // Not a tracker, but it tells Google who opens the editor. (Workbox's
  // own default CDN address is left in it, unused: the smoke test checks
  // what is actually requested.)
  /fonts\.googleapis\.com/,
];

/** @param {string} directory @returns {string[]} */
const listFiles = directory =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return directory === buildPath && skippedDirectories.includes(entry.name)
        ? []
        : listFiles(entryPath);
    }
    return /\.(js|html|json)$/.test(entry.name) ? [entryPath] : [];
  });

if (!fs.existsSync(path.join(buildPath, 'index.html'))) {
  console.error(`❌ No built editor in "${buildPath}".`);
  process.exit(1);
}

const problems = [];
for (const filePath of listFiles(buildPath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      problems.push(`${path.relative(buildPath, filePath)}: ${pattern}`);
    }
  }
}

if (problems.length > 0) {
  console.error(
    '❌ The built editor contains analytics or trackers:\n' +
      problems.map(problem => `  - ${problem}`).join('\n')
  );
  process.exit(1);
}
console.info('✅ No analytics or trackers in the built editor.');
