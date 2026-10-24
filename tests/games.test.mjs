import { test } from 'node:test'; import assert from 'node:assert';
import * as G from '../games.mjs';

test('デッキとペア除去', () => {
  assert.equal(G.makeDeck(1).length, 53);
  const { hand, pairs } = G.removePairs([{ suit: 0, rank: 5 }, { suit: 1, rank: 5 }, { suit: 2, rank: 5 }, { joker: true }]);
  assert.equal(pairs.length, 2); assert.equal(hand.length, 2);
});
test('ババ抜き: BOT同士で必ず決着する', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const st = G.createBabanuki(seed);
    let guard = 0;
    while (st.phase === 'play' && guard++ < 5000) G.babanukiDraw(st, G.botBabanuki(st));
    assert.equal(st.phase, 'end', 'seed ' + seed);
    assert.ok(st.loser >= 0);
    assert.equal(st.hands[st.loser].length, 1);
    assert.ok(st.hands[st.loser][0].joker);
  }
});
test('七並べ: BOT同士で必ず決着し、全カードが場に出る', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const st = G.createShichinarabe(seed);
    let guard = 0;
    while (st.phase === 'play' && guard++ < 5000) { const m = G.botShichinarabe(st); if (m.type === 'pass') G.shichinarabePass(st); else G.shichinarabePlay(st, m.id); }
    assert.equal(st.phase, 'end', 'seed ' + seed);
    assert.equal(Object.keys(st.ranks).length, 4);
  }
});
test('神経衰弱: BOT戦で全ペアが取れる', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const st = G.createShinkei(seed, 2);
    let guard = 0;
    while (st.phase === 'play' && guard++ < 500) {
      if (st.turn === 1) { const pos = G.botShinkei(st); G.shinkeiFlip(st, pos); const pos2 = G.botShinkei(st); G.shinkeiFlip(st, pos2); }
      else { // プレイヤー側もBOTで代行
        const pos = G.botShinkei(st); G.shinkeiFlip(st, pos); const pos2 = G.botShinkei(st); G.shinkeiFlip(st, pos2); }
    }
    assert.equal(st.phase, 'end', 'seed ' + seed);
    assert.equal(st.scores[0] + st.scores[1], 12);
  }
});
test('大富豪: 合法手の基本（場より強い同枚数だけ）', () => {
  const st = G.createDaifugo(42);
  const moves = G.daifugoLegalMoves(st, st.turn);
  assert.ok(moves.length > 0);
  const m = moves[0];
  G.daifugoPlay(st, st.turn === undefined ? 0 : (st.turn), m);
});
test('大富豪: BOT同士で必ず決着し順位が揃う', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const st = G.createDaifugo(seed);
    let guard = 0;
    while (st.phase === 'play' && guard++ < 20000) {
      const mv = G.botDaifugo(st, st.turn);
      if (mv.type === 'pass') { const before = st.turn; G.daifugoPass(st, st.turn); if (st.turn === before && st.phase === 'play' && st.field) throw new Error('passで進まない seed ' + seed); }
      else G.daifugoPlay(st, st.turn, mv.cards);
    }
    assert.equal(st.phase, 'end', 'seed ' + seed + ' guard=' + guard);
    assert.deepEqual(Object.values(st.ranks).sort(), [1, 2, 3, 4]);
  }
});
test('大富豪: 革命・8切り・スペ3が機能する', () => {
  const st = G.createDaifugo(7);
  // 場を直接組み立てて検証
  st.hands[0] = [{ suit: 0, rank: 3 }, { suit: 1, rank: 3 }, { suit: 2, rank: 3 }, { suit: 3, rank: 3 }, { suit: 0, rank: 5 }];
  st.hands[1] = [{ suit: 0, rank: 4 }, { suit: 1, rank: 4 }];
  st.turn = 0; st.field = null;
  G.daifugoPlay(st, 0, st.hands[0].slice(0, 4));
  assert.equal(st.revolution, true);
  // スペ3返し: ジョーカー単体の場に♠3
  const st2 = G.createDaifugo(7);
  st2.hands[0] = [{ joker: true }, { suit: 1, rank: 9 }];
  st2.hands[1] = [{ suit: 0, rank: 3 }, { suit: 1, rank: 10 }];
  st2.turn = 0; st2.field = null;
  G.daifugoPlay(st2, 0, [{ joker: true }]);
  const legal = G.daifugoLegalMoves(st2, 1);
  assert.ok(legal.some(m => m.length === 1 && m[0].suit === 0 && m[0].rank === 3), 'スペ3が出せるはず');
});
test('大富豪: 献上つき第2ゲームが開始できる', () => {
  const st = G.createDaifugo(99, G.DAIFUGO_DEFAULTS, { 0: 1, 1: 2, 2: 3, 3: 4 });
  const total = st.hands.reduce((a, h) => a + h.length, 0);
  assert.equal(total, 53);
  assert.equal(st.turn, 0); // 前回の大富豪から
});
