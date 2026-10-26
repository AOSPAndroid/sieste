import type {Workout} from './analytics';
import {cadenceUnit,runningPace,sportFamily} from './sports';
import {tredictActivityVo2} from './vo2-tracking';

export type ActivityMetricKey='vo2'|'heartrate'|'pace'|'speed'|'power'|'duration'|'distance'|'calories'|'cadence'|'ascent'|'load';
export type ActivityMetric={key:ActivityMetricKey;label:string;unit:string;color:string;dash?:string};
const number=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const positive=(v:unknown):number|null=>number(v)!==null&&(v as number)>0?v as number:null;

/** Source values only. Missing readings never become zero or inherit another provider's VO2. */
export function activityMetricValue(a:Workout,key:ActivityMetricKey):number|null{
 const s=a.summary??{},family=sportFamily(a),distance=number(s.distance),duration=positive(s.duration);
 switch(key){
  case 'vo2':return tredictActivityVo2(a);
  case 'heartrate':return positive(s.heartrate);
  case 'pace':return ['running','walking','hiking'].includes(family)?positive(s.pace)??(distance!==null&&distance>0&&duration!==null?duration/distance*1000:null):null;
  case 'speed':return family==='cycling'?(number(s.speed)!==null?s.speed*3.6:distance!==null&&duration!==null?distance/duration*3.6:null):null;
  case 'duration':return number(s.duration)===null?null:s.duration/60;
  case 'distance':return family==='strength_training'||distance===null?null:distance/1000;
  case 'power':return number(s.power);
  case 'calories':return number(s.calories);
  case 'cadence':return number(s.cadence);
  case 'ascent':return number(s.altitude?.ascent);
  case 'load':return number(s.trainingLoad);
 }
}

export function activityMetrics(family:string):ActivityMetric[]{
 return [
  {key:'vo2',label:'VO₂ · Tredict',unit:'ml/kg/min',color:'var(--comparison-vo2)'},
  {key:'heartrate',label:'Avg HR',unit:'bpm',color:'var(--comparison-hr)'},
  {key:'pace',label:'Pace',unit:'min/km',color:'var(--comparison-pace)'},
  {key:'speed',label:'Speed',unit:'km/h',color:'var(--comparison-pace)'},
  {key:'power',label:'Power',unit:'W',color:'var(--comparison-power)'},
  {key:'duration',label:'Time',unit:'min',color:'var(--comparison-time)',dash:'5 3'},
  {key:'distance',label:'Distance',unit:'km',color:'var(--comparison-distance)',dash:'5 3'},
  {key:'calories',label:'Calories',unit:'kcal',color:'var(--comparison-power)',dash:'2 3'},
  {key:'cadence',label:'Cadence',unit:cadenceUnit(family),color:'var(--comparison-hr)',dash:'5 3'},
  {key:'ascent',label:'Ascent',unit:'m',color:'var(--comparison-distance)',dash:'2 3'},
  {key:'load',label:'Load',unit:'points',color:'var(--comparison-time)',dash:'2 3'},
 ];
}

/** One sport per plot: run/ride VO2 and sport-specific pace/cadence remain separate. */
export function activityComparison(activities:Workout[],family:string){
 const rows=activities.filter(a=>sportFamily(a)===family&&Number.isFinite(Date.parse(a.date))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id));
 const series=activityMetrics(family).flatMap(metric=>{
  const values=rows.map(a=>activityMetricValue(a,metric.key)),known=values.filter((v):v is number=>v!==null);
  if(!known.length)return [];
  return [{...metric,values,min:Math.min(...known),max:Math.max(...known),count:known.length}];
 });
 return {rows,series};
}

/** Independent ranges allow unlike units to share one plot without equating their values. */
export function activityMetricPosition(value:number|null,min:number,max:number):number|null{
 if(value===null||!Number.isFinite(value)||!Number.isFinite(min)||!Number.isFinite(max))return null;
 return max===min?50:(value-min)/(max-min)*100;
}

export function formatActivityMetric(key:ActivityMetricKey,value:number|null){
 if(value===null)return '—';
 if(key==='pace')return runningPace(value).replace(' /km','');
 if(key==='duration'){const minutes=Math.round(value);return minutes>=60?`${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`:`${minutes} min`;}
 return value.toLocaleString('en-GB',{minimumFractionDigits:key==='vo2'?1:0,maximumFractionDigits:['vo2','distance','speed'].includes(key)?1:0});
}

export function activityMetricPath(values:(number|null)[],position:(value:number)=>{x:number;y:number}){
 let connected=false;
 return values.map((value,index)=>{
  if(value===null){connected=false;return '';}
  const p=position(index),command=connected?'L':'M';connected=true;
  return `${command}${p.x},${p.y}`;
 }).join(' ');
}
