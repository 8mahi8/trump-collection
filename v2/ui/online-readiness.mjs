// UI launch gate: a catalog entry alone is not enough. An online game
// also needs a table surface and a supported input contract before the room
// can offer it to friends. Keep future games hidden until ALL parts exist.
import {GAME_REGISTRY} from '../games/definitions.mjs';
import {DEFAULT_MATCH_ENGINES} from '../session/match-engine-catalog.mjs';
import {DEFAULT_BOARD_SURFACES} from './board-surfaces.mjs';

export const SUPPORTED_ONLINE_INTERACTIONS=Object.freeze([
 'draw','flip','pick-one','pick-multi'
]);
export function onlineUiGames({registry=GAME_REGISTRY,
 engines=DEFAULT_MATCH_ENGINES,surfaces=DEFAULT_BOARD_SURFACES,
 schoolOnly=false}={}){
 const supported=new Set(engines.listPlayable());
 return Object.freeze(registry.list().filter(spec=>
  supported.has(spec.id)&&(!schoolOnly||spec.schoolReady===true)&&
  SUPPORTED_ONLINE_INTERACTIONS.includes(spec.interaction)&&
  typeof surfaces[spec.boardKind]==='function').map(spec=>spec.id));
}
