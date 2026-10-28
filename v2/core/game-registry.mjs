// A game is a plugin. The shell/UI/transport must never switch on game IDs.
// Plugins may provide a custom board surface, but not a second application.
const ID=/^[a-z][a-z0-9-]{1,39}$/;
const required=['id','label','seats','boardKind','actions','createLocal','localBoard','localLegal','localHand','localCounts'];
export function createGameRegistry(initial=[]){
 const games=new Map();
 function register(def){
  if(!def||typeof def!=='object')throw Error('INVALID_GAME_PLUGIN');
  for(const name of required)if(!(name in def))throw Error('MISSING_GAME_PLUGIN_FIELD '+name);
  if(!ID.test(def.id))throw Error('INVALID_GAME_ID');
  if(typeof def.label!=='string'||!def.label.trim())throw Error('INVALID_GAME_LABEL');
  if(!Number.isInteger(def.seats)||def.seats<1||def.seats>8)throw Error('INVALID_GAME_SEATS');
  if(typeof def.boardKind!=='string'||!def.boardKind)throw Error('INVALID_BOARD_KIND');
  if(!Array.isArray(def.actions)||!def.actions.length||
     def.actions.some(a=>typeof a!=='string'||!a))throw Error('INVALID_GAME_ACTIONS');
  if(new Set(def.actions).size!==def.actions.length)throw Error('DUPLICATE_GAME_ACTION');
  for(const key of ['createLocal','localBoard','localLegal','localHand','localCounts'])
   if(typeof def[key]!=='function')throw Error('INVALID_GAME_HOOK '+key);
  if((def.remoteBoard&&!def.remoteLegal)||(!def.remoteBoard&&def.remoteLegal))
   throw Error('INCOMPLETE_REMOTE_ADAPTER');
  if(def.remoteBoard&&typeof def.remoteBoard!=='function')throw Error('INVALID_REMOTE_BOARD_HOOK');
  if(def.remoteLegal&&typeof def.remoteLegal!=='function')throw Error('INVALID_REMOTE_LEGAL_HOOK');
  if(games.has(def.id))throw Error('DUPLICATE_GAME '+def.id);
  // Optional visual metadata for the shared lobby/table. Future games should
  // add data here rather than introduce new game-ID branches in GameShell.
  if(def.ui!==undefined){
   if(!def.ui||typeof def.ui!=='object'||Array.isArray(def.ui))
    throw Error('INVALID_GAME_PRESENTATION');
   for(const key of ['icon','tagline'])
    if(def.ui[key]!==undefined&&typeof def.ui[key]!=='string')
     throw Error('INVALID_GAME_PRESENTATION_'+key);
   if(def.ui.handOrder!==undefined&&!['strength','suit'].includes(def.ui.handOrder))
    throw Error('INVALID_GAME_HAND_ORDER');
  }
  const frozen=Object.freeze({...def,actions:Object.freeze([...def.actions]),
   ui:def.ui?Object.freeze({...def.ui}):undefined});
  games.set(def.id,frozen);
  return frozen;
 }
 for(const game of initial)register(game);
 return Object.freeze({
  register,
  get(id){const game=games.get(id);if(!game)throw Error('UNSUPPORTED_GAME');return game;},
  list(){return Object.freeze([...games.values()]);},
  has(id){return games.has(id);}
 });
}
