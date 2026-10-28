// Presentation-only hints from authority-provided legal moves.
 // Never infer Daifugo rules from ranks here: revolution, stairs and special
 // hands are already reflected in the legalMoves supplied by the game engine.
export function describeDaifugoSelection(legalMoves=[],selected=[]){
 const picked=new Set(selected);
 const sets=legalMoves.map(move=>new Set(move));
 const candidates=sets.filter(move=>[...picked].every(id=>move.has(id)));
 const exact=picked.size>0&&candidates.some(move=>move.size===picked.size);
 const followups=new Set();
 for(const move of candidates)for(const id of move)if(!picked.has(id))followups.add(id);
 let text;
 if(!picked.size){
  text=sets.length?'出せる組み合わせ '+sets.length+'通り · カードを選択':
   '出せる組み合わせなし · パスできます';
 }else if(!candidates.length){
  text='この組み合わせは出せません · 選択を解除して選び直そう';
 }else if(exact){
  text='✓ '+picked.size+'枚の組み合わせで出せます';
 }else{
  const needed=Math.min(...candidates.map(move=>move.size-picked.size));
  text='あと'+needed+'枚以上選ぶと出せます';
 }
 return {exact,possible:candidates.length>0,text,followups:[...followups]};
}
