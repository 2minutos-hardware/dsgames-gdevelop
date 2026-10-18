//@ts-check
/// <reference path="../JsExtensionTypes.d.ts" />
/**
 * DSGAMES fork: player accounts and multiplayer rooms provided by the
 * DSGAMES play page (games.dosminutos.es). Replaces GDevelop's own
 * Multiplayer extension, which needs GDevelop's cloud services.
 * Protocol: https://games.dosminutos.es/developers/
 *
 * The file must be named "JsExtension.js", otherwise GDevelop won't load it.
 */

const INCLUDE_FILE = 'Extensions/DSGAMES/dsgamestools.js';
const ICON = 'JsPlatform/Extensions/multiplayer.svg';
const ACCOUNT_ICON = 'JsPlatform/Extensions/authentication.svg';

/** @type {ExtensionModule} */
module.exports = {
  createExtension: function (_, gd) {
    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'DSGAMES',
        _('DSGAMES'),
        _(
          'Know which DSGAMES player is playing your game, and play together with everyone else who has your game open.\n\nEvery player shares one small piece of state (a structure variable, up to 1 KB): use "Share my state" whenever it changes (calling it every frame is fine, it is sent at most 10 times per second and only when it changed), and "Copy the room to a variable" to read everyone else\'s.\n\nThis only works once the game is published on games.dosminutos.es: when testing in the editor, the conditions below are false and the room is empty.'
        ),
        'DSGAMES',
        'Open source (MIT License)'
      )
      .setShortDescription(
        'DSGAMES player accounts and real-time multiplayer rooms.'
      )
      .setCategory('Players');
    extension
      .addInstructionOrExpressionGroupMetadata(_('DSGAMES'))
      .setIcon(ICON);

    extension
      .addCondition(
        'IsRunningOnDSGAMES',
        _('Game is running on DSGAMES'),
        _(
          'Check if the game is being played on games.dosminutos.es (and not, for example, in the editor preview).'
        ),
        _('Game is running on DSGAMES'),
        _('Player'),
        ACCOUNT_ICON,
        ACCOUNT_ICON
      )
      .getCodeExtraInformation()
      .setIncludeFile(INCLUDE_FILE)
      .setFunctionName('gdjs.dsgames.isRunningOnDSGAMES');

    extension
      .addCondition(
        'IsLoggedIn',
        _('Player is logged in'),
        _('Check if the player is logged in to their DSGAMES account.'),
        _('Player is logged in to DSGAMES'),
        _('Player'),
        ACCOUNT_ICON,
        ACCOUNT_ICON
      )
      .getCodeExtraInformation()
      .setIncludeFile(INCLUDE_FILE)
      .setFunctionName('gdjs.dsgames.isLoggedIn');

    extension
      .addStrExpression(
        'Username',
        _('Username'),
        _('The DSGAMES username of the player (empty if not logged in).'),
        _('Player'),
        ACCOUNT_ICON
      )
      .getCodeExtraInformation()
      .setIncludeFile(INCLUDE_FILE)
      .setFunctionName('gdjs.dsgames.getUsername');

    extension
      .addExpression(
        'UserId',
        _('User ID'),
        _('The DSGAMES user ID of the player (0 if not logged in).'),
        _('Player'),
        ACCOUNT_ICON
      )
      .getCodeExtraInformation()
      .setIncludeFile(INCLUDE_FILE)
      .setFunctionName('gdjs.dsgames.getUserId');

    extension
      .addAction(
        'JoinRoom',
        _('Join the multiplayer room'),
        _(
          'Join the room of everyone currently playing this game. Do it once, for example at the beginning of the scene. Players who are not logged in can see the room but not share a state.'
        ),
        _('Join the DSGAMES multiplayer room'),
        _('Multiplayer'),
        ICON,
        ICON
      )
      .getCodeExtraInformation()
      .setIncludeFile(INCLUDE_FILE)
      .setFunctionName('gdjs.dsgames.joinRoom');

    extension
      .addAction(
        'ShareState',
        _('Share my state'),
        _(
          'Share the content of a variable (usually a structure, for example with X, Y and Color children) with everyone in the room. Can be used every frame: it is sent at most 10 times per second, and only when it changed. Maximum size: 1 KB.'
        ),
        _('Share _PARAM0_ as my state'),
        _('Multiplayer'),
        ICON,
        ICON
      )
      .addParameter('scenevar', _('Variable with my state'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile(INCLUDE_FILE)
      .setFunctionName('gdjs.dsgames.shareState');

    extension
      .addAction(
        'CopyPlayersToVariable',
        _('Copy the room to a variable'),
        _(
          'Fill a variable with an array of everyone in the room (including yourself). Each child has: id, username, isMe (true for you) and state (what that player shared). Loop over it with a "For each child variable" event.'
        ),
        _('Copy the room to _PARAM0_'),
        _('Multiplayer'),
        ICON,
        ICON
      )
      .addParameter('scenevar', _('Variable to fill'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile(INCLUDE_FILE)
      .setFunctionName('gdjs.dsgames.copyPlayersToVariable');

    extension
      .addExpression(
        'PlayerCount',
        _('Number of players in the room'),
        _('The number of players currently in the room, including yourself.'),
        _('Multiplayer'),
        ICON
      )
      .getCodeExtraInformation()
      .setIncludeFile(INCLUDE_FILE)
      .setFunctionName('gdjs.dsgames.getPlayerCount');

    return extension;
  },
  runExtensionSanityTests: function (gd, extension) {
    return [];
  },
};
