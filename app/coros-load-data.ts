// COROS's own load assessment (short-term vs long-term load), read the usual way:
// a ratio near 1 keeps fitness, well above it ramps up fast, well below it eases off.
type Entry={date:string;short:number|null;long:number|null;ratio:number|null;comment?:string};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function corosLoadSummary(load:unknown){
 const list=(Array.isArray(load)?load:[]).filter((e:Entry)=>typeof e?.date==='string'&&finite(e.ratio)).sort((a:Entry,b:Entry)=>a.date.localeCompare(b.date)) as Entry[];
 const latest=list.at(-1);if(!latest)return null;
 const weekAgo=list.filter(e=>Date.parse(e.date)<=Date.parse(latest.date)-7*86400000).at(-1)??null;
 const r=latest.ratio!;
 const zone=r<.8?{tone:'low',label:'Easing off',advice:'Load is well under what you are used to; fitness slowly fades if this lasts.'}:r<=1.3?{tone:'good',label:'Steady build',advice:'Recent load matches what your body is used to.'}:r<=1.5?{tone:'high',label:'Ramping up',advice:'Recent load is well above your usual; plan easier days to absorb it.'}:{tone:'risk',label:'Spiking',advice:'A sharp rise in load; the risk of overreaching or injury goes up.'};
 return {...latest,ratio:r,zone,change:weekAgo?r-weekAgo.ratio!:null};
}
