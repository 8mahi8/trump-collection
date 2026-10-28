// The ONLY V2 entrypoint for host-side online match engines. A new game
// registers its engine factory here after implementing its authority adapter.
// Game metadata alone MUST NEVER mark an unimplemented match as playable.
// Keep the proven four-seat legacy bridge and two-seat Memory bridge intact.
import {GAME_REGISTRY} from '../games/definitions.mjs';
import {createFourPlayerMatch} from './four-player-match.mjs';
import {createTwoPlayerMemoryMatch} from './two-player-memory-match.mjs';

export function createMatchEngineCatalog(initial=[],{registry=GAME_REGISTRY}={}){
 const engines=new Map();
 function register({gameId,create}={}){
  if(!registry.has(gameId))throw Error('MATCH_ENGINE_UNREGISTERED_GAME');
  if(typeof create!=='function')throw Error('MATCH_ENGINE_FACTORY_REQUIRED');
  if(engines.has(gameId))throw Error('MATCH_ENGINE_ALREADY_REGISTERED');
  const spec=registry.get(gameId);
  if(![2,4].includes(spec.seats))throw Error('MATCH_ENGINE_UNSUPPORTED_SEAT_COUNT');
  if(!spec.remoteBoard||!spec.remoteLegal)throw Error('MATCH_ENGINE_MISSING_VIEW_ADAPTER');
  engines.set(gameId,create);
 }
 for(const entry of initial)register(entry);
 return Object.freeze({
  register,
  supports(gameId){return engines.has(gameId);},
  listPlayable(){return Object.freeze(registry.list().filter(spec=>
   spec.onlineReady===true&&engines.has(spec.id)&&
   [2,4].includes(spec.seats)&&spec.remoteBoard&&spec.remoteLegal).map(spec=>spec.id));},
  create({room,seedSource,gameConfig}={}){
   const gameId=room?.match?.gameId;
   const factory=engines.get(gameId);
   if(!factory||!registry.get(gameId).onlineReady)throw Error('ONLINE_MATCH_ENGINE_UNAVAILABLE');
   if(room.match.participants?.length!==registry.get(gameId).seats)
    throw Error('ONLINE_MATCH_SEAT_COUNT_MISMATCH');
   return factory({room,seedSource,gameConfig});
  }
 });
}
export const DEFAULT_MATCH_ENGINES=createMatchEngineCatalog([
 {gameId:'babanuki',create:createFourPlayerMatch},
 {gameId:'shichinarabe',create:createFourPlayerMatch},
 {gameId:'daifugo',create:createFourPlayerMatch},
 {gameId:'shinkei',create:createTwoPlayerMemoryMatch}
]);
