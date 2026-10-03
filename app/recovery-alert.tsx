"use client";
import {BatteryLow,ChevronRight} from 'lucide-react';
import type {AthleteData} from './analytics';
import {dailyRecoveryAlert} from './daily-recovery-alert';
import {useExpand} from './expansion';

export default function RecoveryAlert({data,now,offset=0}:{data:AthleteData;now:Date;offset?:number}){
 const expand=useExpand(),alert=dailyRecoveryAlert(data,now,offset);
 if(!alert)return null;
 const details=<section className="recovery-alert-details" aria-label="Today’s recovery signals"><p>{alert.advice}</p><div className="recovery-alert-signals">{alert.signals.map(signal=>{
  const minutes=Math.round(signal.value*60),value=signal.key==='sleep'?`${Math.floor(minutes/60)}h${String(minutes%60).padStart(2,'0')}`:signal.value.toLocaleString('en-GB',{maximumFractionDigits:0})+(signal.key==='hrv'?' ms':' bpm');
  return <button key={signal.key} data-tone={signal.status.tone} onClick={()=>expand.metric(signal.metricTitle)} aria-label={`${signal.label}: ${value}. ${signal.status.label}. Review ${signal.label}`} title={signal.status.label+' · '+signal.status.reason}><span>{signal.label}</span><strong>{value}</strong><small>{signal.status.label}</small><ChevronRight size={13} aria-hidden="true"/></button>;
 })}</div></section>;
 return <aside className={'recovery-alert recovery-alert--'+alert.tone} aria-label="Today’s recovery alert">
  <button className="recovery-alert-ribbon" onClick={()=>expand.widget("Today's recovery",details)} aria-label={alert.title+'. '+alert.advice+' Open recovery details'}>
   <BatteryLow size={15} aria-hidden="true"/><strong>Recovery · {alert.tone==='red'?'Rest or very easy':'Easy or rest day'}</strong><span>Details</span><ChevronRight size={14} aria-hidden="true"/>
  </button>
 </aside>;
}
