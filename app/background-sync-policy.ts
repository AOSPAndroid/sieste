export function allowedPushEndpoint(value:unknown):value is string{
 if(typeof value!=='string'||value.length>3000)return false;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'));}catch{return false}
}
export function validPushSubscription(value:any){return allowedPushEndpoint(value?.endpoint)&&/^[A-Za-z0-9_-]{80,100}$/.test(value?.keys?.p256dh??'')&&/^[A-Za-z0-9_-]{20,30}$/.test(value?.keys?.auth??'')}
export function syncFingerprint(data:any){
 if(!data)return '';
 // Sync timestamps and transient warnings must not trigger a push by themselves.
 const stable=(value:any):any=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
 const readings=new Map<string,any>();for(const row of data.extra?.bodyvalues?.bodyvalues??[]){const day=String(row.timestamp??'').slice(0,10);for(const key of ['hrRestDynamic','hrMaxDynamic'])if(typeof row[key]==='number'&&Number.isFinite(row[key]))readings.set(day+':'+key,row[key]);}
 return JSON.stringify(stable({activities:(data.activities??[]).map((a:any)=>[a.id,a.date,...['duration','distance','heartrate','calories','pace','speed','power','elevation','cadence','trainingLoad'].map(k=>a.summary?.[k]??null)]).sort((a:any,b:any)=>String(a[0]).localeCompare(String(b[0]))),sleep:data.sleep,hrv:data.hrv,body:[...readings.entries()].sort(),windows:data.extra?.coros?.sleepWindows,daily:data.extra?.coros?.daily}));
}
