// Protocol 3 room metadata ONLY. No game hands or commands belong here.
// Every write uses Firebase REST ETag conditional PUT; never overwrite blindly.
// Authenticated, host-authorized storage/rules are required before real use.
const DB=/^https:\/\/[A-Za-z0-9._-]+(?:\.firebaseio\.com|\.firebasedatabase\.app)\/?$/;
const CODE=/^[0-9]{5}$/;
const PATH='trumpRoomsV2';
export class LobbyStoreError extends Error {
 constructor(code,status=0){super(code);this.code=code;this.status=status;this.name='LobbyStoreError';}
}
const fail=(code,status=0)=>{throw new LobbyStoreError(code,status)};
export function createFirebaseRoomLobbyRest({databaseURL,auth,fetchImpl=globalThis.fetch}={}){
 if(typeof databaseURL!=='string'||!DB.test(databaseURL))fail('INVALID_DATABASE_URL');
 if(!auth||typeof auth.token!=='function'||!auth.uid)fail('AUTH_REQUIRED');
 if(typeof fetchImpl!=='function')fail('FETCH_REQUIRED');
 const base=databaseURL.replace(/\/$/,'');
 function path(roomCode){
  if(typeof roomCode!=='string'||!CODE.test(roomCode))fail('INVALID_ROOM_CODE');
  return base+'/'+PATH+'/'+roomCode+'/lobby.json';
 }
 async function request(method,code,body,etag){
  const token=await auth.token();
  if(typeof token!=='string'||!token)fail('AUTH_REQUIRED');
  const url=new URL(path(code));url.searchParams.set('auth',token);
  const headers={'Accept':'application/json'};
  if(method==='GET')headers['X-Firebase-ETag']='true';
  if(method==='PUT'){
   if(typeof etag!=='string'||!etag)fail('ETAG_REQUIRED');
   headers['if-match']=etag;
   headers['Content-Type']='application/json';
  }
  let res;
  try{res=await fetchImpl(url.toString(),{method,headers,cache:'no-store',
   ...(method==='PUT'?{body:JSON.stringify(body)}:{})});}
  catch{fail('NETWORK_ERROR')}
  if(res.status===412)fail('ROOM_CONFLICT',412);
  if(!res.ok)fail(res.status===401||res.status===403?'ROOM_PERMISSION_DENIED':'ROOM_REQUEST_FAILED',res.status);
  if(method==='GET'){
   const tag=res.headers.get('etag');
   if(!tag)fail('MISSING_ETAG');
   return {state:await res.json(),etag:tag};
  }
  return {state:await res.json()};
 }
 const validate=room=>{
  if(!room||room.protocol!==3||typeof room.roomCode!=='string'||!CODE.test(room.roomCode))
   fail('INVALID_ROOM');
 };
 return Object.freeze({
  read:code=>request('GET',code),
  async reserve(room){validate(room);return request('PUT',room.roomCode,room,'null_etag');},
  async commit(room,etag){validate(room);return request('PUT',room.roomCode,room,etag);}
 });
}
