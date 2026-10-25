// Vanilla Fetch adapter for Firebase Anonymous Auth + RTDB REST.
// Zero SDK/CDN dependence. This file NEVER applies database rules.
// Deploy firebase/trump-rooms.rules.json only after isolated emulator tests.
const CODE=/^[0-9]{5}$/;
const ID=/^[A-Za-z0-9_-]{6,128}$/;
const APP_PATH='trumpRoomsV1';
export class FirebaseRoomError extends Error {
  constructor(status,code){super(code);this.name='FirebaseRoomError';this.status=status;this.code=code;}
}
function check(code,uid=null){
  if(!CODE.test(code))throw new Error('INVALID_ROOM_CODE');
  if(uid!==null&&!ID.test(uid))throw new Error('INVALID_UID');
}
function safeApiKey(value){
  if(typeof value!=='string'||value.length<8||!/^[-A-Za-z0-9_]+$/.test(value))throw Error('INVALID_FIREBASE_API_KEY');
}
export function createFirebaseAnonymousAuth({apiKey,fetchImpl=globalThis.fetch,now=Date.now}){
  safeApiKey(apiKey);
  if(typeof fetchImpl!=='function')throw Error('NO_FETCH');
  let session=null;
  async function api(endpoint,payload){
    const url=new URL(endpoint);
    url.searchParams.set('key',apiKey);
    const res=await fetchImpl(url.toString(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
    if(!res.ok)throw new FirebaseRoomError(res.status,'FIREBASE_AUTH_REJECTED');
    return res.json();
  }
  const setSession=(raw,refresh=false)=>{
    const uid=raw.localId||raw.user_id,token=raw.idToken||raw.id_token,
      refreshToken=raw.refreshToken||raw.refresh_token,expires=Number(raw.expiresIn||raw.expires_in);
    if(!uid||!token||!refreshToken||!Number.isFinite(expires)||expires<=0)throw Error('INVALID_AUTH_RESPONSE');
    session={uid,idToken:token,refreshToken,expiresAt:now()+expires*1000};
    return {uid};
  };
  return {
    async signIn(){
      const raw=await api('https://identitytoolkit.googleapis.com/v1/accounts:signUp',{returnSecureToken:true});
      return setSession(raw);
    },
    async refresh(){
      if(!session)throw Error('NOT_AUTHENTICATED');
      // Secure Token API requires form-urlencoded (anonymous signup uses JSON).
      const url=new URL('https://securetoken.googleapis.com/v1/token');
      url.searchParams.set('key',apiKey);
      const response=await fetchImpl(url.toString(),{method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({grant_type:'refresh_token',refresh_token:session.refreshToken}).toString(),
        cache:'no-store'});
      if(!response.ok)throw new FirebaseRoomError(response.status,'FIREBASE_REFRESH_REJECTED');
      const raw=await response.json();
      return setSession({...raw,localId:raw.user_id||session.uid},true);
    },
    async token(){
      if(!session)throw Error('NOT_AUTHENTICATED');
      if(session.expiresAt-now()<120000)await this.refresh();
      return session.idToken;
    },
    get uid(){return session?.uid??null;},
    get authenticated(){return !!session;},
    clear(){session=null;}
  };
}
// For a short-lived FRIEND-ONLY trial against an already publicly writable
// database. This is NOT Firebase Authentication and grants NO privacy.
// Requires an explicit opt-in in the Sites launcher. Never persisted on disk.
export function createFirebaseOpenRootTrialIdentity(random=bytes=>globalThis.crypto.getRandomValues(bytes)){
 if(typeof random!=='function')throw Error('INVALID_TRIAL_RANDOM');
 const bytes=new Uint8Array(16);
 random(bytes);
 const uid='tc'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return Object.freeze({
  uid,authenticated:false,
  async signIn(){return {uid}},
  async token(){return null},
  clear(){}
 });
}
export function createFirebaseRoomStore({databaseURL,auth,fetchImpl=globalThis.fetch}){
  if(typeof databaseURL!=='string'||!/^https:\/\/[A-Za-z0-9._-]+(?:\.firebaseio\.com|\.firebasedatabase\.app)\/?$/.test(databaseURL))
    throw Error('INVALID_DATABASE_URL');
  if(!auth||typeof auth.token!=='function'||typeof auth.uid!=='string')throw Error('NOT_AUTHENTICATED');
  if(typeof fetchImpl!=='function')throw Error('NO_FETCH');
  const root=databaseURL.replace(/\/$/,'');
  const uid=auth.uid;check('10000',uid);
  const fullPath=(room,...sections)=>{
    check(room);
    for(const seg of sections)if(!/^[A-Za-z0-9_-]{1,128}$/.test(String(seg)))throw Error('INVALID_DATABASE_PATH');
    return [APP_PATH,room,...sections].join('/');
  };
  async function request(method,path,value,precondition=false){
    const url=new URL(root+'/'+path+'.json');
    const bearer=await auth.token();
    if(bearer!==null){
      if(typeof bearer!=='string'||!bearer)throw Error('INVALID_AUTH_TOKEN');
      url.searchParams.set('auth',bearer);
    }
    const headers={'Accept':'application/json'};
    if(method!=='GET'&&method!=='DELETE')headers['Content-Type']='application/json';
    if(precondition)headers['if-match']='null_etag';
    let response;
    try{response=await fetchImpl(url.toString(),{
      method,headers,cache:'no-store',
      ...(method==='PUT'||method==='PATCH'?{body:JSON.stringify(value)}:{})
    });}catch{throw new FirebaseRoomError(0,'NETWORK_ERROR');}
    if(!response.ok){
      const code=response.status===412?'ALREADY_EXISTS':response.status===401||response.status===403?
        'PERMISSION_DENIED':response.status===404?'DATABASE_NOT_FOUND':
        response.status>=500?'SERVER_UNAVAILABLE':'REQUEST_REJECTED';
      throw new FirebaseRoomError(response.status,code);
    }
    if(response.status===204)return null;
    return response.json();
  }
  return {
    uid,
    async reserve(room,game){
      if(!['babanuki','shichinarabe','daifugo'].includes(game))throw Error('INVALID_GAME');
      // Atomic first-writer-wins: five-digit code collisions must NOT replace other rooms.
      return request('PUT',fullPath(room,'meta'),{hostUid:uid,game,protocol:2},true);
    },
    meta:room=>request('GET',fullPath(room,'meta')),
    // Guest may request but only host may grant a seat.
    requestSeat:room=>request('PUT',fullPath(room,'joinRequests',uid),true,true),
    ownJoinRequest:room=>request('GET',fullPath(room,'joinRequests',uid)),
    seat:room=>request('GET',fullPath(room,'seats',uid)),
    joinRequests:room=>request('GET',fullPath(room,'joinRequests')),
    // Only the authenticated host may update this heartbeat. Readers must occupy a room seat.
    // Closed matches are terminal. Never expose hands in this public-to-seated-user flag.
    readClosed:room=>request('GET',fullPath(room,'closed')),
    closeRoom:(room,reason='host_left')=>{
      if(!['host_left','player_left'].includes(reason))throw Error('INVALID_CLOSE_REASON');
      return request('PUT',fullPath(room,'closed'),{reason},true);
    },
    leaveRoom:room=>request('PUT',fullPath(room,'leaveRequests',uid),true,true),
    leaveRequests:room=>request('GET',fullPath(room,'leaveRequests')),
    readHeartbeat:room=>request('GET',fullPath(room,'heartbeat')),
    writeHeartbeat:(room,seq)=>{
      if(!Number.isSafeInteger(seq)||seq<=0)throw Error('INVALID_HEARTBEAT_SEQUENCE');
      return request('PUT',fullPath(room,'heartbeat'),{seq});
    },
    grantSeat:(room,memberUid)=>{check(room,memberUid);return request('PUT',fullPath(room,'seats',memberUid),true);},
    // Bounded chat: 10 cyclic slots per authenticated user. Four players
    // means <=40 messages stored per room; text never touches game revision.
    chat:room=>request('GET',fullPath(room,'chat')),
    sendChat:(room,text,seq,sentAt=Date.now())=>{
      if(typeof text!=='string'||!text.trim()||text.trim().length>120)throw Error('INVALID_CHAT_TEXT');
      if(!Number.isSafeInteger(seq)||seq<1||seq>1000000)throw Error('INVALID_CHAT_SEQUENCE');
      if(!Number.isSafeInteger(sentAt)||sentAt<1)throw Error('INVALID_CHAT_TIMESTAMP');
      return request('PUT',fullPath(room,'chat',uid,String(seq%10)),
        {uid,text:text.trim(),seq,sentAt});
    },
    readPublic:room=>request('GET',fullPath(room,'public')),
    readPrivate:room=>request('GET',fullPath(room,'private',uid)),
    publishPublic:(room,view)=>request('PUT',fullPath(room,'public'),view),
    publishPrivate:(room,memberUid,view)=>{check(room,memberUid);return request('PUT',fullPath(room,'private',memberUid),view);},
    async publishViews(room,authority,members){
      if(!authority||!Array.isArray(members))throw Error('INVALID_SNAPSHOT');
      // Publish everyone’s private data before the public revision.
      // Clients only enable buttons when private revision===public revision.
      for(const member of members){
        check(room,member);
        const privateView=authority.privateView(member);
        if(!privateView)throw Error('MISSING_MEMBER_VIEW');
        await request('PUT',fullPath(room,'private',member),privateView);
      }
      return request('PUT',fullPath(room,'public'),authority.publicView());
    },
    command:(room,action)=>{
      if(!action||action.actor!==uid||!ID.test(action.actionId)||action.roomCode!==room||
        !Number.isInteger(action.expectedRevision)||action.protocol!==2)throw Error('INVALID_COMMAND');
      return request('PUT',fullPath(room,'commands',uid,action.actionId),action,true);
    },
    commands:room=>request('GET',fullPath(room,'commands')),
    removeCommand:(room,memberUid,actionId)=>{check(room,memberUid);if(!ID.test(actionId))throw Error('INVALID_ACTION_ID');
      return request('DELETE',fullPath(room,'commands',memberUid,actionId));},
    receipt:(room,actionId)=>{if(!ID.test(actionId))throw Error('INVALID_ACTION_ID');
      return request('GET',fullPath(room,'receipts',uid,actionId));},
    writeReceipt:(room,memberUid,actionId,data)=>{check(room,memberUid);if(!ID.test(actionId))throw Error('INVALID_ACTION_ID');
      return request('PUT',fullPath(room,'receipts',memberUid,actionId),data);}
  };
}
