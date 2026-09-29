import {localDate} from './week-overview';
export function dailyShareHistory(data:any,now:Date){
 return Array.from({length:7},(_,i)=>{const date=new Date(now);date.setDate(date.getDate()-6+i);const iso=localDate(date),key=iso.replaceAll('-','');
 const valid=(v:unknown,min=0,max=Infinity):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:null;
 const sleep=valid(data.sleep?.[key]?.[0]);
 return {date:iso,sleep:sleep===null?null:sleep/3600,score:valid(data.extra?.coros?.sleepWindows?.[key]?.score,0,100),hrv:valid(data.hrv?.[key]?.[0],Number.MIN_VALUE)};
 });
}
