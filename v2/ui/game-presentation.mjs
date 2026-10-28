// The same presentation contract is consumed by the lobby and shared table.
// It is OPTIONAL for new game plugins: existing games keep functional defaults.
// No rule decisions, Firebase state, player secrets or action mutations here.
export function gamePresentation(spec){
 const ui=spec?.ui||{};
 return {
  icon:typeof ui.icon==='string'&&ui.icon?ui.icon:'🃏',
  tagline:typeof ui.tagline==='string'?ui.tagline:'',
  handOrder:ui.handOrder==='strength'?'strength':'suit',
  resultUnit:typeof ui.resultUnit==='string'?ui.resultUnit:'点'
 };
}
export function turnPrompt(view,spec,{selected=[],valid=false,combo=null}={}){
 if(view.phase!=='playing'||!view.isMyTurn)return '';
 const legal=view.legal||{};
 switch(spec.interaction){
  case 'pick-one':
   if(selected.length)return valid?'✓ 出せるカードを選択中':'この札は今は出せません';
   return legal.playIds?.length?'光っているカードを選んで出そう':
    legal.canPass?'出せるカードなし · パスしよう':'出せるカードを待っています';
  case 'pick-multi':
   return combo?.text||'出せる組み合わせを選ぼう';
  case 'draw':
   return '相手の伏せ札を1枚タップして引こう';
  case 'flip':
   return '裏向きのカードを2枚めくろう';
  default:
   return 'カードや盤面をタップして進めよう';
 }
}
export function turnHeading(view,spec){
 const icon=gamePresentation(spec).icon;
 if(view.phase==='finished')return icon+' '+spec.label+' · 対局終了';
 if(view.connection?.state==='reconnecting')return icon+' '+spec.label+' · 再接続中';
 if(view.connection?.state==='closed')return icon+' '+spec.label+' · 接続終了';
 const p=view.players?.[view.turn];
 const who=view.isMyTurn?'あなたの番':
  p?.isCpu?'CPU'+(view.turn+1)+'の番':
  Number.isInteger(view.turn)?'P'+(view.turn+1)+'の番':'準備中';
 const connection=view.connection?.state==='connected'?' · ●オンライン':
  view.connection?.state==='local'?' · ●CPU戦':'';
 return icon+' '+spec.label+' · '+who+connection;
}
