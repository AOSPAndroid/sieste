// Calculation primitives: missing observations never silently become zero.
export const numeric=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
export function mean(values:unknown[]){const valid=values.filter(numeric);return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null}
export function quantile(values:unknown[],q:number){const a=values.filter(numeric).sort((x,y)=>x-y);if(!a.length)return null;const p=(a.length-1)*Math.min(1,Math.max(0,q)),i=Math.floor(p);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(p-i)}
export function pearson(pairs:{x:number;y:number}[]){const a=pairs.filter(p=>numeric(p.x)&&numeric(p.y));if(a.length<5)return null;const mx=mean(a.map(p=>p.x))!,my=mean(a.map(p=>p.y))!;let xy=0,xx=0,yy=0;for(const p of a){xy+=(p.x-mx)*(p.y-my);xx+=(p.x-mx)**2;yy+=(p.y-my)**2}return xx&&yy?xy/Math.sqrt(xx*yy):null}
export function bestWindows(values:unknown[],sampleSeconds:number,windows=[5,15,30,60,120,300,600,1200,1800,3600]){
 if(!numeric(sampleSeconds)||sampleSeconds<=0)return [];
 return windows.flatMap(seconds=>{const n=Math.ceil(seconds/sampleSeconds);if(n>values.length)return [];let sum=0,missing=0,best=-Infinity,index=0;for(let i=0;i<values.length;i++){if(numeric(values[i]))sum+=values[i] as number;else missing++;if(i>=n){if(numeric(values[i-n]))sum-=values[i-n] as number;else missing--}if(i>=n-1&&!missing&&sum/n>best){best=sum/n;index=i-n+1}}return Number.isFinite(best)?[{seconds:n*sampleSeconds,value:best,start:index*sampleSeconds}]:[]});
}
export function normalizedPower(values:unknown[],sampleSeconds:number){
 if(!numeric(sampleSeconds)||sampleSeconds<=0||sampleSeconds>30||values.some(v=>!numeric(v)||v<0))return null;
 const n=Math.ceil(30/sampleSeconds);if(values.length<n*2)return null;let sum=0,total=0,count=0;for(let i=0;i<values.length;i++){sum+=values[i] as number;if(i>=n)sum-=values[i-n] as number;if(i>=n-1){total+=(sum/n)**4;count++}}return (total/count)**.25;
}
export function sessionTotals(activities:{summary?:Record<string,any>}[]){const sum=(key:string)=>{const values=activities.map(a=>a.summary?.[key]).filter(numeric);return values.length?values.reduce((a,b)=>a+b,0):null};return {sessions:activities.length,duration:sum('duration'),distance:sum('distance'),calories:sum('calories'),vo2max:mean(activities.map(a=>a.summary?.vo2max)),heartrate:mean(activities.map(a=>a.summary?.heartrate)),power:mean(activities.map(a=>a.summary?.power)),durationCoverage:activities.filter(a=>numeric(a.summary?.duration)).length}}
export function utcDay(date:string){return date.slice(0,10)}
