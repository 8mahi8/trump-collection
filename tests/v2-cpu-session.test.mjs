import test from 'node:test';
import assert from 'node:assert/strict';
import {createCpuSession} from '../v2/session/cpu-session.mjs';
import {readFileSync} from 'node:fs';

test('one shared CPU session completes 40 Babanuki games using plugin moves',()=>{
 for(let seed=1;seed<=40;seed++){
  const game=createCpuSession({game:'babanuki',seed,seat:0});
  let steps=0;
  while(game.getView().phase==='playing'&&steps++<250){
   const v=game.getView();
   const ok=v.isMyTurn?
    game.dispatch({type:'draw',index:v.legal.drawIndices[0]}):
    game.stepCpu();
   assert.equal(ok,true,'seed '+seed+' step '+steps+' turn '+v.turn);
  }
  assert.ok(steps<250,'game did not end seed '+seed);
  assert.equal(game.getView().phase,'finished');
  game.dispose();
 }
});
test('CPU session rejects illegal input, never leaks other hands and notifies on moves',()=>{
 const game=createCpuSession({game:'babanuki',seed:98,seat:0});
 const revisions=[];
 const stop=game.subscribe(v=>revisions.push({turn:v.turn,hand:v.hand.length}));
 assert.equal(game.dispatch({type:'draw',index:-1}),false);
 assert.equal(game.dispatch({type:'pass'}),false);
 assert.equal(revisions.length,1,'invalid commands may not redraw table');
 for(let i=0;i<8&&game.getView().phase==='playing';i++){
  const v=game.getView();
  if(v.isMyTurn)assert.equal(game.dispatch({type:'draw',index:v.legal.drawIndices[0]}),true);
  else assert.equal(game.stepCpu(),true);
  assert.deepEqual(Object.keys(game.getView()).includes('hands'),false);
 }
 assert.ok(revisions.length>1);
 stop();
 game.dispose();
 assert.throws(()=>game.getView(),/SESSION_DISPOSED/);
});
test('single renderer is mode-independent and does not contain Firebase/network/CPU controls',()=>{
 const code=readFileSync(new URL('../v2/ui/table-renderer.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(code,/createFirebase|makeRealtimeWire|srcdoc|iframe|createCpuSession/);
 assert.match(code,/createTableRenderer/);
 assert.match(code,/\.replaceChildren\(/);
 const app=readFileSync(new URL('../v2/lab.html',import.meta.url),'utf8');
 assert.match(app,/<main id="main">/);
 assert.doesNotMatch(app,/<iframe/i);
});
