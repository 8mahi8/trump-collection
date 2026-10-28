// Shared friend-room status messages. A message must reflect the LATEST
// confirmed snapshot, not a stale async "creating..." or "sending..." label.
// Game names are read from the registry, not copied into the room UI.
export function roomNotice(snapshot,{selfId=null,isHost=false,registry}={}){
 if(!snapshot||!registry)return '';
 const room='部屋 '+snapshot.roomCode;
 const members=Array.isArray(snapshot.members)?snapshot.members:[];
 const participants=Array.isArray(snapshot.participants)?snapshot.participants:[];
 const ready=Array.isArray(snapshot.ready)?snapshot.ready:[];
 if(!members.includes(selfId))return room+' · 入室確認中';
 const gameId=snapshot.selectedGame;
 if(!gameId||!registry.has(gameId))
  return room+(isHost?' · ゲームを選んでください':' · ホストがゲームを選択中');
 const spec=registry.get(gameId);
 const humans=participants.filter(id=>members.includes(id));
 const readyHumans=humans.filter(id=>ready.includes(id));
 const count=readyHumans.length+'/'+humans.length+'人';
 if(!participants.includes(selfId))return room+' · '+spec.label+' · 今回は観戦（準備不要）';
 if(!ready.includes(selfId))
  return room+' · '+spec.label+' · 準備完了を押そう';
 if(participants.length===spec.seats&&readyHumans.length===humans.length)
  return room+' · '+spec.label+(isHost?' · 全員準備OK！対局開始':
   ' · 全員準備OK！ホストの開始待ち');
 return room+' · '+spec.label+' · 準備待ち '+count;
}
export function matchNotice(code,{gameLabel='',phase='playing'}={}){
 const room='部屋 '+code;
 if(phase==='results')return room+' · 対局終了 · 同じ部屋で次のゲームへ';
 if(phase==='spectator')return room+' · 対戦終了まで待機中';
 return room+' · '+(gameLabel?gameLabel+' · ':'')+'オンライン対戦中';
}
