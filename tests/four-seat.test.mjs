import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../games.mjs';
import {FOUR_GAMES,FOUR_ROOM_PROTOCOL,createFourSeatAuthority,makeFourSeatCommand} from '../online/four-seat-authority.mjs';

const names=['host-actor-000','guest-actor-001','guest-actor-002','guest-actor-003'];
function roomFor(game,seed=51,config=null){
  const room=createFourSeatAuthority({roomCode:'58231',hostId:names[0],game,seedSource:()=>seed,config});
  let count=0;
  const command=(p,type,data={},overrides={})=>room.apply({
    ...makeFourSeatCommand(room.publicView(),names[p],type,'move-'+(++count),data),...overrides});
  return {room,command};
}
function started(game,seed=51,config=null){
  const o=roomFor(game,seed,config);
  for(let i=1;i<4;i++)assert.equal(o.command(i,'join').ok,true);
  for(let i=0;i<4;i++)assert.equal(o.command(i,'ready',{ready:true}).ok,true);
  assert.equal(o.command(0,'start').ok,true);
  return o;
}
function playCurrent(o,rng=Math.random){
  const view=o.room.publicView(),p=view.turn,privateView=o.room.privateView(names[p]);
  if(view.game==='babanuki')return o.command(p,'draw',{index:Math.floor(rng()*view.counts[view.drawFrom])});
  if(view.game==='shichinarabe'){
    return privateView.legalIds?.length?o.command(p,'play',{id:privateView.legalIds[0]}):o.command(p,'pass');
  }
  if(view.game==='daifugo'){
    return privateView.legalMoves.length?o.command(p,'play',{ids:privateView.legalMoves[0]}):o.command(p,'pass');
  }
  throw Error('unknown game');
}
test('4席共通: ルーム人数・READY・START・参加者のみ操作',()=>{
 for(const game of FOUR_GAMES){
  const {room,command}=roomFor(game);
  assert.equal(command(0,'start').ok,false);
  assert.equal(command(1,'join').ok,true);
  assert.equal(command(2,'join').ok,true);
  assert.equal(command(3,'join').ok,true);
  assert.deepEqual(room.publicView().seats.map(s=>s.present),[true,true,true,true]);
  assert.equal(room.publicView().seats.some(s=>'id'in s),false);
  assert.equal(command(1,'join').reason,'ALREADY_JOINED');
  assert.equal(room.apply({...makeFourSeatCommand(room.publicView(),'fifth-actor-004','join','extra-join-1')}).reason,'ROOM_FULL');
  assert.equal(command(1,'start').reason,'NOT_ALLOWED');
  for(let p=0;p<4;p++)assert.equal(command(p,'ready',{ready:true}).ok,true);
  assert.equal(command(0,'start').ok,true);
  assert.equal(room.publicView().phase,'playing');
  assert.equal(command(0,'start').ok,false);
  assert.equal(room.apply({...makeFourSeatCommand(room.publicView(),'stranger-actor-099','pass','extra-pass-2')}).reason,'NOT_IN_ROOM');
 }
});
test('4席共通: 必要な情報だけ配信・元データを破壊しない',()=>{
 for(const game of FOUR_GAMES){
  const {room}=started(game,87);
  const v=room.publicView(),raw=JSON.stringify(v);
  for(const name of names)assert.equal(raw.includes(name),false);
  assert.equal(raw.includes('"hands"'),false);
  assert.equal(raw.includes('"hand"'),false);
  assert.equal(raw.includes('"legalMoves"'),false);
  assert.equal(raw.includes('"legalIds"'),false);
  assert.equal(raw.includes('"seed"'),false);
  const originals=names.map(n=>room.privateView(n).hand);
  assert.equal(originals.reduce((s,a)=>s+a.length,0)>0,true);
  assert.equal(room.privateView('stranger-actor-999'),null);
  assert.equal(v.seats.length,4);
  const tamper=room.privateView(names[1]);tamper.hand.length=0;
  assert.deepEqual(room.privateView(names[1]).hand,originals[1]);
  const copied=room.publicView();
  copied.seats[0].ready=false;
  assert.equal(room.publicView().seats[0].ready,true);
 }
});
test('4席共通: 二重送信・古いrevision・旧ラウンド・別ルームを拒否',()=>{
 const o=started('babanuki',47),v=o.room.publicView(),p=v.turn;
 const move=makeFourSeatCommand(v,names[p],'draw','dedupe-draw-0001',{index:0});
 assert.equal(o.room.apply(move).ok,true);
 assert.equal(o.room.apply(move).reason,'DUPLICATE');
 assert.equal(o.room.apply({...move,actionId:'stale-draw-0002'}).reason,'STALE');
 assert.equal(o.room.apply({...move,actionId:'wrong-room-0003',roomCode:'12345'}).reason,'INVALID');
 assert.equal(o.room.apply({...move,actionId:'wrong-game-0004',game:'daifugo'}).reason,'INVALID');
 assert.equal(o.room.apply({...move,actionId:'wrong-round-0005',expectedRevision:o.room.revision,round:9}).reason,'STALE');
});
test('4席ババ抜き: 無効な引き方を拒否、本人だけ引いた札を確認できる',()=>{
 const o=started('babanuki',83),v=o.room.publicView(),p=v.turn;
 for(const index of [-1,999,1.5,NaN,null]){
   assert.equal(o.command(p,'draw',{index}).ok,false);
   assert.equal(o.room.publicView().revision,v.revision);
 }
 assert.equal(o.command(p,'draw',{index:0}).ok,true);
 const after=o.room.publicView();
 assert.ok(after.lastAction);
 assert.ok(!('card' in after.lastAction));
 assert.ok(!JSON.stringify(after).includes('"suit"'));
 const actorView=o.room.privateView(names[p]);
 assert.ok(actorView.lastDraw.card);
 for(let other=0;other<4;other++)if(other!==p)assert.equal(o.room.privateView(names[other]).lastDraw,null);
});
test('4席七並べ: 手札・合法札を個別提供、場の7・パスを公開',()=>{
 const o=started('shichinarabe',77),v=o.room.publicView(),p=v.turn;
 assert.equal(v.placed.length,4);assert.ok(v.placed.every(x=>x.low===7&&x.high===7));
 assert.equal(o.command(p,'play',{id:'not-a-card'}).ok,false);
 const before=o.room.revision;
 assert.equal(o.command(p,'pass').ok,true);
 assert.equal(o.room.publicView().revision,before+1);
 assert.equal(o.room.publicView().passes[p],1);
 assert.equal(o.room.publicView().lastAction.type,'pass');
 const player=o.room.publicView().turn,pr=o.room.privateView(names[player]);
 if(pr.legalIds.length){
   assert.equal(o.command(player,'play',{id:pr.legalIds[0]}).ok,true);
   assert.equal(o.room.publicView().lastAction.type,'play');
   assert.ok(o.room.publicView().lastAction.card);
 }
});
test('4席大富豪: 既存ルールの合法手のみ受け付け公開場だけ同期',()=>{
 const o=started('daifugo',41),v=o.room.publicView(),p=v.turn,pr=o.room.privateView(names[p]);
 assert.ok(pr.legalMoves.length>0);
 assert.equal(o.command(p,'pass').ok,false,'empty field cannot be passed');
 assert.equal(o.command(p,'play',{ids:['fake-card']}).ok,false);
 assert.equal(o.command(p,'play',{ids:[pr.legalMoves[0][0],pr.legalMoves[0][0]]}).ok,false);
 assert.equal(o.command(p,'play',{ids:pr.legalMoves[0]}).ok,true);
 const after=o.room.publicView();
 assert.ok(after.field?.cards.length>0||after.field===null);
 assert.equal(after.counts.reduce((s,n)=>s+n,0),52);
 const publicJson=JSON.stringify(after);
 assert.equal(publicJson.includes('"hand"'),false);
 assert.equal(publicJson.includes('"legalMoves"'),false);
});
test('4席共通: ババ抜き・七並べ・大富豪をCOM代理で計90試合完走',()=>{
 for(const game of FOUR_GAMES)for(let seed=1;seed<=30;seed++){
  const o=started(game,seed),rng=G.mulberry32(seed+500);
  let moves=0;
  while(o.room.phase==='playing'&&moves++<10000){
    const old=o.room.revision,res=playCurrent(o,rng);
    assert.equal(res.ok,true,game+' seed '+seed+' action '+moves+' '+res.reason);
    assert.equal(o.room.revision,old+1);
    const pub=o.room.publicView();
    assert.equal(pub.counts.length,4);
    assert.ok(pub.counts.every(n=>Number.isInteger(n)&&n>=0));
    assert.equal(pub.counts.reduce((a,b)=>a+b,0)<=53,true);
    assert.equal(JSON.stringify(pub).includes('"hands"'),false);
  }
  assert.equal(o.room.phase,'finished',game+' seed '+seed+' moves '+moves);
  assert.equal(moves<10000,true,game+' seed '+seed+' infinite loop');
  const ranks=Object.values(o.room.publicView().ranks).sort((a,b)=>a-b);
  assert.deepEqual(ranks,[1,2,3,4],game+' seed '+seed);
  assert.equal(o.command(1,'rematch').ok,false);
  assert.equal(o.command(0,'rematch').ok,true);
  const after=o.room.publicView();
  assert.equal(after.phase,'lobby');assert.equal(after.round,1);
  assert.ok(after.seats.every(s=>!s.ready));
  assert.equal(o.command(0,'start').ok,false);
 }
});
