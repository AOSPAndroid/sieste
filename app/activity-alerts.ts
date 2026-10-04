export type AlertActivity={id:string;date:string;title?:string;fallbackId?:string;mergedIds?:string[];sportType:string;summary?:{distance?:number;duration?:number}};
export type AlertSnapshot={activities:AlertActivity[];excludedWorkouts?:{id:string;date:string}[]};
export type ActivityAlertState={version:1;enabled:boolean;notBefore:number;seen:string[]};
const keys=(activity:AlertActivity)=>[activity.id,...(activity.fallbackId?[activity.fallbackId]:[]),...(activity.mergedIds??[])];
export function activityAlertBaseline(data:AlertSnapshot,now=Date.now()):ActivityAlertState{
 const midnight=new Date(now);midnight.setHours(0,0,0,0);
 return {version:1,enabled:true,notBefore:midnight.getTime(),seen:activityAlertSeen([],data)};
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
