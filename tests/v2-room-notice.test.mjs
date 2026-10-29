import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_REGISTRY} from '../v2/games/definitions.mjs';
import {roomNotice,matchNotice} from '../v2/ui/room-notice.mjs';
const host='host',guest='guest',cpu1='cpu1',cpu2='cpu2';
const room=(patch={})=>({
 roomCode:'12345',hostId:host,members:[host,guest],
 participants:[host,guest,cpu1,cpu2],ready:[],
 selectedGame:null,...patch
});
const options={selfId:host,isHost:true,registry:GAME_REGISTRY};
test('Room creation message ends on confirmed lobby snapshot',()=>{
 const text=roomNotice(room(),options);
 assert.equal(text,'部屋 12345 · ゲームを選んでください');
 assert.doesNotMatch(text,/作成しています|参加しています/);
 assert.match(roomNotice(room(),{...options,selfId:guest,isHost:false}),/ホストがゲームを選択中/);
 assert.match(roomNotice(room(),{...options,selfId:'pending'}),/入室確認中/);
});
test('Room status uses plugin label and human ready count (not CPU ready count)',()=>{
 assert.match(roomNotice(room({selectedGame:'babanuki'}),options),/ババ抜き · 準備完了を押そう/);
 const one=room({selectedGame:'babanuki',ready:[host]});
 assert.match(roomNotice(one,options),/準備待ち 1\/2人/);
 const ready=room({selectedGame:'babanuki',ready:[host,guest]});
 assert.match(roomNotice(ready,options),/全員準備OK！対局開始/);
 assert.match(roomNotice(ready,{...options,isHost:false,selfId:guest}),/全員準備OK！ホストの開始待ち/);
});
test('Spectators and future registered two-seat games do not require extra UI strings',()=>{
 const match=room({selectedGame:'shinkei',participants:[host,guest],ready:[host,guest]});
 assert.match(roomNotice(match,options),/神経衰弱 · 全員準備OK/);
 assert.match(roomNotice(match,{...options,selfId:'third',isHost:false}),/入室確認中/);
 const watched=room({selectedGame:'shinkei',participants:[host,'cpu1'],members:[host,guest],ready:[host]});
 assert.match(roomNotice(watched,{...options,selfId:guest,isHost:false}),/今回は観戦（準備不要）/);
});
test('Match, spectator and result notices reflect current phase',()=>{
 assert.match(matchNotice('12345',{gameLabel:'大富豪'}),/大富豪 · オンライン対戦中/);
 assert.match(matchNotice('12345',{phase:'results'}),/対局終了/);
 assert.match(matchNotice('12345',{phase:'spectator'}),/待機中/);
});
