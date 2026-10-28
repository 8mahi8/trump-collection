import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameRegistry} from '../v2/core/game-registry.mjs';
import {GAME_REGISTRY} from '../v2/games/definitions.mjs';
import {createMatchEngineCatalog,DEFAULT_MATCH_ENGINES} from '../v2/session/match-engine-catalog.mjs';
import {createRoomMatchHost} from '../v2/session/room-match-host.mjs';

const stub=(id,onlineReady=true)=>({
 id,label:id,seats:2,boardKind:'custom',interaction:'flip',
 actions:['flip'],onlineReady,createLocal:()=>({phase:'play',turn:0}),
 localHand:()=>[],localCounts:()=>null,localBoard:()=>({kind:'custom'}),
 localLegal:()=>({flipIndices:[0]}),
 remoteBoard:()=>({kind:'custom'}),remoteLegal:()=>({flipIndices:[0]})
});
test('Default game catalog matches exactly the published four runtime engines',()=>{
 assert.deepEqual(DEFAULT_MATCH_ENGINES.listPlayable().slice().sort(),
  GAME_REGISTRY.list().filter(g=>g.onlineReady).map(g=>g.id).sort());
 assert.equal(DEFAULT_MATCH_ENGINES.supports('shinkei'),true);
 assert.equal(DEFAULT_MATCH_ENGINES.supports('experimental'),false);
});
test('Fifth game with only a definition is not falsely published online',()=>{
 const game=stub('fifth-game');
 const registry=createGameRegistry([game]);
 const catalog=createMatchEngineCatalog([],{registry});
 assert.deepEqual(catalog.listPlayable(),[]);
 assert.throws(()=>catalog.create({room:{match:{gameId:game.id}}}),/ONLINE_MATCH_ENGINE_UNAVAILABLE/);
});
test('Fifth game can register one host factory without changing transport runner',()=>{
 const game=stub('fifth-game');
 const registry=createGameRegistry([game]);
 let invoked=0;
 const factory=({room,seedSource})=>{invoked++;
  return {matchId:room.match.matchId,seed:seedSource()};
 };
 const catalog=createMatchEngineCatalog([{gameId:game.id,create:factory}],{registry});
 assert.deepEqual(catalog.listPlayable(),['fifth-game']);
 const room={match:{gameId:game.id,matchId:'12345-m1',participants:['host','guest']}};
 assert.deepEqual(catalog.create({room,seedSource:()=>42}),{matchId:'12345-m1',seed:42});
 assert.equal(invoked,1);
 assert.throws(()=>catalog.create({room:{...room,match:{...room.match,participants:['host']}}}),
  /ONLINE_MATCH_SEAT_COUNT_MISMATCH/);
});
test('Unready or incomplete games never become playable via fake factory',()=>{
 const registry=createGameRegistry([stub('not-ready',false)]);
 const catalog=createMatchEngineCatalog([],{registry});
 catalog.register({gameId:'not-ready',create:()=>({})});
 assert.deepEqual(catalog.listPlayable(),[]);
 assert.throws(()=>catalog.create({room:{match:{gameId:'not-ready',participants:['a','b']}}}),
  /ONLINE_MATCH_ENGINE_UNAVAILABLE/);
 assert.throws(()=>catalog.register({gameId:'not-ready',create:()=>({})}),/ALREADY_REGISTERED/);
 assert.throws(()=>catalog.register({gameId:'missing',create:()=>({})}),/UNREGISTERED_GAME/);
});
test('Online catalog fails closed when remote view contract is incomplete',()=>{
 const reg=createGameRegistry([{
  ...stub('no-remote'),remoteBoard:undefined,remoteLegal:undefined
 }]);
 assert.throws(()=>createMatchEngineCatalog([{gameId:'no-remote',create:()=>({})}],{registry:reg}),
  /MATCH_ENGINE_MISSING_VIEW_ADAPTER/);
});

test('fifth game factory actually starts and publishes through unchanged room host',async()=>{
 const registry=createGameRegistry([stub('fifth-game')]);
 const room={roomCode:'12345',hostId:'host12345',phase:'playing',
  match:{matchId:'12345-m1',gameId:'fifth-game',
   participants:['host12345','friend12345'],status:'playing'},
  members:['host12345','friend12345']};
 const calls=[];
 const engine={matchId:room.match.matchId,gameId:'fifth-game',
  participants:[...room.match.participants],revision:1,phase:'playing',
  publicSnapshot:()=>({matchId:'12345-m1',gameId:'fifth-game',publicView:{phase:'playing',revision:1}}),
  privateSnapshot:id=>({matchId:'12345-m1',gameId:'fifth-game',
   privateView:{owner:id,hand:[]}})
 };
 const engines=createMatchEngineCatalog([{gameId:'fifth-game',
  create:()=>engine}],{registry});
 const store={uid:'host12345',
  read:async()=>({state:room}),publishMatchPrivate:async(...args)=>{calls.push(['private',...args]);},
  publishMatchPublic:async(...args)=>{calls.push(['public',...args]);},
  matchCommands:async()=>({}),writeMatchReceipt:async()=>{},
  removeMatchCommand:async()=>{}};
 const host=createRoomMatchHost({store,coordinator:{},roomCode:'12345',matchEngines:engines});
 const started=await host.start();
 assert.equal(started.gameId,'fifth-game');
 assert.equal(started.matchId,'12345-m1');
 assert.deepEqual(calls.map(a=>a[0]),['private','private','public']);
 assert.equal(calls[0][3],'host12345');
 assert.equal(calls[1][3],'friend12345');
 assert.equal(calls[2][2],'12345-m1');
});
