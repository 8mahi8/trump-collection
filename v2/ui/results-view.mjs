// Public, transport-agnostic score projection. Never reads hidden cards.
export function projectMatchResults({participants,members=[],selfId=null,ranks=null,
 scores=null,isCpu=()=>false}={}){
 if(!Array.isArray(participants))return [];
 const rows=participants.map((id,seat)=>{
  const rank=ranks?.[seat]??null;
  const score=scores?.[seat]??null;
  return {seat,id,
   name:id===selfId?'自分':isCpu(id)?'CPU'+(seat+1):
    'P'+(members.includes(id)?members.indexOf(id)+1:seat+1),
   rank:Number.isFinite(rank)?rank:null,
   score:Number.isFinite(score)?score:null,
   isYou:id===selfId};
 }).filter(row=>row.rank!==null||row.score!==null);
 rows.sort((a,b)=>{
  if(a.rank!==null&&b.rank!==null)return a.rank-b.rank||a.seat-b.seat;
  if((a.rank!==null)!==(b.rank!==null))return a.rank!==null?-1:1;
  return (b.score??0)-(a.score??0)||a.seat-b.seat;
 });
 return rows;
}
