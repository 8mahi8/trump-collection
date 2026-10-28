// The host reads only the plugin's online CPU policy. No game-name if/switch:
// another game can add its policy without touching the room runner.
import {GAME_REGISTRY} from '../games/definitions.mjs';

export function chooseRoomCpuMove({game,publicView,privateView,registry=GAME_REGISTRY}={}){
 if(!publicView||!privateView||publicView.game!==game||privateView.game!==game||
  publicView.phase!=='playing'||publicView.turn!==privateView.seat)
  throw Error('CPU_VIEW_OUT_OF_SYNC');
 const spec=registry.get(game);
 if(typeof spec.remoteCpuChoose!=='function')throw Error('CPU_UNSUPPORTED_GAME');
 return spec.remoteCpuChoose({publicView,privateView});
}
