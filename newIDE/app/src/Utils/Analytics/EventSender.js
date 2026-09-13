// @flow
import { type AuthenticatedUser } from '../../Profile/AuthenticatedUserContext';
import { User as FirebaseUser } from 'firebase/auth';
import { incrementProgramOpeningCount } from './LocalStats';
import { type SubscriptionAnalyticsMetadata } from '../../Profile/Subscription/SubscriptionContext';
import { type NewProjectCreationSource } from '../../ProjectCreation/NewProjectSetupDialog';

// DSGAMES: analytics fully disabled (see recordEvent below) — upstream's
// Posthog state and remote "GDevelop Editor Analytics" script loader
// (which pulled in third-party ad trackers) were removed entirely.

export const setCurrentlyRunningInAppTutorial = (
  tutorial: string | null
): string | null => tutorial;

const makeCanSendEvent = (options: {| minimumTimeBetweenEvents: number |}) => {
  const lastSentEventTimestamps = {};
  return (eventName: string) => {
    const now = Date.now();
    // $FlowFixMe[invalid-computed-prop]
    if (lastSentEventTimestamps[eventName]) {
      const timeSinceLastEvent = now - lastSentEventTimestamps[eventName];
      if (timeSinceLastEvent < options.minimumTimeBetweenEvents) {
        return false;
      }
    }
    // $FlowFixMe[prop-missing]
    lastSentEventTimestamps[eventName] = now;
    return true;
  };
};

/**
 * DSGAMES: analytics fully disabled. Upstream GDevelop sends events to
 * PostHog and to a remote script (resources.gdevelop.io/a/gea.js) that
 * loads third-party ad trackers (TikTok Pixel, Facebook Events, LinkedIn
 * Insight). We don't want any of that in a self-hosted, no-cloud editor —
 * this is now a permanent no-op instead of retrying forever every 2s
 * when those services are unreachable.
 */
const recordEvent = (name: string, metadata?: { [string]: any }) => {};

/**
 * Used once at the beginning of the app to initialize the analytics.
 * DSGAMES: disabled, see recordEvent above.
 */
export const installAnalyticsEvents = () => {};

/**
 * DSGAMES: analytics fully disabled, see recordEvent above. No-op instead
 * of upstream's identify/alias/logout calls, which reached out to Posthog
 * and the remote gea.js (ad trackers) script.
 */
export const identifyUserForAnalytics = (
  authenticatedUser: AuthenticatedUser
) => {};

export const aliasUserForAnalyticsAfterSignUp = (
  // $FlowFixMe[value-as-type]
  firebaseUser: FirebaseUser
) => {};

export const onUserLogoutForAnalytics = () => {};

export const sendProgramOpening = () => {
  incrementProgramOpeningCount();
  recordEvent('program_opening');
};

export const sendExportLaunched = (exportKind: string) => {
  recordEvent('export_launched', {
    platform: 'GDevelop JS Platform', // Hardcoded here for now
    exportKind,
  });
};

export const sendGameDetailsOpened = (options: {
  from: 'profile' | 'homepage' | 'projectManager',
}) => {
  recordEvent('game_details_opened', options);
};

export const sendExampleDetailsOpened = (slug: string) => {
  recordEvent('example-details-opened', { slug });
};

export const sendNewGameCreated = ({
  exampleUrl,
  exampleSlug,
  exampleCompositeSlug,
  creationSource,
  projectUuid,
}: {|
  exampleUrl: string,
  exampleSlug: string,
  exampleCompositeSlug: string,
  creationSource: NewProjectCreationSource,
  projectUuid: string,
|}) => {
  recordEvent('new_game_creation', {
    platform: 'GDevelop JS Platform', // Hardcoded here for now
    templateName: exampleUrl,
    exampleSlug,
    exampleCompositeSlug,
    creationSource,
    projectUuid,
  });
};

export const sendProjectOpened = (metadata: {|
  projectUuid: string,
  storageProviderName: string,
  // Milliseconds since the project file was last modified, if known. Lets analytics
  // distinguish "came back after a long time" from "reopened right away". Null when
  // the storage provider does not expose a last-modified date.
  timeSinceLastModified: number | null,
|}) => {
  recordEvent('project-opened', metadata);
};

export const sendTutorialOpened = (tutorialName: string) => {
  recordEvent('tutorial_opened', {
    tutorialName,
  });
};

export const sendInAppTutorialStarted = (metadata: {|
  tutorialId: string,
  scenario: 'startOver' | 'resume' | 'start',
  isUIRestricted: boolean,
|}) => {
  recordEvent('in-app-tutorial-started', metadata);
};

export const sendInAppTutorialExited = (metadata: {|
  tutorialId: string,
  reason: 'completed' | 'user-early-exit',
  isUIRestricted: boolean,
|}) => {
  recordEvent('in-app-tutorial-exited', metadata);
};

const patchWithCurrencyField = (options: { [string]: any }) => {
  return {
    ...options,
    currency: options.priceCurrency,
  };
};

export const sendAssetPackOpened = (options: {|
  assetPackId: string | null,
  assetPackName: string,
  assetPackTag: string | null,
  assetPackKind: 'public' | 'private' | 'unknown',
  source: 'store-home' | 'author-profile' | 'new-object',
|}) => {
  recordEvent('asset_pack_opened', options);
};

export const sendAssetPackBuyClicked = (options: {|
  assetPackId: string,
  assetPackName: string,
  assetPackTag: string,
  assetPackKind: 'public' | 'private' | 'unknown',
  priceValue: number | void,
  priceCurrency: string | void,
  usageType: string,
|}) => {
  recordEvent('asset_pack_buy_clicked', patchWithCurrencyField(options));
};

export const sendAssetPackInformationOpened = (options: {|
  assetPackId: string,
  assetPackName: string,
  assetPackKind: 'public' | 'private' | 'unknown',
  priceValue: number | void,
  priceCurrency: string | void,
|}) => {
  recordEvent('asset_pack_information_opened', patchWithCurrencyField(options));
};

export const sendGameTemplateBuyClicked = (options: {|
  gameTemplateId: string,
  gameTemplateName: string,
  gameTemplateTag: string,
  usageType: string,
  priceValue: number | void,
  priceCurrency: string | void,
|}) => {
  recordEvent('game_template_buy_clicked', patchWithCurrencyField(options));
};

export const sendGameTemplateInformationOpened = (options: {|
  gameTemplateId: string,
  gameTemplateName: string,
  source: 'store' | 'examples-list' | 'homepage' | 'web-link',
  priceValue: number | void,
  priceCurrency: string | void,
|}) => {
  recordEvent(
    'game_template_information_opened',
    patchWithCurrencyField(options)
  );
};

export const sendBundleBuyClicked = (options: {|
  bundleId: string,
  bundleName: string,
  bundleTag: string,
  usageType: string,
  priceValue: number | void,
  priceCurrency: string | void,
|}) => {
  recordEvent('bundle_buy_clicked', patchWithCurrencyField(options));
};
export const sendBundleInformationOpened = (options: {|
  bundleId: string,
  bundleName: string,
  source: 'store' | 'learn' | 'web-link',
  priceValue: number | void,
  priceCurrency: string | void,
|}) => {
  recordEvent('bundle_information_opened', patchWithCurrencyField(options));
};

export const sendCourseInformationOpened = (options: {|
  courseId: string,
  courseName: string,
  source: 'store' | 'learn',
  priceValue: number | void,
  priceCurrency: string | void,
|}) => {
  recordEvent('course_information_opened', patchWithCurrencyField(options));
};

export const sendCourseBuyClicked = (options: {|
  courseId: string,
  courseName: string,
  usageType: string,
  priceValue: number | void,
  priceCurrency: string | void,
|}) => {
  recordEvent('course_buy_clicked', patchWithCurrencyField(options));
};

export const sendUserSurveyStarted = () => {
  recordEvent('user_survey_started');
};
export const sendUserSurveyCompleted = () => {
  recordEvent('user_survey_completed');
};
export const sendUserSurveyHidden = () => {
  recordEvent('user_survey_hidden');
};

export const sendHelpSearch = (searchText: string) => {
  recordEvent('help_search', {
    searchText,
  });
};

export const sendErrorMessage = (
  message: string,
  type:
    | 'error'
    | 'error-boundary_mainframe'
    | 'error-boundary_list-search-result'
    | 'error-boundary_box-search-result'
    | 'error-boundary_app'
    | 'error-boundary_extension-loader',
  rawError: any,
  errorId: string
) => {
  recordEvent('error_message', {
    message,
    type,
    rawError,
    errorId,
  });
};

/**
 * Sent when the editor starts again after the previous session was interrupted (on mobile,
 * when the system killed the WebView or the app: see NativeAppLifecycle.js).
 */
export const sendNativeAppRestart = (metadata: { [string]: any }) => {
  recordEvent('native-app-restart', metadata);
};

/** Sent when the system warns the app that it's running low on memory. */
export const sendNativeAppMemoryWarning = (metadata: { [string]: any }) => {
  recordEvent('native-app-memory-warning', metadata);
};

export const sendSignupDone = (email: string) => {
  recordEvent('signup', {
    email,
  });
};

export const sendSubscriptionCheckDialogShown = ({
  mode,
  id,
}: {|
  mode: string,
  id: string,
|}) => {
  recordEvent('subscription-check-dialog-shown', {
    mode,
    title: id,
  });
};

export const sendSubscriptionCheckDismiss = () => {
  recordEvent('subscription-check-dialog-dismiss');
};

export type SubscriptionDialogDisplayReason =
  | 'Disable GDevelop splash at startup'
  | 'Debugger'
  | 'Hot reloading'
  | 'Preview over wifi'
  | 'Landing dialog at opening'
  | 'Leaderboard count per game limit reached'
  | 'Cloud Project limit reached'
  | 'Consult profile'
  | 'Build limit reached'
  | 'Leaderboard customization'
  | 'Generate project from prompt'
  | 'Version history'
  | 'Add collaborators on project'
  | 'Claim asset pack'
  | 'Callout in Classroom tab'
  | 'Unlock build type'
  | 'Manage subscription as teacher'
  | 'Unlock course chapter'
  | 'Account get premium'
  | 'AI requests (subscribe)'
  | 'AI requests (upgrade)'
  | 'AI requests history'
  | 'Coupon code entered'
  | 'Restore deleted project';

export type SubscriptionPlacementId =
  | 'builds'
  | 'debugger'
  | 'gdevelop-branding'
  | 'generate-from-prompt'
  | 'hot-reloading'
  | 'leaderboards-customization'
  | 'leaderboards'
  | 'max-projects-reached'
  | 'opening-from-link'
  | 'preview-wifi'
  | 'profile'
  | 'invite-collaborators'
  | 'version-history'
  | 'claim-asset-pack'
  | 'unlock-course-chapter'
  | 'account-get-premium'
  | 'education'
  | 'ai-requests'
  | 'redeem-code'
  | 'restore-deleted-project';

export const sendSubscriptionDialogShown = (
  metadata: SubscriptionAnalyticsMetadata
) => {
  recordEvent('subscription-dialog-shown', metadata);
};

export const sendAssetOpened = (options: {|
  id: string,
  name: string,
  assetPackName: string | null,
  assetPackTag: string | null,
  assetPackId: string | null,
  assetPackKind: 'public' | 'private' | 'unknown',
|}) => {
  recordEvent('asset-opened', options);
};

export const sendAssetAddedToProject = (options: {|
  id: string,
  name: string,
  assetPackName: string | null,
  assetPackTag: string | null,
  assetPackId: string | null,
  assetPackKind: 'public' | 'private' | 'unknown',
|}) => {
  recordEvent('asset-added-to-project', options);
};

export const sendExtensionDetailsOpened = (name: string) => {
  recordEvent('extension-details-opened', { name });
};

export const sendExtensionAddedToProject = (name: string) => {
  recordEvent('extension-added-to-project', { name });
};

export const sendNewObjectCreated = (name: string) => {
  recordEvent('new-object-created', { name });
};

export const sendShowcaseGameLinkOpened = (title: string, linkType: string) => {
  recordEvent('showcase-open-game-link', { title, linkType });
};

export const sendChoosePlanClicked = (metadata: {|
  planId: string | null,
  pricingSystemId: string | null,
  dialogVariant?: string,
|}) => {
  recordEvent('choose-plan-click', metadata);
};

export const sendCancelSubscriptionToChange = (metadata: {|
  planId: string,
  pricingSystemId: string | null,
|}) => {
  recordEvent('cancel-subscription-to-change', metadata);
};

const canSendExternalEditorOpened = makeCanSendEvent({
  minimumTimeBetweenEvents: 1000 * 60 * 60, // Only once per hour per external editor.
});

export const sendExternalEditorOpened = (editorName: string) => {
  if (!canSendExternalEditorOpened(editorName)) {
    return;
  }

  recordEvent('open_external_editor', { editorName });
};

export const sendBehaviorsEditorShown = (metadata: {|
  parentEditor: 'object-editor-dialog',
|}) => {
  // It would be costly to send an event for each opening of the behaviors editor.
  // We would rather have this aggregated by the app and sent as a property for the user.
  // TODO: investigate a more generic way of collecting some useful counters to understand
  // which editors are used (and how much/how long),
  // and send these as properties in the `identify` event (or in a debounced event?).
  // recordEvent('behaviors-editor-shown', metadata);
};

export const sendBehaviorAdded = (metadata: {|
  behaviorType: string,
  parentEditor: 'behaviors-editor' | 'instruction-editor-dialog',
|}) => {
  recordEvent('behavior-added', metadata);
};

export const sendCloudProjectCouldNotBeOpened = (metadata: {|
  userId: string,
  cloudProjectId: string,
|}) => {
  recordEvent('cloud-project-opening-failed', metadata);
};

export const sendEventsExtractedAsFunction = (metadata: {|
  step: 'begin' | 'end',
  parentEditor:
    | 'scene-events-editor'
    | 'extension-events-editor'
    | 'external-events-editor',
|}) => {
  recordEvent('events-extracted-as-function', metadata);
};

const canSendPreviewStarted = makeCanSendEvent({
  minimumTimeBetweenEvents: 1000 * 60 * 60 * 6, // Only once every 6 hours per preview kind (outside quick customization).
});

const canSendPreviewStartedForQuickCustomization = makeCanSendEvent({
  minimumTimeBetweenEvents: 1000 * 60 * 10, // Only once every 10 minutes per game for quick customization.
});

export const sendPreviewStarted = (metadata: {|
  projectUuid: string,
  quickCustomizationGameId: string | null,
  networkPreview: boolean,
  numberOfWindows: number,
  hotReload: boolean,
  projectDataOnlyExport: boolean,
  fullLoadingScreen: boolean,
  forceDiagnosticReport: boolean,
  previewLaunchDuration: number,
|}) => {
  if (
    metadata.quickCustomizationGameId &&
    !canSendPreviewStartedForQuickCustomization(
      metadata.quickCustomizationGameId
    )
  ) {
    return;
  }

  if (
    !metadata.quickCustomizationGameId &&
    !canSendPreviewStarted(
      JSON.stringify({
        networkPreview: metadata.networkPreview,
        hotReload: metadata.hotReload,
        projectDataOnlyExport: metadata.projectDataOnlyExport,
        fullLoadingScreen: metadata.fullLoadingScreen,
        forceDiagnosticReport: metadata.forceDiagnosticReport,
      })
    )
  ) {
    return;
  }

  recordEvent('preview-started', metadata);
};

const canSendQuickCustomizationProgress = makeCanSendEvent({
  // Send only one event per step every minute, to avoid sending too many events.
  minimumTimeBetweenEvents: 1000 * 60 * 1,
});

export const sendQuickCustomizationProgress = (metadata: {|
  stepName: string,
  sourceGameId: string,
  projectName: string,
|}) => {
  if (!canSendQuickCustomizationProgress(metadata.stepName)) {
    return;
  }

  recordEvent('quick-customization-progress', metadata);
};

export const sendSocialFollowUpdated = (
  achievementId: string,
  metadata: {| code: string |}
) => {
  recordEvent(`${achievementId}-updated`, metadata);
};

const inAppTutorialProgressLastFiredEvents: {
  [string]: {
    lastStep: number,
    nextCheckTimeoutId: TimeoutID | null,
  },
} = {};

/**
 * Register the progress of a tutorial.
 *
 * To avoid sending too many events, we only send tutorial progress analytics events
 * when some steps are reached, when the tutorial is completed,
 * or after some inactivity (more than 90 seconds).
 */
export const sendInAppTutorialProgress = ({
  step,
  tutorialId,
  isCompleted,
  isUIRestricted,
}: {|
  tutorialId: string,
  step: number,
  isCompleted: boolean,
  isUIRestricted: boolean,
|}) => {
  const immediatelyRecordEvent = (
    spentMoreThan90SecondsSinceLastStep: ?boolean
  ) => {
    // Remember the last step we sent an event for.
    inAppTutorialProgressLastFiredEvents[tutorialId] = {
      lastStep: step,
      nextCheckTimeoutId: null,
    };
    recordEvent('in-app-tutorial-external', {
      tutorialId,
      step,
      isCompleted,
      isUIRestricted,
      spentMoreThan90SecondsSinceLastStep: !!spentMoreThan90SecondsSinceLastStep,
    });

    if (isCompleted) {
      recordEvent('in-app-tutorial-completed', {
        tutorialId,
        step,
        isUIRestricted,
      });
    }
  };

  // We receive a new progress event, so we can clear the timeout used
  // to send the last event in case there is no progress.
  const lastFiredEvent = inAppTutorialProgressLastFiredEvents[tutorialId];
  if (lastFiredEvent && lastFiredEvent.nextCheckTimeoutId !== null)
    clearTimeout(lastFiredEvent.nextCheckTimeoutId);

  // Immediately send the event if the tutorial is ended or it's the first progress.
  if (isCompleted || !lastFiredEvent) {
    immediatelyRecordEvent();
    return;
  }

  // For long tutorials:
  // send an event every 30 steps, or if we had more than 30 steps since the last event.
  // This last point is important because some steps might be hidden/skipped.
  if (step % 30 === 0 || step >= lastFiredEvent.lastStep + 30) {
    immediatelyRecordEvent();
    return;
  }

  // Otherwise, continue to remember the last step that was sent, and force to send it 90 seconds
  // later if there was no more progress.
  inAppTutorialProgressLastFiredEvents[tutorialId] = {
    lastStep: lastFiredEvent.lastStep,
    nextCheckTimeoutId: setTimeout(() => immediatelyRecordEvent(true), 90000),
  };
};

export const sendAssetSwapStart = ({
  originalObjectName,
  objectType,
}: {|
  originalObjectName: string,
  objectType: string,
|}) => {
  recordEvent('asset-swap-start', {
    originalObjectName,
    objectType,
  });
};

export const sendAssetSwapFinished = ({
  originalObjectName,
  newObjectName,
  objectType,
}: {|
  originalObjectName: string,
  newObjectName: string,
  objectType: string,
|}) => {
  recordEvent('asset-swap-finished', {
    originalObjectName,
    newObjectName,
    objectType,
  });
};

const canSendPlaySectionOpened = makeCanSendEvent({
  minimumTimeBetweenEvents: 1000 * 60 * 60 * 2, // Only once every 2 hours.
});

export const sendPlaySectionOpened = () => {
  if (!canSendPlaySectionOpened('play-section-opened')) {
    return;
  }

  recordEvent('play-section-opened');
};

export const sendAiRequestStarted = (metadata: {|
  simplifiedProjectJsonLength: number,
  projectSpecificExtensionsSummaryJsonLength: number,
  payWithCredits: boolean,
  storageProviderName: string | null,
  mode: string,
  aiRequestId: string,
|}) => {
  recordEvent('ai-request-started', metadata);
};

export const sendAiRequestMessageSent = (metadata: {|
  simplifiedProjectJsonLength: number,
  projectSpecificExtensionsSummaryJsonLength: number,
  payWithCredits: boolean,
  mode: string,
  aiRequestId: string,
  outputLength: number,
|}) => {
  recordEvent('ai-request-message-sent', metadata);
};
