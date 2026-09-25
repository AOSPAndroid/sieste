import {sportFamily} from './sports';
import {activityShareData} from './activity-share-data';
export function shareWeek(activity:Record<string,any>,history:Record<string,any>[]){
 const date=new Date(activity.date),start=new Date(date);start.setHours(0,0,0,0);start.setDate(start.getDate()-(start.getDay()+6)%7);const end=new Date(start);end.setDate(end.getDate()+7);
 const family=sportFamily(activity),rows=history.filter(a=>sportFamily(a)===family&&new Date(a.date)>=start&&new Date(a.date)<end&&new Date(a.date)<=new Date());
 const sum=(key:string)=>rows.length&&rows.every(a=>typeof a.summary?.[key]==='number'&&Number.isFinite(a.summary[key])&&a.summary[key]>=0)?rows.reduce((n,a)=>n+a.summary[key],0):undefined;
 const ascent=rows.length&&rows.every(a=>Number.isFinite(a.summary?.altitude?.ascent))?rows.reduce((n,a)=>n+a.summary.altitude.ascent,0):undefined;
 const stats=activityShareData({sportType:family,summary:{distance:sum('distance'),duration:sum('duration'),calories:sum('calories'),altitude:{ascent}}}).stats.filter(s=>['distance','duration','ascent','calories'].includes(s.key));
 const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const next=new Date(d);next.setDate(next.getDate()+1);const acts=rows.filter(a=>new Date(a.date)>=d&&new Date(a.date)<next);return {label:d.toLocaleDateString('en-GB',{weekday:'short'}),value:d>new Date()?null:acts.some(a=>!Number.isFinite(a.summary?.distance))?null:acts.reduce((n,a)=>n+a.summary.distance/1000,0)};});
 return {stats,days,count:rows.length,label:`${start.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${new Date(+end-1).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`};
}
