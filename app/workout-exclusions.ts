export type WorkoutExclusion={id:string;date:string};
export function applyWorkoutExclusions<T extends {activities:any[];excludedWorkouts?:WorkoutExclusion[]}>(data:T,excluded:WorkoutExclusion[]):T{const ids=new Set(excluded.map(e=>e.id));return {...data,activities:data.activities.filter(a=>!ids.has(a.id)&&!(typeof a.fallbackId==='string'&&ids.has(a.fallbackId))),excludedWorkouts:excluded}}
export function workoutChangeConfirmed(excluded:unknown,id:string,removed:boolean):excluded is WorkoutExclusion[]{return Array.isArray(excluded)&&excluded.every(e=>e&&typeof e.id==='string'&&typeof e.date==='string')&&excluded.some(e=>e.id===id)===removed;}
export type WorkoutChange={activity:{id:string;date:string;fallbackId?:string};excluded:WorkoutExclusion[];removed:boolean};
/** Replay acknowledged edits over a refresh that started before those edits. */
export function applyWorkoutChanges<T extends {activities:any[];excludedWorkouts?:WorkoutExclusion[]}>(data:T,changes:WorkoutChange[]):T{
 let next=data;
 for(const change of changes){
  const activities=change.removed?next.activities:[...next.activities.filter(a=>a.id!==change.activity.id),change.activity].sort((a,b)=>b.date.localeCompare(a.date));
  next=applyWorkoutExclusions({...next,activities},change.excluded);
 }
 return next;
}
export function effortExcluded(data:any,day:string){const iso=day.includes('-')?day:`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6)}`;return (data.excludedWorkouts??[]).some((e:WorkoutExclusion)=>{const d=new Date(e.date),local=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return e.date.slice(0,10)===iso||local===iso})}
