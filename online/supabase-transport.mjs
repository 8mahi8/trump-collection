// オンライン用Transport adapter（未接続）。実プロジェクトを自動設定しない。
// Supabase Realtime Broadcast のprivate channel + 認証済みクライアントを前提とする。
// このモジュールだけではRLS/参加席の本人認証は成立しない。
import {ROOM_CODE_PATTERN,ROOM_PROTOCOL} from './memory-authority.mjs';

export async function openSupabaseTransport({client,roomCode,onMessage,timeoutMs=9000}) {
  if (!client || typeof client.channel !== 'function' || typeof client.removeChannel !== 'function')
    throw Error('Supabase client is required');
  if (!ROOM_CODE_PATTERN.test(roomCode)) throw Error('Invalid room code');
  if (typeof onMessage !== 'function') throw Error('onMessage callback is required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000)
    throw Error('Invalid subscribe timeout');

  // publicチャンネルにフォールバックしない。DB側のroom参加RLSが必要。
  const channel=client.channel('trump-memory-v1-'+roomCode,{
    config:{private:true,broadcast:{ack:true,self:false}}
  });
  let closed=false,subscribed=false,timer=null;
  channel.on('broadcast',{event:'tc-msg'},({payload})=>{
    if (!closed && payload && payload.protocol===ROOM_PROTOCOL && payload.roomCode===roomCode)
      onMessage(payload);
  });
  try {
    await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>reject(Error('Realtime subscription timed out')),timeoutMs);
      channel.subscribe((status,error)=>{
        if(closed)return;
        if(status==='SUBSCRIBED'){subscribed=true;clearTimeout(timer);resolve();}
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
          clearTimeout(timer);reject(Error('Realtime '+status+': '+(error?.message||'')));
        }
      });
    });
  } catch(e) {
    closed=true;clearTimeout(timer);
    await client.removeChannel(channel).catch(()=>{});
    throw e;
  }
  return {
    get connected(){return subscribed&&!closed;},
    async postMessage(packet){
      if(closed||!subscribed)throw Error('Realtime not connected');
      if(!packet||packet.protocol!==ROOM_PROTOCOL||packet.roomCode!==roomCode)
        throw Error('Invalid room packet');
      const result=await channel.send({type:'broadcast',event:'tc-msg',payload:packet});
      if(result!=='ok')throw Error('Realtime send failed: '+String(result));
    },
    async close(){
      if(closed)return;
      closed=true;subscribed=false;
      await client.removeChannel(channel);
    }
  };
}
