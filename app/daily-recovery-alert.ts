import type {AthleteData} from './analytics';
import {metricStatus,type MetricStatus} from './metric-status';
import {localDate} from './week-overview';
import {sportFamily} from './sports';

type RecoveryKey='sleep'|'hrv'|'rhr';
type RecoverySignal={key:RecoveryKey;label:string;metricTitle:string;value:number;status:MetricStatus};
export type DailyRecoveryAlert={date:string;tone:'orange'|'red';title:string;advice:string;signals:RecoverySignal[]};
const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0;

export function dailyRecoveryAlert(data:AthleteData,now:Date,offset=0):DailyRecoveryAlert|null{
 if(offset!==0)return null;
 const date=localDate(now),stamp=date.replaceAll('-','');
 // Match Home's latest same-day RHR reading; never combine different days.
 let body:{timestamp:string;hrRestDynamic:number}|undefined;
 for(const row of data.extra?.bodyvalues?.bodyvalues??[]){
  const time=new Date(row.timestamp);
  if(typeof row.hrRestDynamic!=='number'||!Number.isFinite(row.hrRestDynamic)||time>now||localDate(time)!==date)continue;
  if(!body||row.timestamp.localeCompare(body.timestamp)>0)body=row;
 }
 const seconds=data.sleep[stamp]?.[0],hrv=data.hrv[stamp]?.[0],rhr=body?.hrRestDynamic;
 if(!positive(seconds)||!positive(hrv)||!positive(rhr))return null;
 const readings:{key:RecoveryKey;label:string;metricTitle:string;value:number}[]=[
  {key:'sleep',label:'Sleep',metricTitle:'Latest sleep',value:seconds/3600},
  {key:'hrv',label:'HRV',metricTitle:'Average HRV',value:hrv},
  {key:'rhr',label:'Resting HR',metricTitle:'Resting HR',value:rhr},
 ];
 const signals=readings.map(signal=>({...signal,status:metricStatus(signal.key,data,now,sportFamily)}));
 if(!signals.every(signal=>['orange','red'].includes(signal.status.tone)))return null;
 const tone=signals.some(signal=>signal.status.tone==='red')?'red':'orange';
 return {date,tone,signals,title:tone==='red'?'Prioritise recovery today':'Recovery needs attention',advice:tone==='red'?'Choose rest or a very easy session today. Reassess before your next hard effort.':'Keep today easy or take a rest day. Check how you feel before adding intensity.'};
}
