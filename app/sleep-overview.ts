export function sleepOverview(sleep:Record<string,number[]>,day:string){
 const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
 const date=(s:string)=>s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8);
 const last=Object.keys(sleep).filter(k=>/^\d{8}$/.test(k)&&date(k)<=day&&finite(sleep[k]?.[0])).sort().at(-1);
 if(!last)return {date:null,seconds:null,baseline:null,differenceMinutes:null,variabilityMinutes:null,count:0};
 const start=new Date(day+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-6);
 const values=Object.entries(sleep).filter(([k,v])=>date(k)>=start.toISOString().slice(0,10)&&date(k)<=day&&finite(v?.[0])).map(([,v])=>v[0]);
 const avg=values.reduce((s,v)=>s+v,0)/values.length,baseline=finite(sleep[last][1])?sleep[last][1]:null;
 return {date:date(last),seconds:sleep[last][0],baseline,differenceMinutes:baseline===null?null:(sleep[last][0]-baseline)/60,variabilityMinutes:values.length<2?null:Math.sqrt(values.reduce((s,v)=>s+(v-avg)**2,0)/values.length)/60,count:values.length};
}
