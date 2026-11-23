// @ts-check
/**
 * DSGAMES fork: the game side of the protocol with the DSGAMES play page
 * (https://games.dosminutos.es/developers/). The page is played by this
 * test's parent window, as the tests run in an iframe.
 *
 * The runtime keeps its state between tests, so they run in order: first
 * outside DSGAMES, then once the page has answered.
 */
describe('gdjs.dsgames', function () {
  const dsgames = gdjs.dsgames;
  const SEND_INTERVAL_WAIT_MS = 250;

  const receiveFromPage = (data, source = window.parent) => {
    window.dispatchEvent(new MessageEvent('message', { data, source }));
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** @type {sinon.SinonStub} */
  let postMessage;
  beforeEach(() => {
    postMessage = sinon.stub(window.parent, 'postMessage');
  });
  afterEach(() => {
    postMessage.restore();
  });
  const sentMessages = () => postMessage.getCalls().map((call) => call.args[0]);

  const makeVariable = (value) => {
    const variable = new gdjs.Variable();
    variable.fromJSObject(value);
    return variable;
  };

  describe('outside DSGAMES (editor preview)', () => {
    it('says it is not running on DSGAMES, with no player', () => {
      expect(dsgames.isRunningOnDSGAMES()).to.be(false);
      expect(dsgames.isLoggedIn()).to.be(false);
      expect(dsgames.getUsername()).to.be('');
      expect(dsgames.getUserId()).to.be(0);
      expect(dsgames.getPlayerCount()).to.be(0);
    });

    it("falls back to this device's clock", () => {
      expect(Math.abs(dsgames.getServerTime() - Date.now() / 1000)).to.be.below(
        1
      );
    });

    it('does not share any state before the player is known', async () => {
      dsgames.shareState(makeVariable({ x: 1 }));
      await wait(SEND_INTERVAL_WAIT_MS);
      expect(sentMessages()).to.eql([]);
    });

    it('ignores messages that do not come from the page', () => {
      receiveFromPage(
        { type: 'dsgames:identity', user: { id: 666, username: 'mallory' } },
        window
      );
      expect(dsgames.isRunningOnDSGAMES()).to.be(false);
    });
  });

  describe('on DSGAMES', () => {
    it('knows the player once the page sends their identity', async () => {
      receiveFromPage({
        type: 'dsgames:identity',
        user: { id: 7, username: 'ana' },
      });
      expect(dsgames.isRunningOnDSGAMES()).to.be(true);
      expect(dsgames.isLoggedIn()).to.be(true);
      expect(dsgames.getUsername()).to.be('ana');
      expect(dsgames.getUserId()).to.be(7);

      // The state shared before the page answered goes out now.
      await wait(SEND_INTERVAL_WAIT_MS);
      expect(sentMessages()).to.eql([
        { type: 'dsgames:state-set', state: { x: 1 } },
      ]);
    });

    it('subscribes to the room only once', () => {
      dsgames.joinRoom();
      dsgames.joinRoom();
      expect(sentMessages()).to.eql([{ type: 'dsgames:state-subscribe' }]);
    });

    it('copies everyone in the room, with their state and sentAt', () => {
      receiveFromPage({
        type: 'dsgames:state',
        players: [
          { id: 7, username: 'ana', state: { x: 1 }, sentAt: 100.5 },
          { id: 8, username: 'luis', state: null },
        ],
      });
      expect(dsgames.getPlayerCount()).to.be(2);
      const room = new gdjs.Variable();
      dsgames.copyPlayersToVariable(room);
      expect(room.toJSObject()).to.eql([
        { id: 7, username: 'ana', isMe: true, state: { x: 1 }, sentAt: 100.5 },
        { id: 8, username: 'luis', isMe: false, state: {}, sentAt: 0 },
      ]);
    });

    it("uses the server's clock once the page sends it", () => {
      receiveFromPage({ type: 'dsgames:clock', offset: 3600 });
      expect(
        Math.abs(dsgames.getServerTime() - (Date.now() / 1000 + 3600))
      ).to.be.below(1);
    });

    it('shares a state at most once per interval, and only when it changed', async () => {
      dsgames.shareState(makeVariable({ x: 2 }));
      dsgames.shareState(makeVariable({ x: 3 }));
      await wait(SEND_INTERVAL_WAIT_MS);
      dsgames.shareState(makeVariable({ x: 3 }));
      await wait(SEND_INTERVAL_WAIT_MS);
      expect(sentMessages()).to.eql([
        { type: 'dsgames:state-set', state: { x: 3 } },
      ]);
    });

    it('wraps a value that is not a structure', async () => {
      dsgames.shareState(makeVariable(42));
      await wait(SEND_INTERVAL_WAIT_MS);
      expect(sentMessages()).to.eql([
        { type: 'dsgames:state-set', state: { value: 42 } },
      ]);
    });

    it('refuses a state above 1 KB', async () => {
      const consoleWarn = sinon.stub(console, 'warn');
      try {
        dsgames.shareState(makeVariable({ text: 'x'.repeat(2000) }));
        await wait(SEND_INTERVAL_WAIT_MS);
      } finally {
        consoleWarn.restore();
      }
      expect(sentMessages()).to.eql([]);
      expect(consoleWarn.called).to.be(true);
    });
  });
});
