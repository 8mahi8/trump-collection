import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games.mjs';
import {createFirebaseRoomHost,createFirebaseRoomGuest} from '../online/firebase-room-controller.mjs';

const IDS=['hostPlayer001','guestPlayer001','guestPlayer002','guestPlayer003'];
function fakeNetwork(){
 const state={meta:null,seats:{},joinRequests:{},public:null,private:{},commands:{},receipts:{},
   failPublishOnce:false,publishCount:0,seatWrites:0};
 const clone=v=>v===undefined?null:JSON.parse(JSON.stringify(v));
 const makeStore=uid=>({
  uid,
  async reserve(room,game){if(state.meta)throw Error('COLLISION');state.meta={hostUid:uid,game,protocol:2};},
  async meta(){return clone(state.meta)},
  async requestSeat(){state.joinRequests[uid]=true;},
  async joinRequests(){assert.equal(uid,state.meta.hostUid);return clone(state.joinRequests);},
  async grantSeat(room,who){assert.equal(uid,state.meta.hostUid);state.seats[who]=true;state.seatWrites++;},
  async seat(){return state.seats[uid]||null;},
  async publishViews(room,authority,members){
   assert.equal(uid,state.meta.hostUid);
   if(state.failPublishOnce){state.failPublishOnce=false;throw Error('SIMULATED_LOST_WRITE');}
   for(const who of members)state.private[who]=clone(authority.privateView(who));
   state.public=clone(authority.publicView());state.publishCount++;
  },
  async readPublic(){if(!state.seats[uid])throw Error('DENIED');return clone(state.public);},
  async readPrivate(){if(!state.seats[uid])throw Error('DENIED');return clone(state.private[uid]);},
  async command(room,action){
   assert.equal(action.actor,uid);
   const op=state.commands[uid]??={};
   if(op[action.actionId])throw Error('DUPLICATE');
   op[action.actionId]=clone(action);
  },
  async commands(){assert.equal(uid,state.meta.hostUid);return clone(state.commands);},
  async writeReceipt(room,who,id,data){
   assert.equal(uid,state.meta.hostUid);
   (state.receipts[who]??={})[id]=clone(data);
  },
  async removeCommand(room,who,id){
   assert.equal(uid,state.meta.hostUid);
   delete state.commands[who][id];
  },
  async receipt(room,id){return clone(state.receipts[uid]?.[id]||null);}
 });
 return {state,makeStore};
}
function setup(game,seed){
 const net=fakeNetwork(),host=createFirebaseRoomHost({
   store:net.makeStore(IDS[0]),roomCode:'28371',game,seedSource:()=>seed});
 let count=0;
 const clients=IDS.map(uid=>createFirebaseRoomGuest({store:net.makeStore(uid),roomCode:'28371',
   game,actionIdSource:()=>String(++count).padStart(6,'0')}));
 return {...net,host,clients};
}
async function readyRoom(s){
 await s.host.bootstrap();
 for(let p=1;p<4;p++)await s.clients[p].requestJoin();
 const joins=await s.host.tick();
 assert.equal(joins.accepted,3);
 assert.deepEqual(s.host.members,IDS);
 for(let p=0;p<4;p++){
   assert.equal((await s.clients[p].poll()).status,'ready');
   const id=await s.clients[p].act('ready',{ready:true});
   await s.host.tick();
   assert.equal((await s.clients[p].receipt(id)).ok,true);
 }
 await s.clients[0].poll();
 const startId=await s.clients[0].act('start');
 await s.host.tick();
 assert.equal((await s.clients[0].receipt(startId)).ok,true);
 assert.equal(s.host.authority.phase,'playing');
}
test('Firebase 4人コントローラー: JOIN→READY→START→再戦、3ゲームで対戦完走',async()=>{
 for(const game of ['babanuki','shichinarabe','daifugo']){
  const s=setup(game,67);
  await readyRoom(s);
  const rng=G.mulberry32(256);
  let steps=0;
  while(s.host.authority.phase==='playing'&&steps++<1500){
   const v=s.host.authority.publicView(),p=v.turn;
   const snapshot=await s.clients[p].poll();
   assert.equal(snapshot.status,'ready');
   const pv=snapshot.privateView;
   let kind,extra={};
   if(game==='babanuki'){
     kind='draw';extra.index=Math.floor(rng()*v.counts[v.drawFrom]);
   }else if(game==='shichinarabe'){
     kind=pv.legalIds.length?'play':'pass';
     if(kind==='play')extra.id=pv.legalIds[0];
   }else{
     kind=pv.legalMoves.length?'play':'pass';
     if(kind==='play')extra.ids=pv.legalMoves[0];
   }
   const id=await s.clients[p].act(kind,extra);
   const result=await s.host.tick();
   assert.equal(result.rejected,0,game+' '+steps);
   assert.equal((await s.clients[p].receipt(id)).ok,true);
   assert.equal(s.state.private[IDS[p]].revision,s.state.public.revision);
  }
  assert.equal(s.host.authority.phase,'finished',game+' moves '+steps);
  assert.deepEqual(Object.values(s.state.public.ranks).sort(),[1,2,3,4]);
  for(const g of s.clients){
   const v=await g.poll();assert.equal(v.status,'ready');
   assert.deepEqual(v.publicView.ranks,s.state.public.ranks);
  }
  await s.clients[0].poll();
  const rematchId=await s.clients[0].act('rematch');
  await s.host.tick();
  assert.equal((await s.clients[0].receipt(rematchId)).ok,true);
  assert.equal(s.state.public.phase,'lobby');
  assert.equal(s.state.public.round,1);
  assert.ok(s.state.public.seats.every(x=>!x.ready));
  assert.equal(s.state.seatWrites,4,'seats should not be rewritten every poll');
 }
});
test('Firebase 4人コントローラー: stale command is rejected and acknowledged',async()=>{
 const s=setup('shichinarabe',53);
 await readyRoom(s);
 await s.clients[0].poll();
 const stale=s.clients[0].snapshot;
 const actingSeat=s.host.authority.publicView().turn;
 await s.clients[actingSeat].poll();
 const move=s.clients[actingSeat].snapshot;
 const p=move.privateView;
 const firstId=await s.clients[actingSeat].act(p.legalIds.length?'play':'pass',
   p.legalIds.length?{id:p.legalIds[0]}:{});
 await s.host.tick();
 assert.equal((await s.clients[actingSeat].receipt(firstId)).ok,true);
 // Guest who already had the old snapshot sends an action.
 const other=actingSeat===0?1:0;
 const oldClient=s.clients[other];
 assert.equal(oldClient.snapshot?.publicView.revision!==undefined,true);
 const id=await oldClient.act('pass');
 await s.host.tick();
 const receipt=await oldClient.receipt(id);
 assert.equal(receipt.ok,false);
 assert.match(receipt.reason,/STALE|NOT_ALLOWED/);
});
test('Firebase 4人コントローラー: network failure after applying an action is recoverable',async()=>{
 const s=setup('babanuki',72);
 await readyRoom(s);
 const p=s.host.authority.publicView().turn;
 await s.clients[p].poll();
 const id=await s.clients[p].act('draw',{index:0});
 const old=s.host.authority.revision;
 s.state.failPublishOnce=true;
 await assert.rejects(()=>s.host.tick(),/SIMULATED_LOST_WRITE/);
 assert.equal(s.host.authority.revision,old+1);
 await s.host.tick();
 const receipt=await s.clients[p].receipt(id);
 assert.equal(receipt.ok,true);
 assert.equal(receipt.reason,'REPLAY_SYNCED');
 assert.equal(s.state.public.revision,s.host.authority.revision);
});
test('Firebase 4人コントローラー: public/private revision mismatch blocks client actions',async()=>{
 const s=setup('daifugo',45);
 await readyRoom(s);
 const p=s.host.authority.publicView().turn;
 s.state.private[IDS[p]].revision--;
 assert.equal((await s.clients[p].poll()).status,'syncing');
 await assert.rejects(()=>s.clients[p].act('pass'),/NO_SYNCED_VIEW/);
});
