import {effortProfile} from './effort-profile-data';
import {sportFamily} from './sports';

const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const reading=(v:unknown,min=0,max=Infinity)=>finite(v)&&v>=min&&v<=max?v:null;
export type ReplayRow={index:number;seconds:number;weight:number;speed:number|null;power:number|null;hr:number|null;cadence:number|null;altitude:number|null;distance:number|null;grade:number|null;terrain:'uphill'|'flat'|'downhill'|null};
export type ReplayRange={start:number;end:number};
export type TerrainBucket={key:'uphill'|'flat'|'downhill';seconds:number;percent:number;speed:number|null;power:number|null;hr:number|null;cadence:number|null;ranges:ReplayRange[]};
export type FingerprintPoint={start:number;end:number;index:number;output:number;hr:number;cadence:number|null;grade:number;phase:number};
const mean=(rows:ReplayRow[],key:'speed'|'power'|'hr'|'cadence',positive=false)=>{
 let total=0,weight=0;for(const r of rows){const v=r[key];if(v!==null&&(!positive||v>0)){total+=v*r.weight;weight+=r.weight}}return weight?total/weight:null;
};
export function replayRanges(rows:ReplayRow[],predicate:(r:ReplayRow)=>boolean){
 const ranges:ReplayRange[]=[];for(const row of rows){if(!predicate(row))continue;const start=row.seconds/60,end=(row.seconds+row.weight)/60,last=ranges.at(-1);if(last&&Math.abs(last.end-start)<1e-8)last.end=end;else ranges.push({start,end})}return ranges;
}
function rowsFor(detail:any,family:string){
 const streams=detail.seriesSampled?.data??{},step=detail.seriesSampled?.sampleSize;
 if(!finite(step)||step<=0||step>60)return {rows:[] as ReplayRow[],step:0,reason:'Timed samples at least once a minute are needed.'};
 const n=Math.max(0,...['speed','power','heartrate','cadence','altitude','distance','positionLat','positionLong','grade'].map(key=>Array.isArray(streams[key])?streams[key].length:0));
 if(n>604800)return {rows:[] as ReplayRow[],step,reason:'This recording is too large for replay.'};
 const cap=finite(detail.summary?.durationTotal)&&detail.summary.durationTotal>=0?Math.min(detail.summary.durationTotal,n*step):n*step;
 const rows:ReplayRow[]=[];for(let i=0;i<n&&i*step<cap;i++)rows.push({index:i,seconds:i*step,weight:Math.min(step,cap-i*step),speed:reading(streams.speed?.[i],0,50),power:reading(streams.power?.[i],0,5000),hr:reading(streams.heartrate?.[i],25,240),cadence:reading(streams.cadence?.[i],0,350),altitude:reading(streams.altitude?.[i],-500,9000),distance:reading(streams.distance?.[i]),grade:reading(streams.grade?.[i],-50,50),terrain:null});
 // Estimate local grade only inside uninterrupted moving elevation/distance
 // chunks. A reset, stop or absent measurement prevents smoothing across it.
 const movingSpeed=family==='cycling'?1:.5;
 const chunks:ReplayRow[][]=[];let chunk:ReplayRow[]=[];
 const flush=()=>{if(chunk.length)chunks.push(chunk);chunk=[]};
 for(const row of rows){const prior=chunk.at(-1);if(row.speed===null||row.speed<=movingSpeed||row.altitude===null||row.distance===null){flush();continue}if(prior&&(row.distance!<prior.distance!||row.distance!-prior.distance!<=.05||Math.abs(row.altitude!-prior.altitude!)>Math.max(8,step*2)))flush();chunk.push(row)}flush();
 for(const part of chunks){let left=0,right=0;for(let i=0;i<part.length;i++){
  const r=part[i];while(left<i&&r.distance!-part[left].distance!>25)left++;
  right=Math.max(right,i);while(right+1<part.length&&part[right].distance!-r.distance!<25)right++;
  const a=part[left],b=part[right],metres=b.distance!-a.distance!;
  if(r.grade===null&&metres>=20&&b.seconds>a.seconds)r.grade=reading((b.altitude!-a.altitude!)/metres*100,-50,50);
 }}
 for(const row of rows)if(row.speed!==null&&row.speed>movingSpeed&&row.grade!==null)row.terrain=row.grade>2?'uphill':row.grade< -2?'downhill':'flat';
 return {rows,step,reason:rows.length?null:'No timed sensor samples in this recording.'};
}
export function workoutReplayData(detail:any){
 const family=sportFamily(detail),cycling=family==='cycling',base=rowsFor(detail,family),{rows,step}=base;
 const seconds=rows.reduce((sum,r)=>sum+r.weight,0),moving=rows.filter(r=>r.speed!==null&&r.speed>(cycling?1:.5)),movingSeconds=moving.reduce((sum,r)=>sum+r.weight,0);
 const terrainSeconds=moving.filter(r=>r.terrain!==null).reduce((sum,r)=>sum+r.weight,0);
 const terrain:TerrainBucket[]=(['uphill','flat','downhill'] as const).map(key=>{const part=moving.filter(r=>r.terrain===key),time=part.reduce((sum,r)=>sum+r.weight,0);return {key,seconds:time,percent:terrainSeconds?time/terrainSeconds*100:0,speed:mean(part,'speed'),power:mean(part,'power'),hr:mean(part,'hr'),cadence:mean(part,'cadence',true),ranges:replayRanges(rows,r=>r.terrain===key)}});
 const powerRows=moving.filter(r=>r.power!==null),powerSeconds=powerRows.reduce((sum,r)=>sum+r.weight,0),zeroPowerRows=powerRows.filter(r=>r.power===0),zeroPowerSeconds=zeroPowerRows.reduce((sum,r)=>sum+r.weight,0),cadenceRows=moving.filter(r=>r.cadence!==null),cadenceSeconds=cadenceRows.reduce((sum,r)=>sum+r.weight,0);
 const positivePower=powerRows.some(r=>r.power!>0),positiveCadence=cadenceRows.some(r=>r.cadence!>0),zeroCadence=cadenceRows.some(r=>r.cadence===0);
 const confirmed=positiveCadence?zeroPowerRows.filter(r=>r.cadence===0).reduce((sum,r)=>sum+r.weight,0):0,unloaded=zeroPowerRows.filter(r=>r.cadence!==null&&r.cadence>0).reduce((sum,r)=>sum+r.weight,0),unknownCadence=zeroPowerSeconds-confirmed-unloaded;
 const method=positivePower?'power':positiveCadence&&zeroCadence?'cadence':'unavailable';
 // A power zero with positive cadence is unloaded pedalling, not coasting.
 // Without useful power, cadence can supply a separate estimate only when
 // the recording actually contains both pedalling and non-pedalling values.
 const coastPredicate=(r:ReplayRow)=>r.speed!==null&&r.speed>1&&(method==='power'?r.power===0&&(r.cadence===null||r.cadence===0):method==='cadence'?r.cadence===0:false);
 const coastingSeconds=rows.filter(coastPredicate).reduce((sum,r)=>sum+r.weight,0),classifiedSeconds=method==='power'?powerSeconds:method==='cadence'?cadenceSeconds:0;
 const coasting={method,seconds:coastingSeconds,percent:classifiedSeconds?coastingSeconds/classifiedSeconds*100:null,movingSeconds,classifiedSeconds,powerSeconds,cadenceSeconds,coverage:movingSeconds?powerSeconds/movingSeconds:0,measurementCoverage:movingSeconds?classifiedSeconds/movingSeconds:0,zeroPowerSeconds,zeroPowerPercent:powerSeconds?zeroPowerSeconds/powerSeconds*100:null,allPowerZero:powerRows.length>0&&!positivePower,allCadenceZero:cadenceRows.length>0&&!positiveCadence,confirmedSeconds:confirmed,unloadedSeconds:unloaded,unknownCadenceSeconds:unknownCadence,stoppedSeconds:rows.filter(r=>r.speed!==null&&r.speed<=1).reduce((sum,r)=>sum+r.weight,0),powerGapSeconds:movingSeconds-powerSeconds,cadenceGapSeconds:movingSeconds-cadenceSeconds,motionGapSeconds:rows.filter(r=>r.speed===null).reduce((sum,r)=>sum+r.weight,0),ranges:replayRanges(rows,coastPredicate)};
 // One-minute stable, flat moving blocks. Keep output bands represented in
 // both halves; this plot compares like output rather than all terrain.
 const fingerprintSource=cycling&&rows.some(r=>r.power!==null&&r.power>0)?'power':'speed';
 const blocks:FingerprintPoint[]=[];
 if(step>0&&step<=15&&seconds>=360){
  const first=120,last=seconds-60;let cursor=0;
  for(let t=first;t+60<=last;t+=60){while(cursor<rows.length&&rows[cursor].seconds+rows[cursor].weight<=t)cursor++;let end=cursor;while(end<rows.length&&rows[end].seconds<t+60)end++;const part=rows.slice(cursor,end).map(r=>({...r,weight:Math.min(r.seconds+r.weight,t+60)-Math.max(r.seconds,t)})),weight=part.reduce((sum,r)=>sum+r.weight,0),key=fingerprintSource;
   if(weight<60-1e-7||part.some(r=>r.speed===null||r.speed<=(cycling?1:.5)||r[key]===null||r[key]!<=0||r.hr===null||r.grade===null||Math.abs(r.grade)>2))continue;
   const output=mean(part,key)!,hr=mean(part,'hr')!,variance=part.reduce((sum,r)=>sum+(r[key]!-output)**2*r.weight,0)/weight;
   if(Math.sqrt(variance)/output>(fingerprintSource==='power'?.12:.06))continue;
   const grade=part.reduce((sum,r)=>sum+r.grade!*r.weight,0)/weight;if(Math.max(...part.map(r=>r.grade!))-Math.min(...part.map(r=>r.grade!))>1.5)continue;
   blocks.push({start:t/60,end:(t+60)/60,index:part[0].index,output,hr,cadence:mean(part,'cadence',true),grade,phase:Math.max(0,Math.min(1,t/seconds))});
  }
 }
 const band=(p:FingerprintPoint)=>fingerprintSource==='power'?Math.round(p.output/25):Math.round(Math.log(p.output)/Math.log(1.05));
 const groups=new Map<number,{early:FingerprintPoint[];late:FingerprintPoint[]}>();for(const block of blocks){const key=band(block),group=groups.get(key)??{early:[],late:[]};(block.phase<.5?group.early:group.late).push(block);groups.set(key,group)}
 const matched=blocks.filter(p=>(p.phase<.5?groups.get(band(p))?.late:groups.get(band(p))?.early)?.some(other=>Math.abs(other.output/p.output-1)<=(fingerprintSource==='power'?.08:.05)&&Math.abs(other.grade-p.grade)<=.5));
 // Retain representative points in very long recordings; do not put tens of
 // thousands of SVG nodes into the mobile panel.
 const stride=Math.max(1,Math.ceil(matched.length/240)),fingerprint=matched.filter((_,i)=>i%stride===0||i===matched.length-1);
 const sensor=cycling&&rows.some(r=>r.power!==null)?'power':'speed',profile=step?effortProfile(detail,sensor,family):null;
 return {...base,family,cycling,seconds,movingSeconds,terrainSeconds,terrain,coasting,fingerprint,fingerprintSource,fingerprintCount:matched.length,hasPower:rows.some(r=>r.power!==null),laps:profile?.laps??[],lapReason:profile?.reason??null};
}
