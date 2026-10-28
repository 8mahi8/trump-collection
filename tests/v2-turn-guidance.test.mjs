import test from 'node:test';
import assert from 'node:assert/strict';
import {describeDaifugoSelection} from '../v2/ui/turn-guidance.mjs';

test('Daifugo feedback uses authority legalMoves, not assumed rank rules',()=>{
 const moves=[['0-3'],['0-4','1-4'],['2-7','3-7'],['JK']];
 const empty=describeDaifugoSelection(moves,[]);
 assert.match(empty.text,/4通り/);
 assert.equal(empty.exact,false);
 const one=describeDaifugoSelection(moves,['0-4']);
 assert.equal(one.exact,false);
 assert.equal(one.possible,true);
 assert.deepEqual(one.followups,['1-4']);
 assert.match(one.text,/あと1枚/);
 const pair=describeDaifugoSelection(moves,['1-4','0-4']);
 assert.equal(pair.exact,true);
 assert.match(pair.text,/2枚/);
 const invalid=describeDaifugoSelection(moves,['0-3','JK']);
 assert.equal(invalid.possible,false);
 assert.match(invalid.text,/出せません/);
});
test('No playable combination offers pass guidance without modifying legal moves',()=>{
 const moves=[];
 assert.match(describeDaifugoSelection(moves,[]).text,/パス/);
 assert.equal(moves.length,0);
});
test('Invalid selection can be recovered from a later valid selection',()=>{
 const moves=[['0-3','1-3'],['3-9']];
 assert.equal(describeDaifugoSelection(moves,['1-3','3-9']).possible,false);
 assert.equal(describeDaifugoSelection(moves,['0-3','1-3']).exact,true);
});

test('Precomputed legal move Sets can be reused without mutation',()=>{
 const moveA=new Set(['0-3','1-3']);
 const moveB=new Set(['2-8']);
 const out=describeDaifugoSelection([moveA,moveB],['0-3']);
 assert.equal(out.exact,false);
 assert.deepEqual(out.followups,['1-3']);
 assert.equal(moveA.size,2);
});
