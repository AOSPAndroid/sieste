const finite=(v:any):v is number=>typeof v==='number'&&Number.isFinite(v);
export function segmentStatistics(samples:any[],step:unknown,seconds:number,lap:any=null){
 const values=(key:string)=>samples.map(r=>r[key]).filter(v=>finite(v)&&v>=0);
 const max=(key:string)=>finite(lap?.[key+'Max'])?lap[key+'Max']:values(key).length?Math.max(...values(key)):null;
 const p=samples.map(r=>r.power);let normalized:number|null=null;
 // Segment-local NP estimate: full 30s windows, complete fine-grained data, >=5 min.
 if(finite(step)&&step>0&&step<=10&&seconds>=300&&p.length*step>=seconds-step&&p.every(v=>finite(v)&&v>=0)){
 const w=Math.ceil(30/step);let sum=0,fourth=0,count=0;
 for(let i=0;i<p.length;i++){sum+=p[i];if(i>=w)sum-=p[i-w];if(i>=w-1){fourth+=(sum/w)**4;count++}}if(count)normalized=(fourth/count)**.25;
 }
 return {normalized,maxPower:max('power'),maxHR:max('heartrate'),maxCadence:max('cadence'),maxSpeed:max('speed')};
}
