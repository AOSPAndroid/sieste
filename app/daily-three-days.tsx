"use client";
import {Moon,Activity,Heart,Star,Footprints,Flame} from 'lucide-react';
import type {AthleteData} from './analytics';
import {weekOverview,localDate} from './week-overview';
import {sportFamily} from './sports';
import {metricStatus} from './metric-status';
import {useExpand} from './expansion';
import CorosDaily from './coros-daily';
import WidgetSpark from './widget-spark';
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const palette={green:'#21845b',lightgreen:'#5b987d',yellow:'#ab9231',orange:'#b87c24',red:'#ca485f',neutral:'#8793a5'};
const metrics=[{key:'sleep',label:'Sleep',unit:'duration',title:'Latest sleep',Icon:Moon,color:'#8673ed'},{key:'hrv',label:'HRV',unit:'ms',title:'Average HRV',Icon:Activity,color:'#25b985'},{key:'rhr',label:'Resting HR',unit:'bpm',title:'Resting HR',Icon:Heart,color:'#f16b88'},{key:'score',label:'Sleep score',unit:'/100',title:'Sleep score',Icon:Star,color:'#a294f5'},{key:'steps',label:'Steps',unit:'steps',title:'Daily steps',Icon:Footprints,color:'#65a6fa'},{key:'calories',label:'Calories',unit:'kcal',title:'Daily calories',Icon:Flame,color:'#f4ae6a'}];
const format=(key:string,v:number|null,compact=false)=>v===null?'—':key==='sleep'?`${Math.floor(Math.round(v*60)/60)}h${String(Math.round(v*60)%60).padStart(2,'0')}`:compact&&v>=10000?`${(v/1000).toFixed(1)}k`:v.toLocaleString('en-GB',{maximumFractionDigits:0});
export default function DailyThreeDays({data,now,count=3,offset=0}:{data:AthleteData;now:Date;count?:3|7;offset?:number}){
 const expand=useExpand(),end=new Date(now);end.setDate(end.getDate()-offset*count);
 const days=weekOverview(data,end,sportFamily).rows.slice(-7),coros=data.extra?.coros;
 const value=(key:string,day:typeof days[number]):number|null=>{const stamp=day.iso.replaceAll('-',''),v=key==='score'?coros?.sleepWindows?.[stamp]?.score:key==='steps'||key==='calories'?coros?.daily?.[stamp]?.[key]:day[key as 'sleep'|'hrv'|'rhr'];return finite(v)?v:null};
 return <section className="health-headlines" aria-label="Daily health and activity"><header><h2>{offset===0?'Today’s health':end.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' · health'}</h2><span>7-day trends</span></header><div className="health-headline-grid">
 {metrics.map(metric=>{const values=days.map(d=>value(metric.key,d)),last=values.at(-1)??null,prior=values.at(-2)??null,physiology=['sleep','hrv','rhr'].includes(metric.key),status=last!==null&&physiology?metricStatus(metric.key,data,end,sportFamily):null,partial=offset===0&&['steps','calories'].includes(metric.key),diff=last!==null&&prior!==null?last-prior:null,delta=partial?'Today · partial':diff===null?'No comparison':diff===0?'→ unchanged':(diff>0?'↑ ':'↓ ')+(metric.key==='sleep'?Math.round(Math.abs(diff)*60)+'m':Math.abs(diff).toLocaleString('en-GB',{maximumFractionDigits:1}))+' vs yesterday',insight=last===null?'Not available':status?.label??(partial?'Day in progress':'Recorded total');
 const open=()=>physiology?expand.metric(metric.title):expand.widget(metric.title,<CorosDaily data={data} now={end}/>);
 return <button key={metric.key} className={'health-headline '+(physiology?'primary':'secondary')} onClick={open} title={insight+' · '+delta} aria-label={metric.label+': '+format(metric.key,last)+' '+metric.unit+'. '+insight+'. Open analysis'}><span className="health-headline-label"><metric.Icon size={13} style={{color:metric.color}}/>{metric.label}</span><strong style={{color:status?palette[status.tone]:undefined}}>{format(metric.key,last)}{metric.key!=='sleep'&&metric.key!=='steps'&&<small>{metric.unit}</small>}</strong><WidgetSpark dotted mode={physiology?'line':'bars'} values={values} color={metric.color} label={metric.label+' · last seven days, ending '+localDate(end)} partial={values.map((_,i)=>partial&&i===values.length-1)} pointLabels={days.map((d,i)=>d.iso+': '+format(metric.key,values[i])+' '+metric.unit)} pointColors={physiology?days.map((d,i)=>values[i]===null?palette.neutral:palette[metricStatus(metric.key,data,new Date(d.iso+'T12:00:00'),sportFamily).tone]):undefined}/><span className="health-headline-change">{delta}</span>{physiology&&<span className="health-headline-status" style={{color:status?palette[status.tone]:undefined}}>{insight}</span>}</button>})}</div><p>Last night’s sleep · daily readings · tap for analysis</p></section>;
}
