// @flow
/**
 * DSGAMES fork: upstream fetches GDevelop's catalogs (assets, objects,
 * behaviors, extensions, examples, in-app tutorials) a few seconds after the
 * editor opens. The DSGAMES editor fetches each of them only when the user
 * opens its store, so that opening the editor doesn't contact GDevelop's
 * servers (see NetworkPolicy.js).
 */
export const prefetchGDevelopCatalogs: boolean = false;
