import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRealtimeWire,WIRE_EVENT,WIRE_PREFIX} from '../online/realtime-wire.mjs';
const URL='https://example.supabase.co',KEY='sb_publishable_test-only-key';
const tick=()=>new Promise(r=>setTimeout(r,10));
class MockSocket {
 static sockets=[];
 constructor(url){
   this.url=url;this.sent=[];this.readyState=0;this.topic=null;
   MockSocket.sockets.push(this);
   queueMicrotask(()=>{if(this.readyState!==0)return;this.readyState=1;this.onopen?.();});
 }
 send(raw) {
   const m=JSON.parse(raw);this.sent.push(m);
   if(m.event==='phx_join'){
     this.topic=m.topic;
     queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({topic:this.topic,event:'phx_reply',ref:m.ref,payload:{status:'ok'}})}));
   }
   if(m.event==='heartbeat')queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({topic:'phoenix',event:'phx_reply',ref:m.ref,payload:{status:'ok'}})}));
   if(m.event==='broadcast'){
     for(const s of MockSocket.sockets)if(s!==this&&s.readyState===1&&s.topic===this.topic){
       queueMicrotask(()=>s.onmessage?.({data:JSON.stringify({topic:this.topic,event:'broadcast',payload:m.payload})}));
     }
   }
 }
 close(){if(this.readyState===3)return;this.readyState=3;queueMicrotask(()=>this.onclose?.());}
}
function connect(roomCode, received, statuses=[]){
 return makeRealtimeWire({projectUrl:URL,publishableKey:KEY,roomCode,Socket:MockSocket,
   onEvent:m=>received.push(m),onStatus:(kind,text)=>statuses.push(kind)});
}
test('Realtime WS: 5桁番号ごとに隔離して2人へ公開イベント配信',async()=>{
 const host=[],guest=[],other=[],status=[];
 const a=connect('12345',host,status),b=connect('12345',guest),c=connect('56789',other);
 try{
   a.start();b.start();c.start();await tick();
   assert.equal(a.connected,true);assert.equal(b.connected,true);
   assert.ok(status.includes('connected'));
   assert.equal(a.topic,WIRE_PREFIX+'12345');
   assert.equal(a.send({kind:'view',revision:1}),true);
   await tick();assert.deepEqual(guest,[{kind:'view',revision:1}]);assert.deepEqual(host,[]);assert.deepEqual(other,[]);
   assert.equal(b.send({kind:'command',type:'join'}),true);
   await tick();assert.deepEqual(host,[{kind:'command',type:'join'}]);
   const outbound=MockSocket.sockets.find(s=>s.topic===a.topic).sent.find(m=>m.event==='broadcast');
   assert.equal(outbound.payload.event,WIRE_EVENT);
 }finally{a.stop();b.stop();c.stop();}
});
test('Realtime WS: 切断後にjoinを再発行し受信を復旧',async()=>{
 const received=[],st=[];
 const a=connect('23456',received,st),b=connect('23456',[]);
 try{
   a.start();b.start();await tick();const socket=MockSocket.sockets.at(-2);
   assert.equal(a.connected,true);
   socket.close();await tick();assert.equal(a.connected,false);
   await new Promise(r=>setTimeout(r,850));
   assert.equal(a.connected,true,'should resubscribe after reconnect');
   const newJoin=MockSocket.sockets.at(-1).sent.find(m=>m.event==='phx_join');
   assert.equal(newJoin.ref,'1','reconnected phx_join must have fresh ref 1');
   assert.equal(b.send({kind:'ping',counter:3}),true);await tick();
   assert.deepEqual(received,[{kind:'ping',counter:3}]);
 }finally{a.stop();b.stop();}
});
test('Realtime WS: 停止時は送信拒否・不正接続情報を拒否',async()=>{
 assert.throws(()=>connect('1111',[]),/five-digit/);
 assert.throws(()=>makeRealtimeWire({projectUrl:URL,publishableKey:'service_role_not_allowed',roomCode:'12345',Socket:MockSocket}),/public/);
 const a=connect('34567',[]);assert.equal(a.send({kind:'invalid'}),false);
 a.start();await tick();assert.equal(a.connected,true);a.stop();
 assert.equal(a.connected,false);assert.equal(a.send({kind:'invalid'}),false);
});
