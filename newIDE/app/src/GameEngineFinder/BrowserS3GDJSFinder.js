// @flow
import Window from '../Utils/Window';

type FileSet =
  | 'preview'
  | 'cordova'
  | 'electron'
  | 'web'
  | 'cocos2d-js'
  | 'facebook-instant-games';

const filesToDownload: { [FileSet]: Array<string> } = {
  preview: ['/Runtime/index.html'],
  web: ['/Runtime/index.html', '/Runtime/Electron/LICENSE.GDevelop.txt'],
  'cocos2d-js': [
    '/Runtime/Cocos2d/cocos2d-js-v3.10.js',
    '/Runtime/Cocos2d/index.html',
    '/Runtime/Cocos2d/main.js',
    '/Runtime/Cocos2d/project.json',
  ],
  'facebook-instant-games': [
    '/Runtime/FacebookInstantGames/fbapp-config.json',
    '/Runtime/FacebookInstantGames/index.html',
  ],
  cordova: [
    '/Runtime/Cordova/www/index.html',
    '/Runtime/Cordova/www/LICENSE.GDevelop.txt',
    '/Runtime/Cordova/config.xml',
    '/Runtime/Cordova/package.json',
  ],
  electron: [
    '/Runtime/index.html',
    '/Runtime/Electron/main.js',
    '/Runtime/Electron/package.json',
    '/Runtime/Electron/LICENSE.GDevelop.txt',
  ],
};

export type TextFileDescriptor = {| text: string, filePath: string |};

export const findGDJS = (
  fileSet: FileSet
): Promise<{|
  gdjsRoot: string,
  filesContent: Array<TextFileDescriptor>,
|}> => {
  // DSGAMES: always use the GDJS Runtime bundled with this build (copied in
  // by `copy-GDJS-Runtime-to-build.js`, part of `npm run build`), never
  // GDevelop's own CDN. That CDN only hosts runtimes for their official
  // releases, keyed by git hash — it 403s for any commit of our own fork,
  // since we never published anything there. This also keeps the editor
  // fully self-hosted with no network dependency on gdevelop-app.com,
  // matching the rest of this fork (see also ServiceWorkerSetup.js).
  // Built with a relative "homepage" in package.json, so PUBLIC_URL is
  // the literal string "." at build time, not an absolute path — naive
  // string concatenation (`window.location.origin + PUBLIC_URL`) produces
  // a broken URL. Resolve it properly against the current document
  // instead, the same way the browser resolves this build's own relative
  // asset references (<script src="./static/js/...">).
  let gdjsRoot =
    Window.isDev() && window.location.hostname === 'localhost'
      ? // Served by `watch-serve-GDJS-runtime.js` when running the IDE locally.
        `http://localhost:5002`
      : new URL('GDJS', document.baseURI).href;

  return Promise.all(
    filesToDownload[fileSet].map(relativeFilePath => {
      const url = gdjsRoot + relativeFilePath;

      // Don't do any caching, rely on the browser cache only.
      return fetch(url).then(response => {
        if (!response.ok) {
          console.error(`Error while downloading "${url}"`, response);
          throw new Error(
            `Error while downloading "${url}" (status: ${response.status})`
          );
        }
        return response.text().then(text => ({
          filePath: url,
          text,
        }));
      });
    })
  ).then(filesContent => {
    return {
      gdjsRoot,
      filesContent,
    };
  });
};
