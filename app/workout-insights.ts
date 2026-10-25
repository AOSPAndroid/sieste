// How hard each part of a workout was, and which section view (efforts,
// climbs or laps) tells the session's story best.
export type SectionMode='efforts'|'climbs'|'laps';
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
type Lap={distance?:unknown;summary?:{distance?:unknown}};
type WorkoutLike={seriesSampled?:{sampleSize?:unknown;data?:Record<string,unknown>};laps?:Lap[];sessionLabel?:string|null;[key:string]:unknown};
const footFamilies=['running','walking','hiking'];

/** The stream efforts are detected from by default: power on the bike, pace on foot, heart rate otherwise. */
export function effortSensor(detail:WorkoutLike,family:string){
 const streams=detail.seriesSampled?.data??{},has=(key:string)=>{const values=streams[key];return Array.isArray(values)&&values.some((v:unknown)=>valid(v)&&(key==='heartrate'?v>0:v>=0))};
 if(family==='cycling')return has('power')?'power':has('heartrate')?'heartrate':'speed';
 if([...footFamilies,'swimming'].includes(family))return has('speed')?'speed':has('power')?'power':'heartrate';
 return has('power')?'power':has('speed')?'speed':'heartrate';
}

/** Laps that differ in length were pressed by hand (or planned), so they carry the session's structure. */
export function lapsVary(laps:Lap[]|undefined){
 const distances=(laps??[]).map(l=>l?.summary?.distance??l?.distance).filter((d:unknown):d is number=>valid(d)&&d>0).slice(0,-1);
 if(distances.length<2)return false;
 const mean=distances.reduce((a,b)=>a+b,0)/distances.length;
 return Math.sqrt(distances.reduce((a,d)=>a+(d-mean)**2,0)/distances.length)/mean>.08;
}

/** Interval and tempo work opens on efforts, hilly routes on climbs, structured laps on laps. */
export function sectionMode({label,efforts,climbs,gain,laps,structuredLaps}:{label:string;efforts:number;climbs:number;gain:number;laps:number;structuredLaps:boolean}):SectionMode|null{
 if(['Intervals','Tempo','Race'].includes(label)&&efforts>0)return 'efforts';
 if(climbs>0&&(gain>=60||climbs>=3))return 'climbs';
 if(laps>=2&&structuredLaps)return 'laps';
 if(efforts>=3)return 'efforts';
 return efforts?'efforts':climbs?'climbs':laps?'laps':null;
}

export const intensityColors=['#60a5fa','#34d399','#facc15','#fb923c','#ef4444'];
/**
 * One level per sample (0 easy … 4 hardest) from the effort stream, smoothed
 * over 30 s and split at this workout's own 20/40/60/80th percentiles, so the
 * route shows where you pushed relative to the rest of the session.
 */
export function intensityLevels(detail:WorkoutLike,family:string){
 const sensor=effortSensor(detail,family),step=detail.seriesSampled?.sampleSize,raw=detail.seriesSampled?.data?.[sensor];
 if(!valid(step)||step<=0||!Array.isArray(raw))return null;
 // Stopped samples (no speed, no power) are gaps, not easy riding.
 const values=raw.map(v=>valid(v)&&v>0?v:null),half=Math.max(0,Math.round(15/step)),smooth:(number|null)[]=values.map((v,i)=>{if(v===null)return null;let sum=0,n=0;for(let j=Math.max(0,i-half);j<=Math.min(values.length-1,i+half);j++){const x=values[j];if(x!==null){sum+=x;n++}}return n?sum/n:null});
 const sorted=smooth.filter(valid).sort((a,b)=>a-b);if(sorted.length<10||sorted[0]===sorted.at(-1))return null;
 const cuts=[.2,.4,.6,.8].map(q=>sorted[Math.min(sorted.length-1,Math.floor(q*sorted.length))]);
 return {sensor,levels:smooth.map(v=>v===null?null:cuts.filter(c=>v>c).length)};
}
