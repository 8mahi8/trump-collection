import test from 'node:test';
import assert from 'node:assert/strict';
import {createShinkei} from '../games.mjs';
import {ROOM_PROTOCOL, createMemoryAuthority,makeRoomCommand} from '../online/memory-authority.mjs';

const H='host-unique-id', G='guest-unique-id', CODE='48261';
function setup(seed=123) {
  const room=createMemoryAuthority({roomCode:CODE,hostId:H,seedSource:()=>seed});
  let n=0;
  const cmd=(actor,type,extra={},over={}) => {
    const a=makeRoomCommand(room.publicView(),actor,type,'action-'+(++n),extra);
    return room.apply({...a,...over});
  };
  return {room,cmd};
}
function joined(seed=123){
  const r=setup(seed);
  assert.equal(r.cmd(G,'join').ok,true);
  assert.equal(r.cmd(H,'ready',{ready:true}).ok,true);
  assert.equal(r.cmd(G,'ready',{ready:true}).ok,true);
  assert.equal(r.cmd(H,'start').ok,true);
  return r;
}

test('オンライン神経衰弱: ルーム参加・READY・開始はホストだけ',()=>{
  const {room,cmd}=setup();
  assert.equal(room.publicView().phase,'lobby');
  assert.equal(cmd(H,'start').ok,false);
  assert.equal(cmd(G,'join').ok,true);
  assert.equal(cmd('third-person-unique','join').reason,'ROOM_FULL_OR_STARTED');
  assert.equal(cmd(G,'start').ok,false);
  assert.equal(cmd(H,'ready',{ready:true}).ok,true);
  assert.equal(cmd(G,'ready',{ready:true}).ok,true);
  assert.equal(cmd(G,'start').ok,false);
  assert.equal(cmd(H,'start').ok,true);
  assert.equal(room.publicView().phase,'playing');
  assert.equal(room.publicView().cards.length,24);
});

test('オンライン神経衰弱: ホストが先に準備していてもゲストは入室可能',()=>{
  const {room,cmd}=setup();
  assert.equal(cmd(H,'ready',{ready:true}).ok,true);
  const join=cmd(G,'join',{}, {expectedRevision:0});
  assert.equal(join.ok,true);
  assert.equal(room.publicView().players.filter(p=>p.present).length,2);
});

test('オンライン神経衰弱: 伏せカードの正解・seed・IDをスナップショットに公開しない',()=>{
  const {room}=joined(29);
  const view=room.publicView();
  assert.equal(view.cards.filter(x=>x.card!==null).length,0);
  assert.ok(view.cards.every(x=>x.taken===false));
  const serialized=JSON.stringify(view);
  assert.ok(!serialized.includes(H));
  assert.ok(!serialized.includes(G));
  assert.ok(!serialized.includes('seed'));
  assert.ok(!serialized.includes('memory'));
  assert.ok(!serialized.includes('board'));
  const fresh=JSON.parse(serialized);
  fresh.cards[0].taken=true;
  assert.equal(room.publicView().cards[0].taken,false);
});

test('オンライン神経衰弱: 入力の重複・改ざん・過去revision・相手の手番は拒否',()=>{
  const {room,cmd}=joined(23);
  const view=room.publicView();
  assert.equal(cmd(G,'flip',{pos:0}).reason,'NOT_ALLOWED');
  assert.equal(cmd('stranger-id','flip',{pos:0}).reason,'NOT_IN_ROOM');
  assert.equal(cmd(H,'flip',{pos:-1}).reason,'NOT_ALLOWED');
  assert.equal(cmd(H,'flip',{pos:24}).reason,'NOT_ALLOWED');
  assert.equal(cmd(H,'flip',{pos:1.2}).reason,'NOT_ALLOWED');
  assert.equal(cmd(H,'flip',{pos:0}, {expectedRevision:view.revision-1}).reason,'STALE');
  const action=makeRoomCommand(room.publicView(),H,'flip','unique-event-2',{pos:0});
  assert.equal(room.apply(action).ok,true);
  assert.equal(room.apply(action).reason,'DUPLICATE');
  assert.equal(cmd(H,'flip',{pos:0}).reason,'NOT_ALLOWED');
});

test('オンライン神経衰弱: ミスマッチの2枚公開 → 次の手番 → 公開終了',()=>{
  const seed=44,{room,cmd}=joined(seed),board=createShinkei(seed,2).board;
  const a=0,b=board.findIndex((c,i)=>i!==a && c.card.rank!==board[a].card.rank);
  assert.equal(cmd(H,'flip',{pos:a}).ok,true);
  assert.deepEqual(room.publicView().flipped,[a]);
  assert.equal(room.publicView().cards.filter(c=>c.card).length,1);
  assert.equal(cmd(H,'flip',{pos:b}).ok,true);
  const shown=room.publicView();
  assert.equal(shown.locked,true);
  assert.equal(shown.turn,1);
  assert.equal(shown.reveal.match,false);
  assert.deepEqual(shown.reveal.positions,[a,b]);
  assert.equal(shown.cards.filter(c=>c.card!==null).length,2);
  assert.equal(cmd(G,'flip',{pos:2}).reason,'NOT_ALLOWED');
  assert.equal(room.settle(),true);
  assert.equal(room.settle(),false);
  assert.equal(room.publicView().locked,false);
  assert.equal(room.publicView().cards.filter(c=>c.card).length,0);
  assert.equal(cmd(H,'flip',{pos:2}).reason,'NOT_ALLOWED');
  assert.equal(cmd(G,'flip',{pos:2}).ok,true);
});

test('オンライン神経衰弱: 完走・リザルト・再戦で全状態をリセット',()=>{
  const seed=230,{room,cmd}=joined(seed),cards=createShinkei(seed,2).board;
  const byRank=new Map();
  cards.forEach((c,i)=>{if(!byRank.has(c.card.rank))byRank.set(c.card.rank,[]);byRank.get(c.card.rank).push(i)});
  for(const positions of byRank.values()){
    for(let j=0;j<positions.length;j+=2){
      const [a,b]=positions.slice(j,j+2);
      assert.equal(cmd(H,'flip',{pos:a}).ok,true);
      assert.equal(cmd(H,'flip',{pos:b}).ok,true);
      assert.equal(room.publicView().reveal.match,true);
      assert.equal(room.settle(),true);
    }
  }
  const end=room.publicView();
  assert.equal(end.phase,'finished');
  assert.equal(end.winner,0);
  assert.deepEqual(end.scores,[12,0]);
  assert.ok(end.cards.every(c=>c.taken));
  assert.ok(end.cards.every(c=>c.card===null));
  assert.equal(cmd(G,'rematch').reason,'NOT_ALLOWED');
  assert.equal(cmd(H,'rematch').ok,true);
  const again=room.publicView();
  assert.equal(again.phase,'lobby');
  assert.equal(again.round,1);
  assert.equal(again.cards.length,0);
  assert.equal(again.players[0].ready,false);
  assert.equal(again.players[1].ready,false);
  assert.equal(cmd(H,'start').ok,false);
});
