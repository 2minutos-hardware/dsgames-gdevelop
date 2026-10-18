namespace gdjs {
  /**
   * Talks to the DSGAMES play page around the game (games.dosminutos.es)
   * through postMessage: the page owns the player's session and the
   * multiplayer connection, the game never connects to a server itself.
   * Protocol: https://games.dosminutos.es/developers/
   * @category Other extensions > DSGAMES
   */
  export namespace dsgames {
    type DSGamesUser = { id: number; username: string };
    type DSGamesPlayer = { id: number; username: string; state: any };

    /** The server drops anything above 20 messages/s, stay well under. */
    const SEND_INTERVAL_MS = 100;
    /** The server ignores larger states. */
    const MAX_STATE_JSON_LENGTH = 1024;

    let isOnDSGAMES = false;
    let user: DSGamesUser | null = null;
    let players: DSGamesPlayer[] = [];
    let hasJoinedRoom = false;
    let pendingStateJSON: string | null = null;
    let lastSentStateJSON: string | null = null;

    const postToPage = (message: object) => {
      if (typeof window === 'undefined' || window.parent === window) return;
      window.parent.postMessage(message, '*');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event: MessageEvent) => {
        if (event.source !== window.parent) return;
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'dsgames:identity') {
          isOnDSGAMES = true;
          user = data.user || null;
        } else if (data.type === 'dsgames:state') {
          players = Array.isArray(data.players) ? data.players : [];
        }
      });

      // The only place state is sent from: at most 10 times per second, and
      // only when it actually changed - games can "share" on every frame.
      setInterval(() => {
        if (!user || pendingStateJSON === null) return;
        if (pendingStateJSON !== lastSentStateJSON) {
          postToPage({
            type: 'dsgames:state-set',
            state: JSON.parse(pendingStateJSON),
          });
          lastSentStateJSON = pendingStateJSON;
        }
        pendingStateJSON = null;
      }, SEND_INTERVAL_MS);

      postToPage({ type: 'dsgames:hello' });
    }

    /** True once the DSGAMES play page has answered (false when testing in the editor). */
    export const isRunningOnDSGAMES = (): boolean => isOnDSGAMES;

    export const isLoggedIn = (): boolean => user !== null;

    export const getUsername = (): string => (user ? user.username : '');

    export const getUserId = (): number => (user ? user.id : 0);

    export const getPlayerCount = (): number => players.length;

    export const joinRoom = (): void => {
      if (hasJoinedRoom) return;
      hasJoinedRoom = true;
      postToPage({ type: 'dsgames:state-subscribe' });
    };

    /**
     * Share the content of a variable as this player's state. Structures are
     * sent as-is; any other value is wrapped as {"value": ...} because the
     * server only accepts JSON objects.
     */
    export const shareState = (variable: gdjs.Variable): void => {
      let state = variable.toJSObject();
      if (state === null || typeof state !== 'object' || Array.isArray(state)) {
        state = { value: state };
      }
      const stateJSON = JSON.stringify(state);
      if (stateJSON.length > MAX_STATE_JSON_LENGTH) {
        console.warn(
          `[DSGAMES] State not shared: ${stateJSON.length} characters, the limit is ${MAX_STATE_JSON_LENGTH}.`
        );
        return;
      }
      pendingStateJSON = stateJSON;
    };

    /**
     * Fill a variable with an array of everyone in the room (this player
     * included): [{id, username, isMe, state}, ...]
     */
    export const copyPlayersToVariable = (variable: gdjs.Variable): void => {
      variable.fromJSObject(
        players.map((player) => ({
          id: player.id,
          username: player.username,
          isMe: user !== null && player.id === user.id,
          state: player.state || {},
        }))
      );
    };
  }
}
