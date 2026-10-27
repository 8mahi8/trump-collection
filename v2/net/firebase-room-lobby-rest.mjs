// Protocol 3 shared-room metadata and per-UID room commands.
// Host coordinator commits use ETag CAS; guests send their own commands.
// friendOnlyNoAuth is explicitly weaker: 5-digit rooms are NOT protected by
// Firebase Auth or private RTDB rules. Use scoped Rules and no personal data.
const DB=/^https:\/\/[A-Za-z0-9._-]+(?:\.firebaseio\.com|\.firebasedatabase\.app)\/?$/;
const CODE=/^[0-9]{5}$/;
const UID=/^[A-Za-z0-9_-]{8,100}$/;
const REQUEST=/^[A-Za-z0-9_-]{6,60}$/;
const PATH='trumpRoomsV2';
export class LobbyStoreError extends Error {
 constructor(code,status=0){super(code);this.code=code;this.status=status;this.name='LobbyStoreError';}
}
const fail=(code,status=0)=>{throw new LobbyStoreError(code,status)};
export function createFirebaseRoomLobbyRest({databaseURL,auth,identity,friendOnlyNoAuth=false,fetchImpl=globalThis.fetch}={}){
 if(typeof databaseURL!=='string'||!DB.test(databaseURL))fail('INVALID_DATABASE_URL');
 const peer=friendOnlyNoAuth?identity:auth;
 if(!peer||typeof peer.uid!=='string'||!UID.test(peer.uid))
  fail(friendOnlyNoAuth?'IDENTITY_REQUIRED':'AUTH_REQUIRED');
 if(!friendOnlyNoAuth&&typeof auth.token!=='function')fail('AUTH_REQUIRED');
 if(typeof fetchImpl!=='function')fail('FETCH_REQUIRED');
 const base=databaseURL.replace(/\/$/,'');
 function urlFor(roomCode,sections=[]){
  if(typeof roomCode!=='string'||!CODE.test(roomCode))fail('INVALID_ROOM_CODE');
  if(sections.some(part=>typeof part!=='string'||!(/^[A-Za-z0-9_-]{1,100}$/).test(part)))
   fail('INVALID_DATABASE_PATH');
  return base+'/'+PATH+'/'+roomCode+'/'+sections.join('/')+'.json';
 }
 // Distinguish an omitted Firebase null child from an empty array: Firebase
 // removes empty arrays, so room reads require canonical defaults.
 function normalizeRoom(value){
  if(!value)return null;
  return {...value,
   members:Array.isArray(value.members)?value.members:[],
   participants:Array.isArray(value.participants)?value.participants:[],
   ready:Array.isArray(value.ready)?value.ready:[],
   processedRequests:Array.isArray(value.processedRequests)?value.processedRequests:[],
   selectedGame:value.selectedGame??null,match:value.match??null};
 }
 async function request(method,code,sections=[],body,etag=null,etagRead=false){
  const url=new URL(urlFor(code,sections));
  if(!friendOnlyNoAuth){
   const token=await auth.token();
   if(typeof token!=='string'||!token)fail('AUTH_REQUIRED');
   url.searchParams.set('auth',token);
  }
  const headers={'Accept':'application/json'};
  if(etagRead)headers['X-Firebase-ETag']='true';
  if(method==='PUT'){
   headers['Content-Type']='application/json';
   if(etag!==null){
    if(typeof etag!=='string'||!etag)fail('ETAG_REQUIRED');
    headers['if-match']=etag;
   }
  }
  let res;
  try{res=await fetchImpl(url.toString(),{method,headers,cache:'no-store',
   ...(method==='PUT'?{body:JSON.stringify(body)}:{})});}
  catch{fail('NETWORK_ERROR')}
  if(res.status===412)fail('ROOM_CONFLICT',412);
  if(!res.ok)fail(res.status===401||res.status===403?'ROOM_PERMISSION_DENIED':'ROOM_REQUEST_FAILED',res.status);
  let state=null;
  if(method!=='DELETE'){
   try{state=await res.json()}catch{fail('INVALID_ROOM_RESPONSE')}
  }
  if(etagRead){
   const tag=res.headers.get('etag');
   if(!tag)fail('MISSING_ETAG');
   return {state:normalizeRoom(state),etag:tag};
  }
  return {state};
 }
 const validate=room=>{
  if(!room||room.protocol!==3||typeof room.roomCode!=='string'||!CODE.test(room.roomCode))
   fail('INVALID_ROOM');
 };
 const member=uid=>{if(typeof uid!=='string'||!UID.test(uid))fail('INVALID_UID');return uid;};
 const requestId=id=>{if(typeof id!=='string'||!REQUEST.test(id))fail('INVALID_REQUEST_ID');return id;};
 const matchPath=(code,id)=>{
  const prefix=code+'-m';
  const suffix=typeof id==='string'&&id.startsWith(prefix)?id.slice(prefix.length):'';
  if(!suffix||suffix[0]==='0'||!/^[0-9]+/.test(suffix)||
   suffix.match(/[0-9]+/)[0].length!==suffix.length)fail('INVALID_MATCH_ID');
  return ['matches',id];
 };
 return Object.freeze({
  uid:peer.uid,
  read:code=>request('GET',code,['lobby'],null,null,true),
  async reserve(room){validate(room);return request('PUT',room.roomCode,['lobby'],room,'null_etag');},
  async commit(room,etag){validate(room);return request('PUT',room.roomCode,['lobby'],room,etag);},
  requests:code=>request('GET',code,['requests']).then(r=>r.state),
  submit:(code,id,command)=>{
   requestId(id);
   if(!command||command.protocol!==3||command.requestId!==id)fail('INVALID_REQUEST');
   return request('PUT',code,['requests',peer.uid,id],command,'null_etag');
  },
  removeRequest:(code,uid,id)=>request('DELETE',code,['requests',member(uid),requestId(id)]),
  receipt:(code,uid,id)=>request('GET',code,['receipts',member(uid),requestId(id)]).then(r=>r.state),
  writeReceipt:(code,uid,id,value)=>{
   if(typeof value?.ok!=='boolean'||!Number.isInteger(value.revision))fail('INVALID_RECEIPT');
   return request('PUT',code,['receipts',member(uid),requestId(id)],value);
  },
  // Match state is completely separate from lobby metadata. Only host may
  // publish public/private views; Firebase Rules gate each UID's own hand.
  matchPublic:(code,matchId)=>request('GET',code,[...matchPath(code,matchId),'public']).then(r=>r.state),
  matchPrivate:(code,matchId,uid)=>request('GET',code,[...matchPath(code,matchId),'private',member(uid)]).then(r=>r.state),
  publishMatchPublic:(code,matchId,value)=>{
   if(value?.matchId!==matchId||value?.publicView?.game===undefined)fail('INVALID_MATCH_SNAPSHOT');
   return request('PUT',code,[...matchPath(code,matchId),'public'],value);
  },
  publishMatchPrivate:(code,matchId,uid,value)=>{
   if(value?.matchId!==matchId||!value?.privateView||value.privateView.game===undefined)
    fail('INVALID_MATCH_SNAPSHOT');
   return request('PUT',code,[...matchPath(code,matchId),'private',member(uid)],value);
  },
  matchCommands:(code,matchId)=>request('GET',code,[...matchPath(code,matchId),'commands']).then(r=>r.state),
  submitMatch:(code,matchId,id,value)=>{
   requestId(id);
   if(value?.protocol!==3||value?.requestId!==id||value?.matchId!==matchId)
    fail('INVALID_MATCH_COMMAND');
   return request('PUT',code,[...matchPath(code,matchId),'commands',peer.uid,id],value,'null_etag');
  },
  removeMatchCommand:(code,matchId,uid,id)=>request('DELETE',code,
   [...matchPath(code,matchId),'commands',member(uid),requestId(id)]),
  matchReceipt:(code,matchId,uid,id)=>request('GET',code,
   [...matchPath(code,matchId),'receipts',member(uid),requestId(id)]).then(r=>r.state),
  writeMatchReceipt:(code,matchId,uid,id,value)=>{
   if(typeof value?.ok!=='boolean'||!Number.isInteger(value.revision)||value.matchId!==matchId)
    fail('INVALID_MATCH_RECEIPT');
   return request('PUT',code,[...matchPath(code,matchId),'receipts',member(uid),requestId(id)],value);
  }
 });
}
