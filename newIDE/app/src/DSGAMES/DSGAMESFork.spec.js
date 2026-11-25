/**
 * DSGAMES fork: checks that our changes to GDevelop are still in place.
 *
 * They matter most on GDevelop updates (scripts/dsgames-update-gdevelop.sh):
 * a merge can apply without conflicts and still drop one of our changes, or
 * bring upstream's analytics back through a file we never touched.
 *
 * Not checked by Flow: it reads the repository with Node (fs, path).
 */
const fs = require('fs');
const path = require('path');
const gd = global.gd;

const repositoryRoot = path.join(__dirname, '../../../..');
const readRepositoryFile = (filePath: string): string =>
  fs.readFileSync(path.join(repositoryRoot, filePath), 'utf8');
// Extensions are outside of the files Flow checks: require them by path.
const requireRepositoryFile = (filePath: string): any =>
  require(path.join(repositoryRoot, filePath));

const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const listSourceFiles = (directory: string): Array<string> =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory())
      return entry.name === 'locales' ? [] : listSourceFiles(entryPath);
    return /\.jsx?$/.test(entry.name) ? [entryPath] : [];
  });

describe('DSGAMES fork', () => {
  describe('DSGAMES extension', () => {
    const extensionModule = requireRepositoryFile(
      'Extensions/DSGAMES/JsExtension.js'
    );
    const extensionSource = readRepositoryFile(
      'Extensions/DSGAMES/JsExtension.js'
    );
    const runtimeSource = readRepositoryFile(
      'Extensions/DSGAMES/dsgamestools.ts'
    );

    it('is declared without errors in this version of libGD', () => {
      const extension = extensionModule.createExtension(text => text, gd);
      expect(extension.getName()).toBe('DSGAMES');
      expect(extensionModule.runExtensionSanityTests(gd, extension)).toEqual(
        []
      );
      expect(
        extension
          .getAllConditions()
          .keys()
          .toJSArray()
      ).toEqual(
        expect.arrayContaining([
          'DSGAMES::IsRunningOnDSGAMES',
          'DSGAMES::IsLoggedIn',
        ])
      );
      expect(
        extension
          .getAllActions()
          .keys()
          .size()
      ).toBeGreaterThan(0);
      expect(
        extension
          .getAllExpressions()
          .keys()
          .size()
      ).toBeGreaterThan(0);
      expect(
        extension
          .getAllStrExpressions()
          .keys()
          .size()
      ).toBeGreaterThan(0);
      extension.delete();
    });

    it('only calls functions that the runtime defines', () => {
      const functionNames = Array.from(
        extensionSource.matchAll(/setFunctionName\('gdjs\.dsgames\.(\w+)'\)/g),
        match => match[1]
      );
      expect(functionNames.length).toBeGreaterThan(0);
      for (const functionName of functionNames) {
        expect(runtimeSource).toMatch(
          new RegExp(`export const ${functionName}\\b`)
        );
      }
    });

    it('is loaded by the web editor', () => {
      expect(
        readRepositoryFile(
          'newIDE/app/src/JsExtensionsLoader/BrowserJsExtensionsLoader.js'
        )
      ).toContain('Runtime/Extensions/DSGAMES/JsExtension.js');
    });

    it('is tested with the game engine', () => {
      expect(readRepositoryFile('.github/workflows/test-engine.yml')).toContain(
        'karma start karma.dsgames.conf.js'
      );
    });

    it("replaces GDevelop's Multiplayer extension, which stays hidden", () => {
      const multiplayerModule = requireRepositoryFile(
        'Extensions/Multiplayer/JsExtension.js'
      );
      const multiplayer = multiplayerModule.createExtension(text => text, gd);
      expect(multiplayer.isDeprecated()).toBe(true);
      multiplayer.delete();
    });
  });

  describe('analytics', () => {
    const eventSenderPath = 'newIDE/app/src/Utils/Analytics/EventSender.js';

    it('EventSender does not load Posthog or the remote analytics script', () => {
      const code = withoutComments(readRepositoryFile(eventSenderPath));
      expect(code).not.toMatch(/posthog/i);
      expect(code).not.toMatch(/gea\.js|https?:\/\//);
      expect(code).not.toMatch(/\bimport\s*\(/);
    });

    it("no other part of the editor uses Posthog or GDevelop's remote scripts", () => {
      const offenders = listSourceFiles(
        path.join(repositoryRoot, 'newIDE/app/src')
      )
        .filter(filePath => !filePath.endsWith('.spec.js'))
        .filter(filePath =>
          /from 'posthog-js'|require\('posthog-js'\)|posthog\.init|resources\.gdevelop\.io\/a\//.test(
            withoutComments(fs.readFileSync(filePath, 'utf8'))
          )
        )
        .map(filePath => path.relative(repositoryRoot, filePath));
      expect(offenders).toEqual([]);
    });
  });

  describe('editor', () => {
    it('uses the DSGAMES theme by default', () => {
      expect(readRepositoryFile('newIDE/app/src/UI/Theme/index.js')).toMatch(
        /defaultThemeName = 'DSGAMES'/
      );
      expect(
        readRepositoryFile('newIDE/app/src/UI/Theme/ThemeRegistry.js')
      ).toMatch(/\['DSGAMES'\]: DSGAMESTheme/);
    });

    it('serves the GDJS Runtime from its own build', () => {
      expect(
        JSON.parse(readRepositoryFile('newIDE/app/package.json')).scripts.build
      ).toContain('copy-GDJS-Runtime-to-build.js');
    });

    it('removes the trackers of third party editors from its build', () => {
      expect(
        JSON.parse(readRepositoryFile('newIDE/app/package.json')).scripts.build
      ).toContain('dsgames-remove-trackers.js');
    });

    it('registers the service worker used by "Preview"', () => {
      expect(readRepositoryFile('newIDE/app/src/index.js')).toMatch(
        /^registerBrowserSWPreviewWorker\(\);$/m
      );
    });

    it('uploads resources of local projects without a GDevelop account', () => {
      expect(
        readRepositoryFile(
          'newIDE/app/src/ResourcesList/BrowserResourceSources.js'
        )
      ).toContain('<LocalFileResourceUploader');
    });

    it('installs its network policy before anything else', () => {
      const firstImport = readRepositoryFile('newIDE/app/src/index.js').match(
        /^import .*$/m
      );
      expect(firstImport && firstImport[0]).toBe(
        "import './DSGAMES/NetworkPolicy';"
      );
    });

    it("serves Workbox itself, not from Google's CDN", () => {
      const template = readRepositoryFile(
        'newIDE/app/scripts/service-worker-template/service-worker-template.js'
      );
      expect(template).not.toContain('storage.googleapis.com');
      expect(template).toContain("importScripts('WORKBOX_DIRECTORY/");
      expect(
        readRepositoryFile('newIDE/app/scripts/make-service-worker.js')
      ).toContain('copyWorkboxLibraries');
    });

    it('downloads the libGD.js pinned for this version', () => {
      expect(readRepositoryFile('newIDE/app/scripts/import-libGD.js')).toMatch(
        /DSGAMES_PINNED_UPSTREAM_COMMIT =\s*'[0-9a-f]{40}'/
      );
    });

    // Every other file this fork changed explains its change in a "DSGAMES"
    // comment: if a file loses all of them, a merge most likely put
    // upstream's version back.
    it.each([
      'Extensions/Multiplayer/JsExtension.js',
      'newIDE/app/.gitignore',
      'newIDE/app/scripts/make-service-worker.js',
      'newIDE/app/scripts/service-worker-template/service-worker-template.js',
      'newIDE/app/src/index.js',
      'newIDE/app/public/index.html',
      'newIDE/app/src/BrowserApp.js',
      'newIDE/app/src/ExportAndShare/BrowserExporters/BrowserFileSystem.js',
      'newIDE/app/src/GameEngineFinder/BrowserS3GDJSFinder.js',
      'newIDE/app/src/MainFrame/EditorContainers/HomePage/PlaySection/UseGamesPlatformFrame.js',
      'newIDE/app/src/MainFrame/index.js',
      'newIDE/app/src/MainFrame/Preferences/PreferencesContext.js',
      'newIDE/app/src/MainFrame/TabsTitlebar.js',
      'newIDE/app/src/MainFrame/Toolbar/PreviewAndShareButtons.js',
      'newIDE/app/src/MainFrame/PublishToDSGAMESDialog.js',
      'newIDE/app/src/ResourcesList/BrowserResourceExternalEditors.js',
      'newIDE/app/src/ResourcesList/LocalFileResourceUploader.js',
      'newIDE/app/src/SceneEditor/MosaicEditorsDisplay/Toolbar.js',
      'newIDE/app/src/SceneEditor/SwipeableDrawerEditorsDisplay/Toolbar.js',
      'newIDE/app/src/ServiceWorkerSetup.js',
      'newIDE/app/src/UI/Theme/DSGAMESTheme/index.js',
      'newIDE/app/src/Utils/Analytics/EventSender.js',
    ])('keeps its DSGAMES change in %s', filePath => {
      expect(readRepositoryFile(filePath)).toContain('DSGAMES');
    });
  });
});
