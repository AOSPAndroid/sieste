import {sportFamily,sportName,workoutSpeed} from './sports';
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const fmt=(v:number,n=1)=>v.toLocaleString('en-GB',{maximumFractionDigits:n});
export function activityShareData(activity:Record<string,any>){
 const s=activity.summary??{},family=sportFamily(activity),stats:{key:string;label:string;value:string;unit:string}[]=[];
 const add=(key:string,label:string,v:unknown,unit:string,n=0)=>{if(finite(v))stats.push({key,label,value:fmt(v,n),unit})};
 if(family!=='strength_training')add('distance','Distance',finite(s.distance)?s.distance/1000:null,'km',2);
 if(finite(s.duration)){const seconds=Math.round(s.duration),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),sec=seconds%60;stats.push({key:'duration',label:'Activity time',value:h?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}`,unit:h?'h:mm:ss':'min:sec'})}
 if(['running','walking','hiking'].includes(family)){const pace=finite(s.pace)&&s.pace>0?s.pace:finite(s.distance)&&s.distance>0&&finite(s.duration)&&s.duration>0?s.duration/s.distance*1000:null;if(pace!==null){const p=Math.round(pace);stats.push({key:'pace',label:'Average pace',value:`${Math.floor(p/60)}:${String(p%60).padStart(2,'0')}`,unit:'/km'})}}
 if(family==='cycling'){add('speed','Average speed',workoutSpeed(activity),'km/h',1);add('power','Average power',s.power,'W')}
 add('hr','Average heart rate',s.heartrate,'bpm');add('ascent','Elevation gain',s.altitude?.ascent,'m');add('calories','Workout calories',s.calories,'kcal');
 if(['running','cycling'].includes(family))add('cadence','Average cadence',s.cadence,family==='cycling'?'rpm':'steps/min');
 return {family,sport:sportName(family),stats,color:family==='cycling'?'#7c3aed':family==='strength_training'?'#b76a08':'#2563eb'};
}
