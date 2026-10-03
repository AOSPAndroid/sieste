import type {loadAnalysis} from './load-analysis-data';
type Model=ReturnType<typeof loadAnalysis>;
export type LoadOverlayKey='minutes'|'sleep'|'hrv'|'fatigue';
export type LoadOverlay={key:LoadOverlayKey;label:string;unit:string;color:string;dash?:string;ceiling:number};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
export const defaultLoadLayers=['value','fatigue','minutes','sleep','hrv'];
export function loadOverlays(model:Model):LoadOverlay[]{
 const definitions:{key:LoadOverlayKey;label:string;unit:string;color:string;dash?:string;minimum:number;step:number}[]=[
  {key:'fatigue',label:'Est. fatigue',unit:'pts',color:'#3f3f46',minimum:4,step:4},
  {key:'minutes',label:'Time',unit:'min',color:'#0788b3',dash:'4 3',minimum:120,step:30},
  {key:'sleep',label:'Sleep',unit:'h',color:'#8b5cf6',minimum:10,step:2},
  {key:'hrv',label:'HRV',unit:'ms',color:'#16845b',minimum:120,step:20},
 ];
 return definitions.filter(series=>model.unit!=='min'||series.key!=='minutes').map(({minimum,step,...series})=>({
  ...series,ceiling:series.key==='fatigue'&&model.unit==='points'?loadPrimaryCeiling(model):Math.ceil(Math.max(minimum,...model.rows.map(row=>finite(row[series.key])?row[series.key]!:0))/step)*step,
 }));
}
export function loadPrimaryCeiling(model:Model){
 return Math.ceil(Math.max(1,model.baseline??0,...model.rows.flatMap(row=>[row.value??0,row.short??0,row.long??0,...(model.unit==='points'?[row.fatigue??0]:[])]))/4)*4;
}
export function formatLoadOverlay(key:LoadOverlayKey,value:number|null){
 if(value===null||!finite(value))return '—';
 if(key==='sleep'){const minutes=Math.round(value*60);return `${Math.floor(minutes/60)}h${String(minutes%60).padStart(2,'0')}`;}
 if(key==='minutes'){const minutes=Math.round(value);return minutes>=60?`${Math.floor(minutes/60)}h ${minutes%60}m`:`${minutes} min`;}
 return `${value.toLocaleString('en-GB',{maximumFractionDigits:0})} ${key==='fatigue'?'pts':'ms'}`;
}
