/**
 * DSGAMES fork: GDevelop's karma configuration (karma.conf.js), plus the
 * runtime of our DSGAMES extension, tested in Extensions/DSGAMES/tests.
 *
 * In a file of our own, so that GDevelop updates, which change the list of
 * files in karma.conf.js all the time, never conflict with it. Used by
 * .github/workflows/test-engine.yml:
 *   npx karma start karma.dsgames.conf.js --browsers ChromeHeadlessNoSandbox --single-run
 */
const configureGDevelopTests = require('./karma.conf.js');

const extensionTests = './Extensions/**/tests/**.spec.js';

module.exports = function (config) {
  configureGDevelopTests(config);

  const gdjsRuntimePath =
    config.gdjsRuntimePath || 'newIDE/app/resources/GDJS/Runtime';
  const files = config.files.slice();
  const extensionTestsIndex = files.indexOf(extensionTests);
  if (extensionTestsIndex === -1) {
    throw new Error(
      `karma.conf.js doesn't list "${extensionTests}" anymore: update karma.dsgames.conf.js.`
    );
  }
  // After the game engine, before the tests.
  files.splice(
    extensionTestsIndex,
    0,
    `./${gdjsRuntimePath}/Extensions/DSGAMES/dsgamestools.js`
  );
  config.set({ files });
};
