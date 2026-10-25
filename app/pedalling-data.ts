// Pedalling from a power meter that measures each leg: balance between legs,
// torque effectiveness and pedal smoothness, and how they change as power rises.
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
type Detail={summary?:Record<string,unknown>;seriesSampled?:{sampleSize?:unknown;data?:Record<string,unknown>}};
export type PedalRow={from:number;to:number;seconds:number;balance:number|null;torque:number|null;smoothness:number|null};
const keys=['balance','torque','smoothness'] as const;

/** Per-sample readings: the combined stream, else the mean of left and right. */
function samples(detail:Detail){
 const d=detail.seriesSampled?.data??{},at=(k:string,i:number)=>{const v=(d[k] as unknown[]|undefined)?.[i];return finite(v)&&v>=0&&v<=100?v:null};
 const pair=(k:string,l:string,r:string,i:number)=>at(k,i)??(a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null)([at(l,i),at(r,i)].filter(finite));
 const power=(d.power as unknown[]|undefined)??[];
 return power.map((p,i)=>({power:finite(p)?p:null,balance:at('leftRightBalance',i),torque:pair('torqueEffectiveness','leftTorqueEffectiveness','rightTorqueEffectiveness',i),smoothness:pair('pedalSmoothness','leftPedalSmoothness','rightPedalSmoothness',i)}));
}

/**
 * Pedalling across the ride and in power bands of this ride's own range
 * (thirds of its pedalling power), each needing two minutes of readings.
 */
export function pedalling(detail:Detail){
 const step=detail.seriesSampled?.sampleSize;if(!finite(step)||step<=0||step>10)return null;
 const all=samples(detail).filter(s=>s.power!==null&&s.power>=30);
 if(!all.some(s=>keys.some(k=>s[k]!==null)))return null;
 const mean=(list:typeof all,k:typeof keys[number])=>{const v=list.map(s=>s[k]).filter(finite);return v.length*step>=120?v.reduce((a,b)=>a+b,0)/v.length:null};
 const sorted=all.map(s=>s.power!).sort((a,b)=>a-b),cut=(q:number)=>sorted[Math.floor(q*(sorted.length-1))];
 const edges=[0,cut(1/3),cut(2/3),Infinity];
 const rows:PedalRow[]=[0,1,2].map(b=>{const list=all.filter(s=>s.power!>=edges[b]&&s.power!<edges[b+1]);return {from:Math.round(b?edges[b]:sorted[0]),to:Math.round(b<2?edges[b+1]:sorted.at(-1)!),seconds:list.length*step,balance:mean(list,'balance'),torque:mean(list,'torque'),smoothness:mean(list,'smoothness')}}).filter(r=>r.seconds>=120);
 const whole={balance:mean(all,'balance'),torque:mean(all,'torque'),smoothness:mean(all,'smoothness')};
 // Balance shift from the easiest to the hardest band, in percentage points of the left leg.
 const low=rows[0]?.balance??null,high=rows.at(-1)?.balance??null,shift=rows.length>1&&low!==null&&high!==null?high-low:null;
 return {whole,rows,shift};
}

/** "Balanced", "Left-leaning 53/47"… within ±2 points of 50/50 counts as balanced. */
export function balanceWords(left:number){const l=Math.round(left),r=100-l;return Math.abs(left-50)<=2?`Balanced ${l}/${r}`:`${left>50?'Left':'Right'} leg leads ${l}/${r}`}
