import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games.mjs';

const card = (suit, rank) => ({ suit, rank });
const ids = cards => cards.map(G.cardId).sort().join(',');

test('大富豪: 同じ数字の全てのスート組み合わせを出せる', () => {
  const st = G.createDaifugo(1);
  st.hands[0] = [card(0, 5), card(1, 5), card(2, 5), { joker: true }];
  st.turn = 0; st.field = null;
  const moves = G.daifugoLegalMoves(st, 0);
  const unique = new Set(moves.map(ids));
  assert.equal(unique.size, 15); // 3枚の非空部分集合7 + JOKER込み7 + JOKER単体1
  for (let suit = 0; suit < 3; suit++) {
    assert.ok(unique.has(ids([card(suit, 5)])), suit + 'の5を単独で出せる');
  }
  assert.ok(unique.has(ids([card(0, 5), card(2, 5)])), '離れたスートのペア');
  assert.ok(unique.has(ids([card(1, 5), { joker: true }])), 'ワイルドカードのペア');
});

test('大富豪: ジョーカーへのスペ3返しで場を流して連続手番', () => {
  const st = G.createDaifugo(2);
  st.turn = 1;
  st.hands[1] = [card(0, 3), card(0, 10)];
  st.field = { cards: [{ joker: true }], count: 1, value: 99, suits: new Set(), isJokerSingle: true, lastPlayer: 0 };
  assert.ok(G.daifugoLegalMoves(st, 1).some(m => ids(m) === ids([card(0, 3)])));
  G.daifugoPlay(st, 1, [card(0, 3)]);
  assert.equal(st.field, null);
  assert.equal(st.turn, 1);
  assert.match(st.lastEvent, /スペ3返し/);
});

test('大富豪: スペ3返しをOFFにするとジョーカーを返せない', () => {
  const st = G.createDaifugo(3, { ...G.DAIFUGO_DEFAULTS, spade3: false });
  st.hands[1] = [card(0, 3), card(0, 10)]; st.turn = 1;
  st.field = { cards: [{ joker: true }], count: 1, value: 99, suits: new Set(), isJokerSingle: true, lastPlayer: 0 };
  assert.equal(G.daifugoLegalMoves(st, 1).length, 0);
});

test('大富豪: 最後に出した人が上がった場合は残り全員のパスを待つ', () => {
  const st = G.createDaifugo(4);
  st.finished = [0]; st.turn = 1;
  st.field = { cards: [card(1, 9)], count: 1, value: G.rankValue(card(1, 9)), suits: new Set([1]), lastPlayer: 0 };
  st.passStreak = 0;
  G.daifugoPass(st, 1);
  G.daifugoPass(st, 2);
  assert.ok(st.field, '2人パスでは流れない');
  assert.equal(st.turn, 3);
  G.daifugoPass(st, 3);
  assert.equal(st.field, null, '残る全員がパスした後に流れる');
  assert.equal(st.turn, 1);
});

test('神経衰弱: 不正なカード位置は状態を変えずに無視', () => {
  const st = G.createShinkei(5);
  for (const pos of [-1, 24, 25, NaN, undefined]) {
    G.shinkeiFlip(st, pos);
    assert.deepEqual(st.flipped, []);
    assert.equal(st.turn, 0);
  }
});

test('大富豪: 多様な配牌でもCOM 120試合が決着', () => {
  for (let seed = 31; seed <= 150; seed++) {
    const st = G.createDaifugo(seed);
    let steps = 0;
    while (st.phase === 'play' && steps++ < 20000) {
      const move = G.botDaifugo(st, st.turn);
      if (move.type === 'pass') G.daifugoPass(st, st.turn);
      else G.daifugoPlay(st, st.turn, move.cards);
    }
    assert.equal(st.phase, 'end', 'seed=' + seed);
    assert.deepEqual(Object.values(st.ranks).sort(), [1, 2, 3, 4], 'seed=' + seed);
  }
});

test('大富豪: 縛り中はジョーカーが不足スートを代用できる', () => {
  const st = G.createDaifugo(6);
  st.hands[1] = [card(0, 10), card(3, 10), { joker: true }]; st.turn = 1;
  st.field = { cards: [card(0, 9), card(1, 9)], count: 2, value: G.rankValue(card(0, 9)), suits: new Set([0, 1]), lockSuits: new Set([0, 1]), lastPlayer: 0 };
  const options = new Set(G.daifugoLegalMoves(st, 1).map(ids));
  assert.ok(options.has(ids([card(0, 10), { joker: true }])), 'ジョーカーがハートを補える');
  assert.ok(!options.has(ids([card(0, 10), card(3, 10)])), 'クラブは縛りに反する');
});

test('大富豪COM: 最後に8を残すより先に処分して反則上がりを避ける', () => {
  const st = G.createDaifugo(71);
  st.turn = 0; st.field = null; st.hands[0] = [{ suit: 0, rank: 8 }, { suit: 1, rank: 4 }];
  const m = G.botDaifugo(st, 0);
  assert.equal(m.type, 'play');
  assert.equal(m.cards.length, 1);
  assert.equal(m.cards[0].rank, 8);
});

test('大富豪COM: 革命中はカードの強弱逆転を判断に反映する', () => {
  const st = G.createDaifugo(72);
  st.turn = 0; st.revolution = true;
  st.field = { cards: [{ suit: 2, rank: 6 }], count: 1, value: G.rankValue({ suit: 2, rank: 6 }), suits: new Set([2]), lastPlayer: 1, tempReverse: false };
  st.hands[0] = [{ suit: 0, rank: 3 }, { suit: 1, rank: 4 }, { suit: 2, rank: 5 }, { suit: 3, rank: 2 }];
  const m = G.botDaifugo(st, 0);
  assert.equal(m.type, 'play');
  assert.equal(m.cards[0].rank, 5, '革命中の合法手から相対的に弱い5を使う');
});

test('七並べCOM: 自分の連番が長く続く列を優先する', () => {
  const st = G.createShichinarabe(73);
  st.turn = 0;
  st.hands[0] = [{ suit: 0, rank: 8 }, { suit: 0, rank: 9 }, { suit: 0, rank: 10 }, { suit: 1, rank: 6 }, { suit: 3, rank: 2 }];
  const m = G.botShichinarabe(st);
  assert.equal(m.type, 'play');
  assert.equal(m.id, '0-8');
});
