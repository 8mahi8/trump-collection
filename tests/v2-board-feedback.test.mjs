import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoardSurface} from '../v2/ui/board-surfaces.mjs';

// Headless DOM stub: game surfaces should consume their ViewModel only and
// avoid depending on browser/layout globals when deciding legal-slot cues.
class FakeElement{
 constructor(tag){
  this.tagName=tag;this.className='';this.textContent='';this.children=[];
  this.attributes={};this.dataset={};this.style={};
  this.classList={add:(name)=>{this.className+=(this.className?' ':'')+name;}};
 }
 append(...children){this.children.push(...children);}
 setAttribute(key,value){this.attributes[key]=String(value);}
 get childElementCount(){return this.children.length;}
}
globalThis.document={createElement:(tag)=>new FakeElement(tag)};
const childrenByClass=(root,name)=>{
 const out=[];
 const walk=node=>{
  if(node?.className?.split(' ').includes(name))out.push(node);
  for(const child of node?.children||[])walk(child);
 };
 walk(root);return out;
};
const base=(game,kind,board)=>({
 game,board:{kind,...board},seat:0,turn:0,isMyTurn:true,phase:'playing',
 players:[
  {seat:0,isYou:true,isCpu:false,cardCount:5},
  {seat:1,isYou:false,isCpu:true,cardCount:6},
  {seat:2,isYou:false,isCpu:false,cardCount:7},
  {seat:3,isYou:false,isCpu:false,cardCount:8}
 ],
 legal:{drawIndices:[],playIds:[],playMoves:[],flipIndices:[],canPass:false}
});
test('Babanuki tells the human whose cards they are drawing',()=>{
 const view=base('babanuki','draw',{drawFrom:1});
 view.legal.drawIndices=[0,1,2,3,4,5];
 const board=createBoardSurface(view);
 const hint=childrenByClass(board,'v2-board-hint')[0];
 assert.match(hint.textContent,/CPU2から1枚引こう/);
 assert.equal(childrenByClass(board,'v2-back').length,6);
});
test('Babanuki waiting message names the actor and target separately',()=>{
 const view=base('babanuki','draw',{drawFrom:1});
 view.isMyTurn=false;view.turn=2;
 const board=createBoardSurface(view);
 assert.match(childrenByClass(board,'v2-board-hint')[0].textContent,/P3がCPU2のカードを引いています/);
});
test('Sevens renders 52 slots, face ranks, and only true legal placements as bright',()=>{
 const view=base('shichinarabe','seven',{
  placed:[{low:7,high:7},{low:7,high:7},{low:7,high:7},{low:7,high:7}]
 });
 view.legal.playIds=['0-6','1-8','2-6'];
 const board=createBoardSurface(view);
 const slots=childrenByClass(board,'v2-seven-cell');
 const ready=childrenByClass(board,'v2-ready');
 assert.equal(slots.length,52);
 assert.equal(ready.length,3);
 assert.equal(childrenByClass(board,'v2-placed').length,4);
 assert.equal(slots[0].textContent,'A');
 assert.equal(slots[10].textContent,'J');
 assert.equal(slots[11].textContent,'Q');
 assert.equal(slots[12].textContent,'K');
 assert.match(ready[0].attributes['aria-label'],/置ける場所/);
});
test('Sevens does not reveal own legal targets during opponent turn',()=>{
 const view=base('shichinarabe','seven',{
  placed:[{low:7,high:7},{low:7,high:7},{low:7,high:7},{low:7,high:7}]
 });
 view.isMyTurn=false;view.legal.playIds=['0-6'];
 const board=createBoardSurface(view);
 assert.equal(childrenByClass(board,'v2-ready').length,0);
 assert.equal(childrenByClass(board,'v2-next').length,8);
});
