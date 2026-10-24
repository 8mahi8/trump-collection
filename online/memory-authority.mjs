// 神経衰弱の2人対戦: host-authoritativeな状態管理。
// 通信・描画から独立。機密のカード配置はauthorityだけに置き、公開viewへ流さない。
import {createShinkei, shinkeiFlip} from '../games.mjs';

export const ROOM_PROTOCOL = 1;
export const ROOM_CODE_PATTERN = /^[0-9]{5}$/;

export function createMemoryAuthority({roomCode, hostId, seedSource = () => {
  if (!globalThis.crypto?.getRandomValues) throw Error('安全な乱数が利用できません');
  const u = new Uint32Array(1); globalThis.crypto.getRandomValues(u); return u[0];
}}) {
  if (!ROOM_CODE_PATTERN.test(roomCode)) throw Error('invalid room code');
  if (typeof hostId !== 'string' || hostId.length < 8 || hostId.length > 100) throw Error('invalid host id');
  let phase = 'lobby', revision = 0, round = 0, game = null, reveal = null;
  const seats = [{id:hostId, ready:false}, null];
  const handled = new Set();

  const response = (ok, reason = '') => ({ok, reason, revision});
  const advance = () => { revision++; return response(true); };
  function seatOf(actor) {
    return seats.findIndex(p => p && p.id === actor);
  }
  function publicView() {
    const cards = game?.board.map((b, i) => {
      const visible = game.flipped.includes(i) || reveal?.positions.includes(i);
      return {taken:b.taken, card:visible ? {suit:b.card.suit,rank:b.card.rank} : null};
    }) || [];
    return {
      protocol:ROOM_PROTOCOL,roomCode,revision,round,phase,
      players:seats.map(p => p ? {ready:p.ready,present:true} : {ready:false,present:false}),
      turn:game?.turn ?? null, scores:game ? [...game.scores] : [0,0],
      winner:phase === 'finished' ? game.winner : null,
      flipped:game?.flipped.slice() || [],reveal:reveal ? {positions:[...reveal.positions],match:reveal.match} : null,
      locked:!!reveal, cards
    };
  }
  function apply(action) {
    if (!action || action.protocol !== ROOM_PROTOCOL || action.roomCode !== roomCode ||
        typeof action.actor !== 'string' || action.actor.length > 100 ||
        typeof action.actionId !== 'string' || action.actionId.length < 4 || action.actionId.length > 120) return response(false,'INVALID');
    if (handled.has(action.actionId)) return response(false,'DUPLICATE');
    const seat = seatOf(action.actor);
    if (action.type === 'join') {
      if (seat >= 0) return response(true,'ALREADY_JOINED');
      if (phase !== 'lobby' || seats[1]) return response(false,'ROOM_FULL_OR_STARTED');
      // 入室はロビーの最新revisionを知らない初回接続でも受ける。
      // ルーム満員・対戦開始後の入室は禁止。
      seats[1] = {id:action.actor,ready:false};
      handled.add(action.actionId);return advance();
    }
    if (seat === -1) return response(false,'NOT_IN_ROOM');
    if (action.expectedRevision !== revision || action.round !== round) return response(false,'STALE');
    let ok = false;
    if (action.type === 'ready' && phase === 'lobby') {
      if (typeof action.ready !== 'boolean' || seats[seat].ready === action.ready) return response(false,'INVALID_READY');
      seats[seat].ready = action.ready; ok=true;
    } else if (action.type === 'start' && seat === 0 && phase === 'lobby' && seats.every(x => x?.ready)) {
      // 配札は一度だけホスト側で行い、カードの正解データは共有しない。
      game = createShinkei(seedSource(),2); phase='playing'; reveal=null; ok=true;
    } else if (action.type === 'flip' && phase === 'playing' && !reveal && game.turn === seat &&
               Number.isInteger(action.pos) && action.pos >= 0 && action.pos < 24 &&
               !game.board[action.pos].taken && !game.flipped.includes(action.pos)) {
      const before = game.flipped.length;
      shinkeiFlip(game,action.pos);
      if (before === 1 && game.lastPair) {
        reveal = {positions:[...game.lastPair.positions],match:game.lastResult.match};
      }
      ok=true;
    } else if (action.type === 'rematch' && phase === 'finished' && seat === 0) {
      phase='lobby'; round++; game=null; reveal=null; for(const p of seats) if(p) p.ready=false;
      ok=true;
    }
    if (!ok) return response(false,'NOT_ALLOWED');
    handled.add(action.actionId);return advance();
  }
  // revealの待機タイマーはtransport/UI側で管理。ホストしか実行しない。
  function settle() {
    if (!reveal || !game) return false;
    reveal=null;
    if (game.phase === 'end') phase='finished';
    revision++;
    return true;
  }
  return {apply,settle,publicView,seatOf,get revision(){return revision;},get round(){return round;},get phase(){return phase;}};
}

export function makeRoomCommand(view,actor,type,actionId,extra={}) {
  return {protocol:ROOM_PROTOCOL,roomCode:view.roomCode,revision:view.revision,
    expectedRevision:view.revision,round:view.round,actor,type,actionId,...extra};
}
