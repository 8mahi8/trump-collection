import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameRegistry} from '../v2/core/game-registry.mjs';
import {GAME_REGISTRY,BUILTIN_GAMES,GAME_SPECS} from '../v2/games/definitions.mjs';
import {viewFromCpu,viewFromFourPlayerRoom} from '../v2/core/unified-view.mjs';

const local=()=>({phase:'play',turn:0,hands:[[],[],[],[]],ranks:{}});
const custom=Object.freeze({
 id:'example-game',label:'新しいゲーム',seats:4,boardKind:'custom',
 actions:['tap','pass'],createLocal:local,
 localHand:()=>[],localCounts:()=>[0,0,0,0],
 localBoard:()=>({kind:'custom',value:'table'}),
 localLegal:()=>({drawIndices:[],playIds:[],playMoves:[],flipIndices:[],canPass:true}),
 remoteBoard:()=>({kind:'custom',value:'table'}),
 remoteLegal:()=>({drawIndices:[],playIds:[],playMoves:[],flipIndices:[],canPass:true})
});
test('all four games declare valid independent plugins with one common interface',()=>{
 assert.equal(BUILTIN_GAMES.length,4);
 assert.deepEqual(GAME_REGISTRY.list().map(g=>g.id),['babanuki','shichinarabe','shinkei','daifugo']);
 for(const g of BUILTIN_GAMES){
  assert.deepEqual(Object.keys(GAME_SPECS[g.id]),['label','seats','boardKind','actions']);
  assert.equal(typeof g.localBoard,'function');
  assert.equal(typeof g.localLegal,'function');
  assert.equal(typeof g.createLocal,'function');
  assert.ok(Array.isArray(g.actions));
 }
});
test('registering another game never changes shell or CPU/room projector source',()=>{
 const registry=createGameRegistry([custom]);
 const view=viewFromCpu({game:'example-game',state:local(),seat:0,registry});
 assert.equal(view.game,'example-game');
 assert.equal(view.board.kind,'custom');
 assert.deepEqual(view.legal.playIds,[]);
 const pub={game:'example-game',phase:'playing',turn:0,revision:3,round:0,counts:[0,0,0,0]};
 const priv={game:'example-game',seat:0,revision:3,round:0,hand:[]};
 const remote=viewFromFourPlayerRoom({game:'example-game',publicView:pub,privateView:priv,registry});
 assert.deepEqual(remote.board,view.board);
 assert.deepEqual(remote.legal,view.legal);
 assert.deepEqual(remote.hand,view.hand);
});
test('registration blocks duplicate, incomplete or invalid modules',()=>{
 const registry=createGameRegistry([custom]);
 assert.throws(()=>registry.register(custom),/DUPLICATE_GAME/);
 assert.throws(()=>registry.register({...custom,id:'A bad id'}),/INVALID_GAME_ID/);
 assert.throws(()=>registry.register({...custom,id:'test-two',actions:['play','play']}),/DUPLICATE_GAME_ACTION/);
 assert.throws(()=>registry.register({...custom,id:'test-three',remoteLegal:undefined}),/INCOMPLETE_REMOTE_ADAPTER/);
 assert.throws(()=>registry.register({...custom,id:'test-four',seats:0}),/INVALID_GAME_SEATS/);
 assert.throws(()=>registry.get('no-game'),/UNSUPPORTED_GAME/);
});
test('different registries do not share game registration',()=>{
 const registry=createGameRegistry();
 registry.register(custom);
 assert.equal(registry.has('example-game'),true);
 assert.equal(GAME_REGISTRY.has('example-game'),false);
});
