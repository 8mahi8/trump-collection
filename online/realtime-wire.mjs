// Supabase Realtime WebSocket (Phoenix protocol v1) adapter.
// External JS SDK/CDNなし。別ゲームのDB/テーブル/Rulesを編集しない。
// PUBLIC broadcast only: this is a friends playtest, NOT an access-controlled private room.
export const WIRE_EVENT='trump-memory-event-v1';
export const WIRE_PREFIX='realtime:trump-memory-friends-v1-';
export function makeRealtimeWire({projectUrl,publishableKey,roomCode,onEvent=()=>{},onStatus=()=>{},Socket=globalThis.WebSocket}){
  if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/.test(projectUrl))throw Error('Invalid Supabase project URL');
  if(typeof publishableKey!=='string'||!publishableKey.startsWith('sb_publishable_'))throw Error('Only public Supabase publishable keys permitted');
  if(!/^[0-9]{5}$/.test(roomCode))throw Error('Invalid five-digit room code');
  if(typeof Socket!=='function')throw Error('WebSocket unavailable');
  const topic=WIRE_PREFIX+roomCode, endpoint=new URL(projectUrl.replace(/^https:/,'wss:').replace(/\/$/,'')+'/realtime/v1/websocket');
  endpoint.searchParams.set('apikey',publishableKey);
  endpoint.searchParams.set('vsn','1.0.0');
  let socket=null, ready=false, stopped=true, epoch=0, retry=0, ref=1, pendingPing=null;
  let connectTimer=null,retryTimer=null,heartTimer=null;
  function cleanTimers(){clearTimeout(connectTimer);clearTimeout(retryTimer);clearInterval(heartTimer);connectTimer=retryTimer=heartTimer=null;pendingPing=null;}
  function write(event,payload={},at='topic'){
    if(!socket||socket.readyState!==1)return false;
    const id=String(ref++);
    socket.send(JSON.stringify({topic:at==='phoenix'?'phoenix':topic,event,payload,ref:id,join_ref:at==='phoenix'?null:'1'}));
    return id;
  }
  function reconnect(){
    if(stopped)return;
    ready=false;cleanTimers();
    if(retry>=5){stopped=true;onStatus('failed','通信に繰り返し失敗しました。再接続を押してください');return;}
    const wait=[700,1500,3000,5000,7000][retry++];
    onStatus('reconnecting','再接続中 ('+retry+'/5)');
    retryTimer=setTimeout(open,wait);
  }
  function open(){
    if(stopped)return;
    const my=++epoch;
    let ws;
    try{ws=new Socket(endpoint.href);}catch(e){onStatus('error','WebSocketを開始できません');reconnect();return;}
    socket=ws;ready=false;ref=1;
    connectTimer=setTimeout(()=>{if(my===epoch&&socket===ws){onStatus('error','接続がタイムアウトしました');ws.close();}},10000);
    ws.onopen=()=>{
      if(my!==epoch||stopped)return;
      write('phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},private:false}});
    };
    ws.onmessage=(evt)=>{
      if(stopped||my!==epoch)return;
      let msg;try{msg=JSON.parse(evt.data)}catch{return;}
      if(msg.topic==='phoenix'&&msg.event==='phx_reply'&&msg.ref===pendingPing){pendingPing=null;return;}
      if(msg.topic!==topic)return;
      if(msg.event==='phx_reply'&&msg.ref==='1'){
        if(msg.payload?.status==='ok'){
          clearTimeout(connectTimer);connectTimer=null;ready=true;retry=0;
          onStatus('connected','通信接続OK');
          heartTimer=setInterval(()=>{
            if(pendingPing){onStatus('error','通信の応答が停止しました');ws.close();return;}
            pendingPing=write('heartbeat',{},'phoenix');
          },24000);
        }else {onStatus('error','ルーム通信に参加できません（設定を確認）');ws.close();}
      }else if(ready&&msg.event==='broadcast'&&msg.payload?.event===WIRE_EVENT&&msg.payload?.payload){
        try{onEvent(msg.payload.payload)}catch(e){onStatus('error','受信データの処理に失敗しました');}
      }else if(msg.event==='phx_error'||msg.event==='phx_close'){
        onStatus('error','通信チャンネルが終了しました');ws.close();
      }
    };
    ws.onerror=()=>{if(my===epoch&&!stopped)onStatus('error','通信エラー（ネットワークを確認）');};
    ws.onclose=()=>{if(my===epoch&&!stopped)reconnect();};
  }
  return {
    start(){if(!stopped)return;stopped=false;retry=0;open();},
    stop(){stopped=true;epoch++;ready=false;cleanTimers();const ws=socket;socket=null;try{ws?.close();}catch{}},
    send(payload){if(!ready||stopped)return false;return !!write('broadcast',{type:'broadcast',event:WIRE_EVENT,payload});},
    get connected(){return ready&&!stopped;},
    get topic(){return topic;}
  };
}
