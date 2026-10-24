// トランプゲーム集 共通ロジック＋4ゲーム＋BOT（描画なし・Nodeでも動作）
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const SUITS = ['♠', '♥', '♦', '♣'];
export const SUIT_NAMES = ['スペード', 'ハート', 'ダイヤ', 'クラブ'];
export function cardId(c) { return c.joker ? 'JK' : c.suit + '-' + c.rank; }
export function makeDeck(jokers = 0) { const d = []; for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ suit: s, rank: r }); for (let i = 0; i < jokers; i++) d.push({ joker: true }); return d; }
export function shuffle(deck, rng) { const d = deck.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0;[d[i], d[j]] = [d[j], d[i]]; } return d; }
export function sortHand(hand) { return hand.slice().sort((a, b) => (a.joker ? 99 : a.suit * 100 + a.rank) - (b.joker ? 99 : b.suit * 100 + b.rank)); }
export function removePairs(hand) { // ババ抜き用: 同じ数字のペアを取り除く
  const byRank = new Map(); const rest = [];
  for (const c of hand) { if (c.joker) { rest.push(c); continue; } if (!byRank.has(c.rank)) byRank.set(c.rank, []); byRank.get(c.rank).push(c); }
  const pairs = [];
  for (const [, cs] of byRank) { const n = cs.length - (cs.length % 2); for (let i = 0; i < n; i++) pairs.push(cs[i]); for (let i = n; i < cs.length; i++) rest.push(cs[i]); }
  return { hand: rest, pairs };
}

// ============ ババ抜き ============
export function createBabanuki(seed, players = 4) {
  const rng = mulberry32(seed);
  const deck = shuffle(makeDeck(1), rng);
  const hands = Array.from({ length: players }, () => []);
  deck.forEach((c, i) => hands[i % players].push(c));
  const st = { game: 'babanuki', hands: hands.map(h => removePairs(h).hand), turn: 0, ranks: {}, finishedOrder: [], phase: 'play', loser: -1, lastDraw: null };
  st.hands.forEach((h, i) => { if (h.length === 0) { st.ranks[i] = Object.keys(st.ranks).length + 1; st.finishedOrder.push(i); } });
  while (st.hands[st.turn].length === 0) st.turn = (st.turn + 1) % players;
  return st;
}
export function babanukiNextWithCards(st, from) { let n = from; do { n = (n + 1) % st.hands.length; } while (st.hands[n].length === 0 && n !== from); return n; }
export function babanukiDraw(st, cardIndex) {
  if (st.phase !== 'play') return st;
  const me = st.turn, target = babanukiNextWithCards(st, me);
  if (target === me) { st.phase = 'end'; return st; }
  const card = st.hands[target].splice(cardIndex, 1)[0];
  st.hands[me].push(card);
  st.lastDraw = { from: target, card };
  const before = st.hands[me].length;
  st.hands[me] = removePairs(st.hands[me]).hand;
  const paired = st.hands[me].length < before;
  st.lastDraw.paired = paired;
  for (const p of [target, me]) if (st.hands[p].length === 0 && st.ranks[p] === undefined) { st.ranks[p] = Object.keys(st.ranks).length + 1; st.finishedOrder.push(p); }
  const alive = st.hands.map((h, i) => ({ h, i })).filter(o => o.h.length > 0);
  if (alive.length <= 1) { st.phase = 'end'; st.loser = alive.length ? alive[0].i : -1; if (st.loser >= 0) st.ranks[st.loser] = st.hands.length; return st; }
  st.turn = babanukiNextWithCards(st, me);
  return st;
}
export function botBabanuki(st) { const target = babanukiNextWithCards(st, st.turn); return (Math.random() * st.hands[target].length) | 0; }

// ============ 七並べ ============
export function createShichinarabe(seed, players = 4) {
  const rng = mulberry32(seed);
  const deck = shuffle(makeDeck(0), rng);
  const hands = Array.from({ length: players }, () => []);
  deck.forEach((c, i) => hands[i % players].push(c));
  const st = { game: 'shichinarabe', hands, placed: [null, null, null, null].map(() => ({ low: 8, high: 6 })), pending: [], turn: 0, passes: Array(players).fill(0), ranks: {}, out: Array(players).fill(false), phase: 'play', lastAction: null };
  // 7を最初から場に出す
  st.hands.forEach((h, p) => { st.hands[p] = h.filter(c => { if (c.rank === 7) { st.placed[c.suit] = { low: 7, high: 7 }; return false; } return true; }); });
  const d3 = st.hands.findIndex(h => h.some(c => c.suit === 2 && c.rank === 3));
  st.turn = d3 >= 0 ? d3 : 0;
  shichinarabeAutoPlace(st);
  return st;
}
function shichinarabeAutoPlace(st) { // pending（脱落者のカード）が隣接したら自動で並べる
  let moved = true;
  while (moved) { moved = false; st.pending = st.pending.filter(c => { const pl = st.placed[c.suit]; if (c.rank === pl.low - 1) { pl.low = c.rank; moved = true; return false; } if (c.rank === pl.high + 1) { pl.high = c.rank; moved = true; return false; } return true; }); }
}
export function shichinarabeLegal(hand, placed) { return hand.filter(c => c.rank === placed[c.suit].low - 1 || c.rank === placed[c.suit].high + 1); }
export function shichinarabePlay(st, id) {
  if (st.phase !== 'play') return st;
  const p = st.turn, idx = st.hands[p].findIndex(c => cardId(c) === id);
  if (idx < 0) return st;
  const c = st.hands[p][idx], pl = st.placed[c.suit];
  if (!(c.rank === pl.low - 1 || c.rank === pl.high + 1)) return st;
  st.hands[p].splice(idx, 1);
  if (c.rank === pl.low - 1) pl.low = c.rank; else pl.high = c.rank;
  st.lastAction = { player: p, type: 'play', card: c };
  shichinarabeAutoPlace(st);
  if (st.hands[p].length === 0 && st.ranks[p] === undefined) { st.ranks[p] = Object.keys(st.ranks).length + 1; }
  shichinarabeAdvance(st);
  return st;
}
export function shichinarabePass(st) {
  if (st.phase !== 'play') return st;
  const p = st.turn;
  st.passes[p]++;
  st.lastAction = { player: p, type: 'pass', count: st.passes[p] };
  if (st.passes[p] >= 4 && !st.out[p]) { // 4回目のパスで脱落：手札は pending へ
    st.out[p] = true; st.pending.push(...st.hands[p]); st.hands[p] = [];
    st.ranks[p] = 99; // 暫定（最後に最下位へ）
    shichinarabeAutoPlace(st);
  }
  shichinarabeAdvance(st);
  return st;
}
function shichinarabeAdvance(st) {
  const total = st.hands.length;
  const remaining = st.hands.map((h, i) => i).filter(i => !st.out[i] && st.hands[i].length > 0);
  if (remaining.length <= 1) { st.phase = 'end'; // 順位の正規化: 上がり順 → 最後まで残った人 → 脱落者
    const order = [];
    Object.entries(st.ranks).filter(([, v]) => v !== 99).sort((a, b) => a[1] - b[1]).forEach(([k]) => order.push(Number(k)));
    remaining.forEach(i => { if (!order.includes(i)) order.push(i); });
    st.hands.forEach((h, i) => { if (st.out[i] && !order.includes(i)) order.push(i); });
    order.forEach((p, idx) => st.ranks[p] = idx + 1);
    return;
  }
  let n = st.turn;
  do { n = (n + 1) % total; } while (st.out[n] || st.hands[n].length === 0);
  st.turn = n;
}
export function botShichinarabe(st) {
  const p = st.turn, legal = shichinarabeLegal(st.hands[p], st.placed);
  if (!legal.length) return { type: 'pass' };
  // 自分の次のカードを開ける手を優先
  legal.sort((a, b) => {
    const opens = c => st.hands[p].some(o => o.suit === c.suit && (o.rank === c.rank - 1 || o.rank === c.rank + 1)) ? 0 : 1;
    return opens(a) - opens(b);
  });
  return { type: 'play', id: cardId(legal[0]) };
}

// ============ 神経衰弱 ============
export function createShinkei(seed, difficulty = 1) {
  const rng = mulberry32(seed);
  const cards = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 6; r++) cards.push({ suit: s, rank: r });
  const board = shuffle(cards, rng).map(c => ({ card: c, taken: false }));
  return { game: 'shinkei', board, turn: 0, scores: [0, 0], flipped: [], phase: 'play', winner: -1, difficulty, memory: new Map(), lastResult: null, lastPair: null };
}
export function shinkeiObserve(st, pos) { const c = st.board[pos].card; st.memory.set(pos, c.suit + '-' + c.rank); if (st.difficulty === 0 && st.memory.size > 6) { const k = st.memory.keys().next().value; st.memory.delete(k); } if (st.difficulty === 1 && st.memory.size > 14) { const k = st.memory.keys().next().value; st.memory.delete(k); } }
export function shinkeiFlip(st, pos) {
  if (st.phase !== 'play' || !Number.isInteger(pos) || pos < 0 || pos >= st.board.length || st.board[pos].taken || st.flipped.includes(pos) || st.flipped.length >= 2) return st;
  st.flipped.push(pos); shinkeiObserve(st, pos);
  if (st.flipped.length === 2) {
    const [a, b] = st.flipped, ca = st.board[a].card, cb = st.board[b].card;
    st.lastPair = { positions: [a, b] };
    if (ca.rank === cb.rank) { st.board[a].taken = st.board[b].taken = true; st.scores[st.turn]++; st.memory.delete(a); st.memory.delete(b); st.lastResult = { match: true, player: st.turn }; st.flipped = []; }
    else { st.lastResult = { match: false, player: st.turn }; st.flipped = []; st.turn = 1 - st.turn; if (st.difficulty === 0) { /* 弱いCOMは見たカードをよく忘れる */ for (const k of [...st.memory.keys()]) if (Math.random() < 0.4) st.memory.delete(k); } }
    if (st.board.every(x => x.taken)) { st.phase = 'end'; st.winner = st.scores[0] === st.scores[1] ? -1 : (st.scores[0] > st.scores[1] ? 0 : 1); }
  }
  return st;
}
export function botShinkei(st) {
  // 既知のペアがあれば取る。なければ未知をめくり、既知と合えば取る
  const known = [...st.memory.entries()].filter(([pos]) => !st.board[pos].taken);
  if (st.flipped.length === 0) {
    const byRank = new Map();
    for (const [pos, key] of known) { const r = key.split('-')[1]; if (!byRank.has(r)) byRank.set(r, []); byRank.get(r).push(pos); }
    for (const [, ps] of byRank) if (ps.length >= 2) return ps[0];
    const unknown = st.board.map((b, i) => i).filter(i => !st.board[i].taken && !st.memory.has(i));
    return unknown.length ? unknown[(Math.random() * unknown.length) | 0] : known[0]?.[0] ?? 0;
  }
  const first = st.board[st.flipped[0]].card;
  const matchPos = known.find(([pos, key]) => pos !== st.flipped[0] && key.split('-')[1] === String(first.rank));
  if (matchPos) return matchPos[0];
  const unknown = st.board.map((b, i) => i).filter(i => !st.board[i].taken && i !== st.flipped[0] && !st.memory.has(i));
  return unknown.length ? unknown[(Math.random() * unknown.length) | 0] : known.find(([pos]) => pos !== st.flipped[0])?.[0] ?? 0;
}

// ============ 大富豪 ============
export const DAIFUGO_DEFAULTS = { eightCut: true, revolution: true, suitLock: true, spade3: true, elevenBack: true, foulFinish: true, tribute: true };
export function rankValue(c) { if (c.joker) return 13; return c.rank === 1 ? 11 : c.rank === 2 ? 12 : c.rank - 3; } // 3=0 … K=10, A=11, 2=12, JOKER=13
export function createDaifugo(seed, cfg = DAIFUGO_DEFAULTS, prevRanks = null) {
  const rng = mulberry32(seed);
  const deck = shuffle(makeDeck(1), rng);
  const hands = [[], [], [], []];
  deck.forEach((c, i) => hands[i % 4].push(c));
  const st = { game: 'daifugo', cfg, hands, turn: 0, field: null, revolution: false, ranks: {}, finished: [], fouls: [], phase: 'play', lastEvent: 'ゲーム開始', passStreak: 0, leader: 0, tributeLog: [] };
  if (prevRanks && cfg.tribute) { // 献上: 大貧民→大富豪2枚 / 貧民→富豪1枚（自動で最強を渡し、最弱を受け取る）
    const order = Object.entries(prevRanks).sort((a, b) => a[1] - b[1]).map(([k]) => Number(k)); // [大富豪, 富豪, 貧民, 大貧民]
    const exch = (from, to, n) => { const fh = hands[from].sort((a, b) => rankValue(b) - rankValue(a)); const give = fh.splice(0, n); const th = hands[to].sort((a, b) => rankValue(a) - rankValue(b)); const back = th.splice(0, n); hands[from].push(...back); hands[to].push(...give); st.tributeLog.push(`${from}→${to} ${n}枚`); };
    exch(order[3], order[0], 2); exch(order[2], order[1], 1);
    st.turn = order[0]; st.leader = order[0];
  } else { const d3 = hands.findIndex(h => h.some(c => c.suit === 2 && c.rank === 3)); st.turn = d3 >= 0 ? d3 : 0; st.leader = st.turn; }
  st.hands = st.hands.map(sortHand);
  return st;
}
function combosOf(hand) { // 同じ数字のあらゆるスートの組み合わせを列挙
  const groups = new Map(); let joker = null;
  for (const c of hand) { if (c.joker) { joker = c; continue; } if (!groups.has(c.rank)) groups.set(c.rank, []); groups.get(c.rank).push(c); }
  const out = [];
  if (joker) out.push([joker]);
  for (const [, cs] of groups) {
    // 接頭辞だけを列挙すると「♥5のみ」など合法手が消えるため、全ての非空部分集合を生成
    for (let mask = 1; mask < (1 << cs.length); mask++) {
      const subset = cs.filter((_, i) => (mask & (1 << i)) !== 0);
      out.push(subset);
      if (joker) out.push([...subset, joker]);
    }
  }
  return out;
}
export function comboInfo(cards, st) {
  const nonJ = cards.filter(c => !c.joker);
  const rank = nonJ.length ? nonJ[0].rank : null;
  const value = cards.length === 1 && cards[0].joker ? 99 : rankValue(nonJ[0]);
  const suits = new Set(nonJ.map(c => c.suit));
  return { count: cards.length, rank, value, suits, hasJoker: cards.some(c => c.joker), has8: nonJ.some(c => c.rank === 8), hasJ: nonJ.some(c => c.rank === 11) };
}
export function daifugoLegalMoves(st, p) {
  const hand = st.hands[p], cfg = st.cfg, f = st.field;
  let moves = combosOf(hand);
  if (!f) return moves;
  const rev = st.revolution !== (f.tempReverse || false); // 実効の反転状態（革命 XOR イレブンバック）
  moves = moves.filter(cs => {
    if (cs.length !== f.count) return false;
    const info = comboInfo(cs, st);
    if (cfg.spade3 && f.isJokerSingle && cs.length === 1 && !cs[0].joker && cs[0].suit === 0 && cs[0].rank === 3) return true;
    if (cfg.suitLock && f.lockSuits) { if (info.suits.size !== f.lockSuits.size || ![...info.suits].every(s => f.lockSuits.has(s))) return false; }
    if (f.value === 99) return false; // ジョーカー単体にはスペ3以外出せない
    if (info.value === 99) return true;
    return rev ? info.value < f.value : info.value > f.value;
  });
  return moves;
}
export function daifugoPlay(st, p, cards) {
  if (st.phase !== 'play' || st.turn !== p) return st;
  const legal = daifugoLegalMoves(st, p);
  const ids = cards.map(cardId).sort().join(',');
  const ok = legal.some(m => m.map(cardId).sort().join(',') === ids);
  if (!ok) return st;
  const info = comboInfo(cards, st);
  const prevField = st.field;
  const spade3Clear = !!(st.cfg.spade3 && prevField?.isJokerSingle && cards.length === 1 && !cards[0].joker && cards[0].suit === 0 && cards[0].rank === 3);
  for (const c of cards) { const i = st.hands[p].findIndex(h => cardId(h) === cardId(c)); st.hands[p].splice(i, 1); }
  let lockSuits = prevField?.lockSuits || null;
  if (st.cfg.suitLock && prevField && !prevField.lockSuits && prevField.suits && info.suits.size === prevField.suits.size && [...info.suits].every(s => prevField.suits.has(s)) && info.count === prevField.count) lockSuits = new Set(info.suits);
  st.field = { cards, count: info.count, value: info.value, suits: info.suits, lockSuits, isJokerSingle: info.count === 1 && info.hasJoker && info.rank === null, tempReverse: prevField?.tempReverse || false, lastPlayer: p };
  if (st.cfg.elevenBack && info.hasJ) st.field.tempReverse = !st.field.tempReverse;
  st.passStreak = 0;
  const events = [];
  if (st.cfg.revolution && info.count >= 4) { st.revolution = !st.revolution; events.push(st.revolution ? '革命！' : '革命鎮圧！'); }
  // 上がり判定
  if (st.hands[p].length === 0) {
    let foul = false;
    if (st.cfg.foulFinish && (info.value === 12 || info.hasJoker || (st.cfg.eightCut && info.has8))) foul = true;
    if (foul) { st.fouls.push(p); st.finished.push(p); events.push('反則上がり！ 大貧民に'); }
    else { st.finished.push(p); events.push('上がり！'); }
    if (st.finished.length >= 3) { // 順位確定: 上がり順 → 最後まで残った人 → 反則者
      const order = st.finished.filter(i => !st.fouls.includes(i));
      const lastP = [0, 1, 2, 3].find(i => !st.finished.includes(i));
      if (lastP !== undefined) order.push(lastP);
      st.fouls.forEach(i => order.push(i));
      order.forEach((pl, idx) => st.ranks[pl] = idx + 1);
      st.phase = 'end'; st.lastEvent = events.join('／'); return st; }
    if (st.finished.length === 2) { /* 残り2人のうち場のリード権は次へ */ }
  }
  // 8切り
  if (st.phase === 'play' && (spade3Clear || (st.cfg.eightCut && info.has8))) { st.field = null; st.lastEvent = (events.join('／') + (spade3Clear ? ' スペ3返し！続けて出せる' : ' 8切り！続けて出せる')).trim(); if (!st.finished.includes(p)) { st.turn = p; st.leader = p; } else { st.turn = daifugoNext(st, p); st.leader = st.turn; } return st; }
  st.lastEvent = events.join('／');
  st.turn = daifugoNext(st, p);
  return st;
}
export function daifugoPass(st, p) {
  if (st.phase !== 'play' || st.turn !== p || !st.field) return st;
  st.passStreak++;
  const activeCount = [0, 1, 2, 3].filter(i => !st.finished.includes(i)).length;
  const requiredPasses = activeCount - (st.finished.includes(st.field.lastPlayer) ? 0 : 1);
  if (st.passStreak >= requiredPasses) { // 最後に出した人が上がっている場合も、生存者全員のパスを待つ
    const leader = st.field.lastPlayer;
    st.field = null; st.passStreak = 0;
    st.turn = st.finished.includes(leader) ? daifugoNext(st, leader) : leader;
    st.leader = st.turn; st.lastEvent = '場が流れた';
  } else { st.lastEvent = 'パス'; st.turn = daifugoNext(st, p); }
  return st;
}
export function daifugoNext(st, from) { let n = from; do { n = (n + 1) % 4; } while (st.finished.includes(n)); return n; }
export function botDaifugo(st, p) {
  const moves = daifugoLegalMoves(st, p);
  if (!moves.length) return { type: 'pass' };
  const hand = st.hands[p], f = st.field;
  const infos = moves.map(m => ({ cards: m, info: comboInfo(m, st) }));
  const finishable = infos.filter(o => hand.length - o.cards.length === 0);
  const foulFinishMove = o => st.cfg.foulFinish && (o.info.value === 12 || o.info.hasJoker || (st.cfg.eightCut && o.info.has8));
  if (finishable.length) { const good = finishable.find(o => !foulFinishMove(o)); if (good) return { type: 'play', cards: good.cards }; if (!f) return { type: 'play', cards: finishable[0].cards }; return { type: 'pass' }; }
  const score = o => {
    let s = o.info.value * 2 - o.cards.length * 1.5; // 弱い・大きい組を優先
    if (o.info.value >= 12) s += 30; // 2やジョーカーは温存
    if (o.info.hasJoker) s += 25;
    if (f && o.info.has8 && st.cfg.eightCut) s -= 8; // 8切りは場を取りたいときに価値
    if (!f && o.cards.length >= 4 && st.cfg.revolution) { const handPower = hand.reduce((a, c) => a + rankValue(c), 0) / hand.length; if (handPower < 5.5) s -= 20; } // 弱い手札なら革命を狙う
    const nextP = daifugoNext(st, p);
    if (st.hands[nextP].length <= 2 && f) s -= (o.info.value) * 0.8; // 次が上がりそうなら強いカードで止める
    return s;
  };
  infos.sort((a, b) => score(a) - score(b));
  const best = infos[0];
  if (f && best.info.value >= 12 && st.hands[daifugoNext(st, p)].length > 3 && Math.random() < 0.5) return { type: 'pass' }; // 切り札は温存気味に
  return { type: 'play', cards: best.cards };
}
