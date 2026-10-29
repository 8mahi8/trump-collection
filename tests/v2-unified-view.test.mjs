import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createBabanuki,createShichinarabe,createShinkei,createDaifugo,
 babanukiNextWithCards,shichinarabeLegal,daifugoLegalMoves,cardId,shinkeiFlip
} from '../games.mjs';
import {viewFromCpu,viewFromFourPlayerRoom,GAME_SPECS} from '../v2/core/unified-view.mjs';

const factories={
 babanuki:()=>createBabanuki(42,4),
 shichinarabe:()=>createShichinarabe(42,4),
 shinkei:()=>createShinkei(42),
 daifugo:()=>createDaifugo(42)
};
const secretOf=card=>card?.joker?'JK':card.suit+'-'+card.rank;

for(const [game,create]of Object.entries(factories)){
 test('v2 CPU common-view shape and seat filtering: '+game,()=>{
  const state=create(),seat=state.turn,view=viewFromCpu({game,state,seat});
  assert.equal(view.game,game);
  assert.equal(view.phase,'playing');
  assert.equal(view.players.length,GAME_SPECS[game].seats);
  assert.equal(view.isMyTurn,true);
  assert.equal(view.players.filter(x=>x.isYou).length,1);
  assert.equal(view.players[seat].isYou,true);
  assert.ok(view.legal);
  assert.ok(view.board);
  assert.equal(view.connection.state,'local');
  if(game!=='shinkei'){
   assert.deepEqual(view.hand,state.hands[seat]);
   // A user's local ViewModel must not include the full game engine state.
   assert.equal(Object.hasOwn(view,'state'),false);
   assert.equal(Object.hasOwn(view,'hands'),false);
  }else{
   assert.deepEqual(view.hand,[]);
   assert.equal(view.board.tiles.length,24);
   assert.equal(view.board.tiles.filter(x=>x.card!==null).length,0);
   const before=state.board.map(b=>b.card);
   shinkeiFlip(state,0);
   const next=viewFromCpu({game,state,seat:0});
   assert.deepEqual(next.board.tiles[0].card,before[0]);
   assert.ok(next.board.tiles.slice(1).every(x=>x.card===null));
  }
 });
}
for(const game of ['babanuki','shichinarabe','daifugo']){
 test('v2 CPU and 4-seat room produce same card and action model: '+game,()=>{
  const st=factories[game](),seat=st.turn;
  const cpu=viewFromCpu({game,state:st,seat});
  const publicView={game,round:1,revision:7,phase:'playing',turn:seat,
   counts:st.hands.map(h=>h.length),ranks:st.ranks};
  const privateView={game,round:1,revision:7,seat,
   hand:st.hands[seat]};
  if(game==='babanuki')publicView.drawFrom=babanukiNextWithCards(st,seat);
  if(game==='shichinarabe'){
   publicView.placed=st.placed;
   publicView.passes=st.passes;
   privateView.legalIds=shichinarabeLegal(st.hands[seat],st.placed).map(cardId);
  }
  if(game==='daifugo'){
   publicView.field=st.field;
   publicView.revolution=st.revolution;
   publicView.lastEvent=st.lastEvent;
   privateView.legalMoves=daifugoLegalMoves(st,seat).map(x=>x.map(cardId));
  }
  const remote=viewFromFourPlayerRoom({game,publicView,privateView});
  assert.equal(remote.game,cpu.game);
  assert.equal(remote.phase,cpu.phase);
  assert.equal(remote.turn,cpu.turn);
  assert.deepEqual(remote.hand,cpu.hand);
  assert.deepEqual(remote.players.map(p=>p.cardCount),cpu.players.map(p=>p.cardCount));
  assert.deepEqual(remote.board,cpu.board);
  assert.deepEqual(remote.legal,cpu.legal);
  assert.equal(remote.connection.state,'connected');
  assert.equal(remote.revision,7);
  assert.ok(!Object.hasOwn(remote,'publicView'));
  assert.ok(!Object.hasOwn(remote,'privateView'));
 });
}
test('v2 refuses cross-round or revision mismatches before drawing',()=>{
 const st=createShichinarabe(91,4);
 const publicView={game:'shichinarabe',phase:'playing',revision:9,round:2,counts:st.hands.map(h=>h.length)};
 assert.throws(()=>viewFromFourPlayerRoom({game:'shichinarabe',publicView,
  privateView:{game:'shichinarabe',revision:8,round:2,seat:0}}),/OUT_OF_SYNC_VIEW/);
 assert.throws(()=>viewFromFourPlayerRoom({game:'shichinarabe',publicView,
  privateView:{game:'shichinarabe',revision:9,round:1,seat:0}}),/OUT_OF_SYNC_VIEW/);
});
test('v2 does not leak hidden cards of opponents in player list',()=>{
 const st=createDaifugo(812);
 const seat=0;
 const view=viewFromCpu({game:'daifugo',state:st,seat});
 // Explicitly check that all cards in the view's hand are our cards;
 // no serialized field contains a raw opponent hand property.
 const data=JSON.stringify(view);
 assert.ok(!data.includes('"hands"'));
 assert.deepEqual(view.hand.map(secretOf),st.hands[seat].map(secretOf));
 assert.equal(view.players[1].cardCount,st.hands[1].length);
});
