export type AlertActivity={id:string;date:string;title?:string;fallbackId?:string;mergedIds?:string[];sportType:string;summary?:{distance?:number;duration?:number}};
export type AlertSnapshot={activities:AlertActivity[];excludedWorkouts?:{id:string;date:string}[];sleep?:Record<string,number[]>};
export type SleepAlertState={seen:string[];lastNotifiedDay?:string};
export type ActivityAlertState={version:1;enabled:boolean;notBefore:number;seen:string[];sleep?:SleepAlertState};
const sleepDay=(now:number)=>{const d=new Date(now);return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`};
const sleepSeconds=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=86400;
function validSleepDate(day:string){if(!/^\d{8}$/.test(day)||+day.slice(0,4)<1900)return false;const d=new Date(Date.UTC(+day.slice(0,4),+day.slice(4,6)-1,+day.slice(6,8)));return d.toISOString().slice(0,10).replaceAll('-','')===day}
export function validSleepAlertState(value:unknown):value is SleepAlertState{
 if(!value||typeof value!=='object')return false;const state=value as SleepAlertState;
 return Array.isArray(state.seen)&&state.seen.length<=730&&state.seen.every(day=>typeof day==='string'&&validSleepDate(day))&&(state.lastNotifiedDay===undefined||typeof state.lastNotifiedDay==='string'&&validSleepDate(state.lastNotifiedDay));
}
/** Restored main-sleep dates become known without generating a notification. */
export function sleepAlertBaseline(data:AlertSnapshot,previous?:SleepAlertState,now=Date.now()):SleepAlertState{
 const today=sleepDay(now),dates=Object.entries(data.sleep??{}).filter(([day,values])=>validSleepDate(day)&&day<=today&&sleepSeconds(values?.[0])).map(([day])=>day);
 return {...previous,seen:[...new Set([...dates,...(previous?.seen??[])])].sort().reverse().slice(0,730)};
}
/** Alert only on a new main-sleep reading for today's local wake date. */
export function retrievedSleepAlert(state:SleepAlertState,data:AlertSnapshot,now=Date.now()){
 const today=sleepDay(now),seconds=data.sleep?.[today]?.[0];
 const sleep=sleepSeconds(seconds)&&!state.seen.includes(today)&&state.lastNotifiedDay!==today?{date:today,seconds}:null;
 return {sleep,state:{...sleepAlertBaseline(data,state,now),...(sleep?{lastNotifiedDay:today}:{})}};
}
const keys=(activity:AlertActivity)=>[activity.id,...(activity.fallbackId?[activity.fallbackId]:[]),...(activity.mergedIds??[])];
export function activityAlertBaseline(data:AlertSnapshot,now=Date.now()):ActivityAlertState{
 const midnight=new Date(now);midnight.setHours(0,0,0,0);
 return {version:1,enabled:true,notBefore:midnight.getTime(),seen:activityAlertSeen([],data),sleep:sleepAlertBaseline(data,undefined,now)};
}
export function activityAlertSeen(seen:string[],data:AlertSnapshot){
 const recent=[...data.activities].sort((a,b)=>b.date.localeCompare(a.date));
 return [...new Set([...(data.excludedWorkouts??[]).map(a=>a.id),...recent.flatMap(keys),...seen])].slice(0,6000);
}
/** Only call after successful retrieval; restores, edits and health never invent events. */
export function retrievedActivityAlerts(state:ActivityAlertState,data:AlertSnapshot,now=Date.now()){
 const seen=new Set(state.seen),excluded=new Set((data.excludedWorkouts??[]).map(a=>a.id)),lower=Math.max(state.notBefore,now-36*3600000);
 const activities=state.enabled?data.activities.filter(a=>{
  const timestamp=Date.parse(a.date);
  if(a.id.startsWith('demo-')||a.id.startsWith('merged_')||a.mergedIds?.length||keys(a).some(id=>excluded.has(id)||seen.has(id))||!Number.isFinite(timestamp)||timestamp<lower||timestamp>now+300000)return false;
  keys(a).forEach(id=>seen.add(id));return true;
 }).sort((a,b)=>b.date.localeCompare(a.date)):[];
 return {activities,state:{...state,seen:activityAlertSeen(state.seen,data)}};
}
