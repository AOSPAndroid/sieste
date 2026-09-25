import {storage,ownerPrefix} from '../../../db/storage';
import {corosText} from '../../coros-data';
import {corosProfile,corosHeartDays,COROS_LIBRARY} from '../../coros-extended-data';
export const day=(d:Date)=>d.toISOString().slice(0,10).replaceAll('-','');
export async function captureCoros(owner:string,name:string,value:any,args:any){if(!COROS_LIBRARY[name])return;const prefix=(await ownerPrefix(owner))+'coros-library/',payload=JSON.stringify({source:'COROS',name,requested:args,retrievedAt:new Date().toISOString(),data:value}),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(args))),id=Array.from(new Uint8Array(digest)).slice(0,12).map(v=>v.toString(16).padStart(2,'0')).join('');await storage().bucket.put(prefix+name+'/'+id+'.json',payload,{httpMetadata:{contentType:'application/json'}});await storage().bucket.put(prefix+name+'.json',payload,{httpMetadata:{contentType:'application/json'}})}
export async function extendCoros(owner:string,client:any,previous:any,now:Date){const result={...previous,library:{...previous?.library}},from=new Date(now.getTime()-6*86400000);const requests:[string,any,(v:any)=>void][]=[
 ['queryUserInfo',{},v=>result.profile=corosProfile(v)],
 ['queryAvgHeartRate',{days:90},v=>result.heartDays={...result.heartDays,...corosHeartDays(v)}],
 ['queryHealthCheckTimeSeries',{startDate:day(from),endDate:day(now),days:7},v=>result.wellness={text:corosText(v),empty:/^No complete health check/i.test(corosText(v))}]
 ];
 for(const key of ['stressDays','stressPoints','stressPeriod','devices','schedule'])delete result[key];
 for(const name of ['queryStressLevel','queryStressTimeSeries','queryDevices','queryTrainingSchedule'])delete result.library[name];
 for(let i=0;i<requests.length;i+=3)await Promise.all(requests.slice(i,i+3).map(async([name,args,apply])=>{const old=result.library[name];const ttl=['queryUserInfo','queryHealthCheckTimeSeries'].includes(name)?86400000:3600000;if(old?.retrievedAt&&now.getTime()-Date.parse(old.retrievedAt)<ttl)return;try{const v=await client.call(name,args);await captureCoros(owner,name,v,args);apply(v);result.library[name]={status:/^No /i.test(corosText(v))?'empty':'synced',retrievedAt:now.toISOString()}}catch{result.library[name]={...old,status:old?.retrievedAt?'saved':'unavailable'}}}));return result;
}
