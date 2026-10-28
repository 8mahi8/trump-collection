import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameRegistry} from '../v2/core/game-registry.mjs';
import {createMatchEngineCatalog} from '../v2/session/match-engine-catalog.mjs';
import {onlineUiGames} from '../v2/ui/online-readiness.mjs';

const fifth=interaction=>({
 id:'fifth-game',label:'追加ゲーム',seats:2,onlineReady:true,
 boardKind:'custom-board',interaction,actions:['flip'],
 createLocal:()=>({phase:'play',turn:0}),
 localBoard:()=>({kind:'custom-board'}),localLegal:()=>({flipIndices:[0]}),
 localHand:()=>[],localCounts:()=>null,
 remoteBoard:()=>({kind:'custom-board'}),remoteLegal:()=>({flipIndices:[0]})
});
test('Four existing games have all three playable layers',()=>{
 assert.deepEqual(onlineUiGames(),['babanuki','shichinarabe','shinkei','daifugo']);
});
test('A fifth game stays hidden if its board surface is not implemented',()=>{
 const registry=createGameRegistry([fifth('flip')]);
 const engines=createMatchEngineCatalog([{gameId:'fifth-game',create:()=>({})}],{registry});
 assert.deepEqual(onlineUiGames({registry,engines}),[]);
 assert.deepEqual(onlineUiGames({registry,engines,
  surfaces:{'custom-board':()=>({})}}),['fifth-game']);
});
test('A fifth game with an unsupported input style cannot be advertised online',()=>{
 const registry=createGameRegistry([fifth('swipe')]);
 const engines=createMatchEngineCatalog([{gameId:'fifth-game',create:()=>({})}],{registry});
 assert.deepEqual(onlineUiGames({registry,engines,
  surfaces:{'custom-board':()=>({})}}),[]);
});
test('A fifth game without an engine cannot be advertised even with a custom board',()=>{
 const registry=createGameRegistry([fifth('flip')]);
 const engines=createMatchEngineCatalog([],{registry});
 assert.deepEqual(onlineUiGames({registry,engines,
  surfaces:{'custom-board':()=>({})}}),[]);
});
