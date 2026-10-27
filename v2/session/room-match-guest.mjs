// V2 guest adapter: matches existing createRoomSession poll/act/receipt,
// so CPU and online use the SAME shared Table Renderer.
const CODE=/^[0-9]{5}/;
const KEY=/^[A-Za-z0-9_-]{6,60}/;
let seq=0;
const defaultId=()=>'v2'+Date.now().toString(36)+(++seq).toString(36);
export function createRoomMatchGuest({store,roomCode,matchId,actionIdSource=defaultId}={}){
 if(!store||typeof store.uid!=='string'||!CODE.test(roomCode)||
  !['read','matchPublic','matchPrivate','submitMatch','matchReceipt']
   .every(k=>typeof store[k]==='function'))throw Error('INVALID_MATCH_GUEST');
 let latest=null;
 return Object.freeze({
  get matchId(){return matchId},
  async poll({roomSnapshot=null}={}){
   // A shell tick already fetched the room. Avoid a duplicate GET while
   // keeping the same match-ID / participant validation below.
   const room=roomSnapshot||(await store.read(roomCode)).state;
   if(!room||room.match?.matchId!==matchId)return {status:'room_closed'};
   if(!room.match.participants.includes(store.uid))return {status:'spectating'};
   if(!['playing','results'].includes(room.phase))return {status:'syncing'};
   const [pub,priv]=await Promise.all([
    store.matchPublic(roomCode,matchId),store.matchPrivate(roomCode,matchId,store.uid)
   ]);
   if(!pub?.publicView||!priv?.privateView||pub.matchId!==matchId||
    priv.matchId!==matchId||pub.gameId!==room.match.gameId||
    priv.gameId!==room.match.gameId||
    pub.publicView.revision!==priv.privateView.revision||
    pub.publicView.round!==priv.privateView.round){
    latest=null;
    return {status:'syncing'};
   }
   latest={room,publicView:pub.publicView,privateView:priv.privateView};
   return {status:'ready',publicView:pub.publicView,privateView:priv.privateView};
  },
  async act(type,extra={}){
   if(!latest||latest.room.phase!=='playing')throw Error('MATCH_NOT_READY');
   if(!['draw','play','pass','flip'].includes(type))throw Error('INVALID_MATCH_ACTION');
   const id=actionIdSource();
   if(typeof id!=='string'||!KEY.test(id))throw Error('INVALID_REQUEST_ID');
   const payload={protocol:3,requestId:id,matchId,actor:store.uid,
    type,round:latest.publicView.round,expectedRevision:latest.publicView.revision};
   for(const key of ['index','id','ids'])if(Object.hasOwn(extra,key))payload[key]=extra[key];
   await store.submitMatch(roomCode,matchId,id,payload);
   return id;
  },
  receipt:id=>store.matchReceipt(roomCode,matchId,store.uid,id)
 });
}
