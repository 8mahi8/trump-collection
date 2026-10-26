// Limit idle RTDB REST polling on older school iPads and Firebase Spark.
// No timers or state here: callers choose when to schedule a fresh tick.
// Gameplay and ACK traffic stay responsive; retry traffic uses backoff.
export function nextFirebasePollDelay({phase='lobby',isHost=false,pendingAction=false,
 status='ready',failCount=0,myTurn=false}={}){
 if(!Number.isSafeInteger(failCount)||failCount<0)throw Error('INVALID_FAILURE_COUNT');
 if(failCount>0)return Math.min(1200+failCount*700,6000);
 if(pendingAction)return 250;
 if(status==='host_unavailable')return 2300;
 if(status==='waiting_for_host')return 1500;
 if(status==='syncing'||status==='stale')return 700;
 if(phase==='playing')return isHost||myTurn?650:900;
 if(phase==='finished')return isHost?1600:2000;
 return isHost?1000:1500;
}
