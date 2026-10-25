// Browser-safe preflight for the friends-only trump collection.
// Prevents accidentally connecting to the other school games' Firebase RTDB.
// This does NOT prove a project is otherwise unused; its setup must still be
// reviewed in Firebase Console. No secrets or network calls here.
const NAME=/^trump-collection-[a-z0-9-]{3,25}$/;
const API=/^[A-Za-z0-9_-]{8,200}$/;
const BLOCKED=new Set(['mygame-df915']);
export function validateDedicatedFirebaseConfig(config){
  if(!config||typeof config!=='object')throw Error('FIREBASE_CONFIG_MISSING');
  const {projectId,apiKey,databaseURL}=config;
  if(typeof projectId!=='string'||!NAME.test(projectId)||projectId.endsWith('-')||BLOCKED.has(projectId))
    throw Error('FIREBASE_DEDICATED_PROJECT_REQUIRED');
  if(typeof apiKey!=='string'||!API.test(apiKey))throw Error('INVALID_FIREBASE_API_KEY');
  if(typeof databaseURL!=='string')throw Error('INVALID_DATABASE_URL');
  let u;
  try{u=new URL(databaseURL);}catch{throw Error('INVALID_DATABASE_URL');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||
     (u.pathname!==''&&u.pathname!=='/'))throw Error('INVALID_DATABASE_URL');
  const host=u.hostname.toLowerCase();
  const db=projectId+'-default-rtdb';
  const validHost=host===db+'.firebaseio.com'||
    (host.startsWith(db+'.')&&/^[-a-z0-9]+\.firebasedatabase\.app$/.test(host.slice(db.length+1)));
  if(!validHost)throw Error('FIREBASE_PROJECT_DATABASE_MISMATCH');
  // Do not accept arbitrary properties or admin credentials in browser config.
  const keys=Object.keys(config);
  if(keys.some(k=>!['projectId','apiKey','databaseURL'].includes(k)))
    throw Error('UNEXPECTED_FIREBASE_CONFIG_FIELD');
  return Object.freeze({projectId,apiKey,databaseURL:u.origin});
}
