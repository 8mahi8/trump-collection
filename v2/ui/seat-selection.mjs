// Projection only. Any future two-seat game can reuse the four-person lobby.
// Seats and membership come from the confirmed room snapshot, never DOM order.
export function projectHeadToHead(room,{selfId,isCpuSeat}={}){
 const members=Array.isArray(room?.members)?room.members:[];
 const participants=Array.isArray(room?.participants)?room.participants:[];
 const asLabel=id=>{
  const member=members.indexOf(id);
  if(member>=0)return 'P'+(member+1);
  const seat=participants.indexOf(id);
  return typeof isCpuSeat==='function'&&isCpuSeat(room,id)&&seat>=0?'CPU'+(seat+1):'未選択';
 };
 const players=participants.map(asLabel);
 const spectators=members.filter(id=>!participants.includes(id)).map(asLabel);
 const opponents=members.filter(id=>id!==room.hostId).map(id=>({
  id,label:asLabel(id),selected:participants.includes(id)
 }));
 return {
  players,spectators,opponents,
  selfRole:participants.includes(selfId)?'player':
   members.includes(selfId)?'spectator':'pending',
  matchup:players.join(' VS '),
  spectatorLine:spectators.length?'観戦：'+spectators.join('・'):'観戦：なし'
 };
}
