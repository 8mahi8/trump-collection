import test from 'node:test';
import assert from 'node:assert/strict';
import {openSupabaseTransport} from '../online/supabase-transport.mjs';
import {ROOM_PROTOCOL} from '../online/memory-authority.mjs';

function mockClient(status='SUBSCRIBED',sendResult='ok'){
 const calls={created:[],sent:[],removed:[]};let listener=null;
 const channel={
  on(type,filter,cb){assert.equal(type,'broadcast');assert.equal(filter.event,'tc-msg');listener=cb;return this;},
  subscribe(cb){queueMicrotask(()=>cb(status,status==='SUBSCRIBED'?undefined:{message:'test'}));return this;},
  async send(packet){calls.sent.push(packet);return sendResult;}
 };
 return {
  calls,channel,
  client:{channel(name,opts){calls.created.push({name,opts});return channel;},
    async removeChannel(c){calls.removed.push(c);return 'ok';}},
  deliver(payload){listener?.({payload})}
 };
}
test('Supabase transport: private channelのみ使用・カード内容を改変せず転送',async()=>{
 const mock=mockClient(),messages=[];
 const conn=await openSupabaseTransport({client:mock.client,roomCode:'48261',onMessage:m=>messages.push(m)});
 assert.equal(conn.connected,true);
 assert.equal(mock.calls.created[0].name,'trump-memory-v1-48261');
 assert.equal(mock.calls.created[0].opts.config.private,true);
 assert.equal(mock.calls.created[0].opts.config.broadcast.ack,true);
 const packet={protocol:ROOM_PROTOCOL,roomCode:'48261',kind:'view',view:{cards:[{card:null}]}};
 await conn.postMessage(packet);
 assert.deepEqual(mock.calls.sent[0],{type:'broadcast',event:'tc-msg',payload:packet});
 mock.deliver({...packet,roomCode:'00000'});
 mock.deliver({...packet,protocol:99});
 mock.deliver(packet);
 assert.deepEqual(messages,[packet]);
 await conn.close();
 assert.equal(conn.connected,false);
 assert.equal(mock.calls.removed.length,1);
 assert.rejects(()=>conn.postMessage(packet),/not connected/);
 mock.deliver(packet);
 assert.equal(messages.length,1);
});

test('Supabase transport: 接続失敗では公開モードへ切り替えず解除',async()=>{
 const mock=mockClient('CHANNEL_ERROR');
 await assert.rejects(openSupabaseTransport({client:mock.client,roomCode:'48261',onMessage:()=>{}}),/CHANNEL_ERROR/);
 assert.equal(mock.calls.created[0].opts.config.private,true);
 assert.equal(mock.calls.removed.length,1);
});
test('Supabase transport: ルーム番号不正や不一致payloadを送らない',async()=>{
 const mock=mockClient();
 await assert.rejects(openSupabaseTransport({client:mock.client,roomCode:'12',onMessage:()=>{}}),/Invalid room/);
 const conn=await openSupabaseTransport({client:mock.client,roomCode:'48261',onMessage:()=>{}});
 await assert.rejects(conn.postMessage({protocol:ROOM_PROTOCOL,roomCode:'00000'}),/Invalid room packet/);
 assert.equal(mock.calls.sent.length,0);
 await conn.close();
});
test('Supabase transport: 送信ACKが失敗したらエラーにする',async()=>{
 const mock=mockClient('SUBSCRIBED','timed out');
 const conn=await openSupabaseTransport({client:mock.client,roomCode:'48261',onMessage:()=>{}});
 await assert.rejects(conn.postMessage({protocol:ROOM_PROTOCOL,roomCode:'48261',kind:'view'}),/send failed/);
 await conn.close();
});
