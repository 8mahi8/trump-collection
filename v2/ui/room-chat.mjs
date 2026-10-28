// Room-wide casual chat, restored from the previous Trump collection.
// No auth, no account, no game-state revisions and no background polling
// while the overlay is closed. Avoid sending personal or secret information.
export function flattenChat(value,members){
 const items=[];
 for(const [uid,slots] of Object.entries(value||{})){
  if(!members.includes(uid)||!slots||typeof slots!=='object')continue;
  for(const msg of Object.values(slots)){
   if(!msg||msg.actor!==uid||typeof msg.text!=='string'||
    msg.text.length>120||!msg.text.length||
    !Number.isSafeInteger(msg.time)||typeof msg.id!=='string')continue;
   items.push(msg);
  }
 }
 return items.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id)).slice(-40);
}
export function createRoomChat({top,app,getRoom,getStore}={}){
 if(!top||!app||!getRoom||!getStore)throw Error('INVALID_CHAT_UI');
 const create=(tag,cls,text='')=>{
  const e=document.createElement(tag);if(cls)e.className=cls;
  if(text)e.textContent=text;return e;
 };
 const toggle=create('button','v2-chat-toggle','💬 チャット');
 toggle.type='button';toggle.dataset.action='chat-toggle';toggle.hidden=true;
 toggle.setAttribute('aria-expanded','false');top.append(toggle);
 const panel=create('section','v2-chat-panel');panel.hidden=true;
 panel.setAttribute('aria-label','ルームチャット');
 const bar=create('div','v2-chat-bar');
 const title=create('strong','','💬 ルームチャット');
 const close=create('button','v2-chat-close','×');close.type='button';
 close.dataset.action='chat-close';close.setAttribute('aria-label','チャットを閉じる');
 bar.append(title,close);
 const note=create('div','v2-chat-note','同じ部屋の友達向け。個人情報は送らないでね');
 const history=create('div','v2-chat-history');history.setAttribute('role','log');
 history.setAttribute('aria-live','polite');
 const status=create('div','v2-chat-status','');
 const form=create('form','v2-chat-form');
 const input=create('input','v2-chat-input');input.maxLength=120;
 input.placeholder='120文字まで';input.setAttribute('aria-label','チャットメッセージ');
 const send=create('button','v2-chat-send','送信');send.type='submit';
 form.append(input,send);panel.append(bar,note,history,status,form);
 app.append(panel);
 let open=false,pollTimer=null,inflight=false,sending=false,seq=0,
  currentCode=null,lastHistory='';
 const eligible=()=>{
  const room=getRoom(),store=getStore();
  return room&&store&&room.phase!=='closed'&&
   room.members?.includes(store.uid)?{room,store}:null;
 };
 function stopPoll(){if(pollTimer!==null)clearTimeout(pollTimer);pollTimer=null;}
 function reset(){
  stopPoll();open=false;toggle.hidden=true;panel.hidden=true;
  toggle.setAttribute('aria-expanded','false');currentCode=null;
  lastHistory='';history.replaceChildren();status.textContent='';input.value='';
 }
 async function refresh(){
  if(!open||inflight)return;
  const entry=eligible();if(!entry||entry.room.roomCode!==currentCode)return;
  inflight=true;
  try{
   const raw=await entry.store.chat(currentCode);
   if(!open||currentCode!==entry.room.roomCode)return;
   const messages=flattenChat(raw,entry.room.members);
   const hash=JSON.stringify(messages);
   if(hash===lastHistory)return;
   lastHistory=hash;
   const stickToBottom=history.scrollHeight-history.scrollTop-history.clientHeight<38;
   const fragment=document.createDocumentFragment();
   for(const item of messages){
    const line=create('p','v2-chat-line');
    const label=create('b','',item.actor===entry.store.uid?'自分':
     'P'+(entry.room.members.indexOf(item.actor)+1));
    line.append(label,document.createTextNode('：'+item.text));
    fragment.append(line);
   }
   history.replaceChildren(fragment);
   if(stickToBottom)history.scrollTop=history.scrollHeight;
   status.textContent='';
  }catch(e){
   status.textContent='チャットの読み込みに失敗しました';
  }finally{inflight=false;}
 }
 function schedule(){
  stopPoll();
  if(!open)return;
  pollTimer=setTimeout(async()=>{
   await refresh();schedule();
  },2500);
 }
 function closePanel(){
  stopPoll();open=false;panel.hidden=true;
  toggle.setAttribute('aria-expanded','false');
 }
 function sync(){
  const e=eligible();
  if(!e){reset();return;}
  if(currentCode!==e.room.roomCode){closePanel();currentCode=e.room.roomCode;
   lastHistory='';history.replaceChildren();}
  toggle.hidden=false;
 }
 async function submit(event){
  event.preventDefault();
  const e=eligible(),text=input.value.trim();
  if(!e||!open||sending||text.length===0)return;
  if(text.length>120){status.textContent='120文字以内で入力してください';return;}
  sending=true;send.disabled=true;status.textContent='送信中…';
  const next=seq++,id='chat'+Date.now().toString(36)+next.toString(36);
  try{
   await e.store.sendChat(e.room.roomCode,text,next%10,id);
   input.value='';await refresh();
  }catch(err){status.textContent='送信できませんでした。もう一度試してください。';}
  finally{sending=false;send.disabled=false;}
 }
 toggle.addEventListener('click',()=>{
  if(open){closePanel();return;}
  const e=eligible();if(!e)return;
  sync();open=true;panel.hidden=false;
  toggle.setAttribute('aria-expanded','true');refresh();schedule();
 });
 close.addEventListener('click',closePanel);
 form.addEventListener('submit',submit);
 return Object.freeze({sync,reset,close:closePanel,
  get open(){return open}});
}
