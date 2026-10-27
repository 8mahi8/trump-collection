// ONE-TIME production Firebase CHECK, READ-ONLY. Never PUT/POST/PATCH/DELETE.
// The chosen five-digit room is not shown and its contents are discarded.
// This diagnostic does not change Firebase Rules, data, or authentication.
const base='https://mygame-df915-default-rtdb.firebaseio.com';
const url=base+'/trumpRoomsV2/00000/lobby.json';
function result(label,res){
 console.log(label+' HTTP='+res.status+
  ' CORS='+String(res.headers.get('access-control-allow-origin')||'missing')+
  ' etag='+(res.headers.has('etag')?'present':'missing'));
}
try{
 const read=await fetch(url,{method:'GET',headers:{
  'Accept':'application/json','X-Firebase-ETag':'true','Origin':'null'
 },signal:AbortSignal.timeout(12000)});
 result('V2_REAL_RTDB_READ_ONLY',read);
 // Never print or inspect data from the room. Discard the body immediately.
 await read.arrayBuffer();
 const preflight=await fetch(url,{method:'OPTIONS',headers:{
  'Origin':'null','Access-Control-Request-Method':'PUT',
  'Access-Control-Request-Headers':'content-type,if-match'
 },signal:AbortSignal.timeout(12000)});
 result('V2_REAL_RTDB_CORS_PREFLIGHT_PUT_NO_WRITE',preflight);
 const cors=preflight.headers.get('access-control-allow-origin');
 const methods=preflight.headers.get('access-control-allow-methods')||'';
 console.log('V2_REAL_RTDB_CHECK '+JSON.stringify({
  readPermitted:read.status===200,
  readEtagAvailable:read.headers.has('etag'),
  corsAllowsOpaqueOrigin:cors==='*'||cors==='null',
  putPreflightPermitted:preflight.ok&&methods.toUpperCase().includes('PUT'),
  actualWritesAttempted:0
 }));
 if(read.status!==200)process.exitCode=2;
 if(!preflight.ok)process.exitCode=3;
}catch(e){console.error('V2_REAL_RTDB_CONNECTIVITY_UNVERIFIED '+e.name);process.exitCode=4;}
