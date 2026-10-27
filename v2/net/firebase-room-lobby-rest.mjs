// Protocol 3 shared-room metadata and per-UID room commands.
// Host-only lobby commits use ETag CAS. Clients NEVER PUT the lobby directly.
// This adapter requires authenticated Firebase REST tokens (not open-root trial).
const DB=/^https:\/\/[A-Za-z0-9._-]+(?:\.firebaseio\.com|\.firebasedatabase\.app)\/?$/;
const CODE=/^[0-9]{5}$/;
const UID=/^[A-Za-z0-9_-]{8,100}$/;
const REQUEST=/^[A-Za-z0-9_-]{6,60}$/;
const PATH='trumpRoomsV2';
export class LobbyStoreError extends Error {
 constructor(code,status=0){super(code);this.code=code;this.status=status;this.name='LobbyStoreError';}
}
const fail=(code,status=0)=>{throw new LobbyStoreError(code,status)};
export function createFirebaseRoomLobbyRest({databaseURL,auth,fetchImpl=globalThis.fetch}={}){
 if(typeof databaseURL!=='string'||!DB.test(databaseURL))fail('INVALID_DATABASE_URL');
 if(!auth||typeof auth.token!=='function'||!UID.test(auth.uid))fail('AUTH_REQUIRED');
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
  const token=await auth.token();
  if(typeof token!=='string'||!token)fail('AUTH_REQUIRED');
  const url=new URL(urlFor(code,sections));url.searchParams.set('auth',token);
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
 return Object.freeze({
  uid:auth.uid,
  read:code=>request('GET',code,['lobby'],null,null,true),
  async reserve(room){validate(room);return request('PUT',room.roomCode,['lobby'],room,'null_etag');},
  async commit(room,etag){validate(room);return request('PUT',room.roomCode,['lobby'],room,etag);},
  requests:code=>request('GET',code,['requests']).then(r=>r.state),
  submit:(code,id,command)=>{
   requestId(id);
   if(!command||command.protocol!==3||command.requestId!==id)fail('INVALID_REQUEST');
   return request('PUT',code,['requests',auth.uid,id],command,'null_etag');
  },
  removeRequest:(code,uid,id)=>request('DELETE',code,['requests',member(uid),requestId(id)]),
  receipt:(code,uid,id)=>request('GET',code,['receipts',member(uid),requestId(id)]).then(r=>r.state),
  writeReceipt:(code,uid,id,value)=>{
   if(typeof value?.ok!=='boolean'||!Number.isInteger(value.revision))fail('INVALID_RECEIPT');
   return request('PUT',code,['receipts',member(uid),requestId(id)],value);
  }
 });
}
