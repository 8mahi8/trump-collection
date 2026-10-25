// Browser-side shape validation, NOT proof of live Firebase RTDB Rules.
// Shared Firebase may be used only after checking the deployed Rules against
// firebase/SHARED_DATABASE_RULES.md. RTDB Rules (not this code) enforce privacy.
const DEDICATED=/^trump-collection-[a-z0-9-]{3,25}$/;
const SHARED='mygame-df915';
const WEB_KEY=/^[A-Za-z0-9_-]{8,200}$/;
export function validateFirebaseConfig(config){
 if(!config||typeof config!=='object'||Array.isArray(config))
  throw Error('FIREBASE_CONFIG_MISSING');
 const {projectId,apiKey,databaseURL}=config;
 const dedicated=typeof projectId==='string'&&DEDICATED.test(projectId)&&!projectId.endsWith('-');
 if(!dedicated&&projectId!==SHARED)throw Error('FIREBASE_PROJECT_NOT_ALLOWED');
 if(typeof apiKey!=='string'||!WEB_KEY.test(apiKey))throw Error('INVALID_FIREBASE_API_KEY');
 if(typeof databaseURL!=='string')throw Error('INVALID_DATABASE_URL');
 let u;
 try{u=new URL(databaseURL)}catch{throw Error('INVALID_DATABASE_URL')}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||
    (u.pathname!==''&&u.pathname!=='/'))throw Error('INVALID_DATABASE_URL');
 const host=u.hostname.toLowerCase();
 const db=projectId+'-default-rtdb';
 const validHost=host===db+'.firebaseio.com'||
   (host.startsWith(db+'.')&&/^[a-z0-9-]+\.firebasedatabase\.app$/.test(host.slice(db.length+1)));
 if(!validHost)throw Error('FIREBASE_PROJECT_DATABASE_MISMATCH');
 if(Object.keys(config).some(k=>!['projectId','apiKey','databaseURL'].includes(k)))
  throw Error('UNEXPECTED_FIREBASE_CONFIG_FIELD');
 return Object.freeze({projectId,apiKey,databaseURL:u.origin});
}
// Compatibility with existing code and scripts. Despite the old name,
// shared mygame-df915 is now allowed for the *shape check* only.
export const validateDedicatedFirebaseConfig=validateFirebaseConfig;
