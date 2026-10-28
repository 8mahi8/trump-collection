import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_REGISTRY} from '../v2/games/definitions.mjs';
import {createGameRegistry} from '../v2/core/game-registry.mjs';
import {gamePresentation,turnHeading,turnPrompt} from '../v2/ui/game-presentation.mjs';

const sampleView=(changes={})=>({
 phase:'playing',isMyTurn:true,turn:0,
 players:[{seat:0,isYou:true,isCpu:false},{seat:1,isYou:false,isCpu:true}],
 connection:{state:'local'},
 legal:{playIds:[],playMoves:[],canPass:false},
 ...changes
});
test('Every built-in game declares identity and hand order without shell game-ID branches',()=>{
 const specs=GAME_REGISTRY.list();
 assert.equal(specs.length,4);
 const ids=specs.map(spec=>spec.id);
 assert.deepEqual(ids,['babanuki','shichinarabe','shinkei','daifugo']);
 for(const spec of specs){
  const presentation=gamePresentation(spec);
  assert.ok(presentation.icon&&presentation.tagline);
  assert.ok(['strength','suit'].includes(presentation.handOrder));
 }
 assert.equal(gamePresentation(GAME_REGISTRY.get('daifugo')).handOrder,'strength');
 assert.equal(gamePresentation(GAME_REGISTRY.get('shichinarabe')).handOrder,'suit');
});
test('New games can omit presentation metadata without changing common UI code',()=>{
 const base={id:'sample-game',label:'追加ゲーム',seats:2,boardKind:'sample',
  actions:['play'],createLocal:()=>({}),localBoard:()=>({}),
  localLegal:()=>({}),localHand:()=>[],localCounts:()=>[]};
 const registry=createGameRegistry([base]);
 assert.deepEqual(gamePresentation(registry.get('sample-game')),
  {icon:'🃏',tagline:'',handOrder:'suit'});
 const withUi=createGameRegistry([{...base,ui:{icon:'⭐',tagline:'サンプル',handOrder:'strength'}}]);
 assert.equal(gamePresentation(withUi.get('sample-game')).handOrder,'strength');
 assert.equal(Object.isFrozen(withUi.get('sample-game').ui),true);
 assert.throws(()=>createGameRegistry([{...base,ui:{handOrder:'random'}}]),/INVALID_GAME_HAND_ORDER/);
});
test('Single-card game never claims an illegal selection is playable',()=>{
 const spec={interaction:'pick-one'};
 const view=sampleView({legal:{playIds:['0-7'],canPass:true}});
 assert.match(turnPrompt(view,spec,{selected:[],valid:false}),/光っている/);
 assert.match(turnPrompt(view,spec,{selected:['0-7'],valid:true}),/出せる/);
 assert.match(turnPrompt(view,spec,{selected:['0-9'],valid:false}),/出せません/);
 assert.match(turnPrompt({...view,legal:{playIds:[],canPass:true}},spec),/パス/);
});
test('Generic action prompts and connection heading cover future game styles',()=>{
 const view=sampleView();
 assert.match(turnPrompt(view,{interaction:'draw'}),/伏せ札/);
 assert.match(turnPrompt(view,{interaction:'flip'}),/2枚/);
 assert.equal(turnPrompt({...view,isMyTurn:false},{interaction:'flip'}),'');
 assert.equal(turnPrompt({...view,phase:'finished'},{interaction:'flip'}),'');
 assert.match(turnHeading(view,{label:'テスト',ui:{icon:'★'}}),/あなたの番/);
 assert.match(turnHeading({...view,isMyTurn:false,turn:1},{label:'テスト'}),/CPU2の番/);
 assert.match(turnHeading({...view,connection:{state:'reconnecting'}},{label:'テスト'}),/再接続中/);
});
