import test from 'node:test';
import assert from 'node:assert/strict';
import {daifugoStrength,sortHandForGame} from '../v2/ui/card-order.mjs';
import {flattenChat} from '../v2/ui/room-chat.mjs';

test('Daifugo default strength order is 3..K, A, 2, Joker (not A,2,3)',()=>{
 const hand=[{rank:1,suit:1},{rank:2,suit:0},{rank:13,suit:3},
  {rank:3,suit:0},{rank:10,suit:0},{rank:4,suit:2},{joker:true}];
 const result=sortHandForGame(hand,'daifugo',{bySuit:false});
 assert.deepEqual(result.map(c=>c.joker?'JK':c.rank),[3,4,10,13,1,2,'JK']);
 assert.deepEqual(result.filter(c=>!c.joker).map(daifugoStrength),[0,1,7,10,11,12]);
 assert.deepEqual(hand.map(c=>c.joker?'JK':c.rank),[1,2,13,3,10,4,'JK'],
  'must not mutate authority hand');
});
test('suit grouping can be toggled in either direction',()=>{
 const hand=[{rank:2,suit:1},{rank:7,suit:0},{rank:1,suit:3},
  {rank:3,suit:1},{rank:13,suit:0}];
 assert.deepEqual(sortHandForGame(hand,'daifugo',{bySuit:true}).map(c=>c.suit),[0,0,1,1,3]);
 assert.deepEqual(sortHandForGame(hand,'shichinarabe',{bySuit:false}).map(c=>c.rank),[1,2,3,7,13]);
 assert.deepEqual(sortHandForGame(hand,'shichinarabe',{bySuit:true}).map(c=>c.suit),[0,0,1,1,3]);
});
test('room chat sorting, bound, wrong actors, unsafe text are all text values',()=>{
 const members=['testMember0001','testMember0002'];
 const chat={testMember0001:{0:{actor:members[0],id:'ab000001',text:'<img src=x onerror=alert(1)>',time:10}},
  testMember0002:{0:{actor:members[1],id:'ab000002',text:'こんにちは',time:11},
   1:{actor:members[0],id:'ab000003',text:'spoof',time:12}},
  stranger:{0:{actor:'stranger',id:'ab000004',text:'not a member',time:13}}};
 const result=flattenChat(chat,members);
 assert.deepEqual(result.map(m=>m.text),['<img src=x onerror=alert(1)>','こんにちは']);
});
test('room chat keeps only the most recent 40 messages',()=>{
 const chat={testMember0001:{}};
 for(let i=0;i<50;i++)chat.testMember0001[i]={actor:'testMember0001',id:'mid'+i,
  text:'message '+i,time:i};
 const result=flattenChat(chat,['testMember0001']);
 assert.equal(result.length,40);
 assert.equal(result[0].time,10);assert.equal(result.at(-1).time,49);
});
