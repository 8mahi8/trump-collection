import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomSession} from '../v2/session/room-session.mjs';
import {createBabanuki,babanukiNextWithCards} from '../games.mjs';

test('online room guest projects into the same table view shape as CPU',async()=>{
 const state=createBabanuki(91,4),seat=state.turn;
 let revision=3,calls=0,reads=0;
 const publicView=()=>({game:'babanuki',phase:'playing',turn:seat,
  revision,round:1,drawFrom:babanukiNextWithCards(state,seat),
  counts:state.hands.map(h=>h.length),lastAction:null});
 const privateView=()=>({game:'babanuki',revision,round:1,seat,hand:state.hands[seat]});
 const guest={
  async poll(){reads++;return {status:'ready',publicView:publicView(),privateView:privateView()};},
  async act(type,extra){calls++;assert.equal(type,'draw');assert.equal(extra.index,0);
   revision++;return 'action-'+calls;},
  async receipt(){return null}
 };
 const room=createRoomSession({game:'babanuki',guest});
 let notifications=0;
 const stop=room.subscribe(v=>{notifications++;assert.equal(v.connection.state,'connected')});
 assert.equal(room.getView(),null,'no snapshot before refresh');
 assert.equal((await room.refresh()).status,'ready');
 assert.equal(notifications,1);
 const first=room.getView();
 assert.equal(first.board.kind,'draw');
 assert.equal(first.players.length,4);
 assert.equal(first.isMyTurn,true);
 assert.deepEqual(first.hand,state.hands[seat]);
 assert.equal((await room.refresh()).status,'ready');
 assert.equal(notifications,1,'unchanged revision cannot rerender');
 assert.equal(await room.dispatch({type:'draw',index:99999}),false);
 assert.equal(await room.dispatch({type:'pass'}),false);
 assert.equal(calls,0);
 const result=await room.dispatch({type:'draw',index:0});
 assert.equal(result.submitted,true);
 assert.equal(room.pending,true);
 assert.equal(await room.dispatch({type:'draw',index:0}),false,'no duplicate while awaiting ACK');
 await room.refresh();
 assert.equal(room.pending,false);
 assert.equal(notifications,2);
 assert.equal(room.getView().revision,4);
 assert.ok(reads>=3);
 stop();room.dispose();
 assert.throws(()=>room.getView(),/SESSION_DISPOSED/);
});
test('network failure and unsynchronized states do not leak partial views to renderer',async()=>{
 let status='syncing',rejected=false;
 const guest={
  async poll(){if(status==='syncing')return {status};
   return {status:'ready',publicView:{game:'babanuki',revision:2,round:0},
    privateView:{game:'babanuki',revision:1,round:0,seat:0,hand:[]}};},
  async act(){throw Error('should not submit')}
 };
 const session=createRoomSession({game:'babanuki',guest});
 assert.deepEqual(await session.refresh(),{status:'syncing'});
 assert.equal(session.getView(),null);
 status='ready';
 await assert.rejects(session.refresh(),/OUT_OF_SYNC_VIEW/);
 assert.equal(session.getView(),null);
 assert.equal(await session.dispatch({type:'draw',index:0}),false);
 session.dispose();
});
