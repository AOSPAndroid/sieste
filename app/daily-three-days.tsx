"use client";
import {useEffect,useRef,useState,useMemo} from 'react';
import {Moon,Activity,Heart,Star,Footprints,Flame} from 'lucide-react';
import {Card,CardHeader,CardTitle,CardAction,CardContent} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import type {AthleteData} from './analytics';
import {weekOverview,localDate} from './week-overview';
import {sportFamily} from './sports';
import {metricStatus} from './metric-status';
import {useExpand} from './expansion';
import CorosDaily from './coros-daily';
import {useLiveSync,LiveValue} from './live-sync';
import WidgetSpark from './widget-spark';
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const palette={green:'#21845b',lightgreen:'#5b987d',yellow:'#ab9231',orange:'#b87c24',red:'#ca485f',neutral:'#8793a5'};
const metrics=[{key:'sleep',label:'Sleep',unit:'duration',title:'Latest sleep',Icon:Moon},{key:'hrv',label:'HRV',unit:'ms',title:'Average HRV',Icon:Activity},{key:'rhr',label:'Resting HR',unit:'bpm',title:'Resting HR',Icon:Heart},{key:'score',label:'Sleep score',unit:'/100',title:'Sleep score',Icon:Star},{key:'steps',label:'Steps',unit:'steps',title:'Daily steps',Icon:Footprints},{key:'calories',label:'Calories',unit:'kcal',title:'Daily calories',Icon:Flame}];
const format=(key:string,v:number|null,compact=false)=>v===null?'—':key==='sleep'?`${Math.floor(Math.round(v*60)/60)}h${String(Math.round(v*60)%60).padStart(2,'0')}`:compact&&v>=10000?`${(v/1000).toFixed(1)}k`:v.toLocaleString('en-GB',{maximumFractionDigits:0});
export default function DailyThreeDays({data,now,count=3,offset=0}:{data:AthleteData;now:Date;count?:3|7;offset?:number}){
 const panel=useRef<HTMLDivElement>(null),[collapsed,setCollapsed]=useState(false);
 useEffect(()=>{const node=panel.current;if(!node)return;const observer=new IntersectionObserver(([entry])=>setCollapsed(!entry.isIntersecting&&entry.boundingClientRect.bottom<=64),{rootMargin:'-64px 0px 0px 0px',threshold:0});observer.observe(node);return ()=>observer.disconnect()},[]);
 const live=useLiveSync(),expand=useExpand(),end=new Date(now);end.setDate(end.getDate()-offset*count);
 const days=useMemo(()=>weekOverview(data,end,sportFamily).rows,[data,end.getTime()]),coros=data.extra?.coros;
 const value=(key:string,day:typeof days[number]):number|null=>{const stamp=day.iso.replaceAll('-',''),v=key==='score'?coros?.sleepWindows?.[stamp]?.score:key==='steps'||key==='calories'?coros?.daily?.[stamp]?.[key]:day[key as 'sleep'|'hrv'|'rhr'];return finite(v)?v:null};
 const today=useMemo(()=>offset===0?days.at(-1)!:weekOverview(data,now,sportFamily).rows.at(-1)!,[data,now.getTime(),offset,days]);
 return <><nav className={cn('health-scroll-strip',collapsed&&'is-visible')} aria-label="Today’s health at a glance" aria-hidden={!collapsed}><small className="mini-data-caption">Today’s data</small>{metrics.map(metric=>{const v=value(metric.key,today);return <button key={metric.key} tabIndex={collapsed?0:-1} onClick={()=>['sleep','hrv','rhr'].includes(metric.key)?expand.metric(metric.title):expand.widget(metric.title,<CorosDaily data={data} now={now}/>)} aria-label={'Today · '+metric.label+': '+format(metric.key,v)+' '+metric.unit+'. Open analysis'} title={'Today · '+metric.label+': '+format(metric.key,v)+' '+metric.unit}><metric.Icon aria-hidden="true" size={15}/><strong>{format(metric.key,v,true)}</strong></button>})}</nav><Card ref={panel} size="sm" className="health-headlines n-hero" role="region" aria-label="Daily health and activity"><CardHeader><CardTitle><h2>{offset===0?'Today’s health':end.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' · health'}</h2></CardTitle><CardAction><Badge variant="outline">7-day trends</Badge></CardAction></CardHeader><CardContent className="health-headline-grid">
 {metrics.map(metric=>{const values=days.map(d=>value(metric.key,d)),last=values.at(-1)??null,prior=values.at(-2)??null,physiology=['sleep','hrv','rhr'].includes(metric.key),status=last!==null&&physiology?metricStatus(metric.key,data,end,sportFamily):null,partial=offset===0&&['steps','calories'].includes(metric.key),diff=last!==null&&prior!==null?last-prior:null,delta=partial?(last===null?'':'So far today'):diff===null?'':diff===0?'→ unchanged':(diff>0?'↑ ':'↓ ')+(metric.key==='sleep'?Math.round(Math.abs(diff)*60)+'m':Math.abs(diff).toLocaleString('en-GB',{maximumFractionDigits:1}))+' vs yesterday',insight=last===null?'':status?.label??'';
 // Steps and calories grow during the day; overnight readings only wait until today's value lands.
 const updating=live&&offset===0&&(partial||(physiology&&last===null));
 const open=()=>physiology?expand.metric(metric.title):expand.widget(metric.title,<CorosDaily data={data} now={end}/>);
 // A missing reading stays quiet: a dash, no unit and no explanatory lines.
 return <button key={metric.key} className={cn('health-headline',physiology?'primary':'secondary',updating&&'is-updating',last===null&&'is-empty')} aria-busy={updating||undefined} onClick={open} title={[insight,delta].filter(Boolean).join(' · ')||undefined} aria-label={metric.label+': '+(last===null?'no reading':format(metric.key,last)+' '+metric.unit)+(insight?'. '+insight:'')+'. Open analysis'}><span className="health-headline-label"><span className="health-metric-icon"><metric.Icon aria-hidden="true"/></span>{metric.label}</span><LiveValue value={last}>{format(metric.key,last)}{last!==null&&metric.key!=='sleep'&&metric.key!=='steps'&&<small>{metric.unit}</small>}</LiveValue><WidgetSpark dotted mode={physiology?'line':'bars'} values={values} color="var(--primary)" label={metric.label+' · last seven days, ending '+localDate(end)} partial={values.map((_,i)=>partial&&i===values.length-1)} pointLabels={days.map((d,i)=>d.iso+': '+format(metric.key,values[i])+' '+metric.unit)} pointColors={physiology?days.map((d,i)=>values[i]===null?palette.neutral:palette[metricStatus(metric.key,data,new Date(d.iso+'T12:00:00'),sportFamily).tone]):undefined}/>{delta&&<span className="health-headline-change">{delta}</span>}{physiology&&insight&&<span className="health-headline-status" style={{color:status?palette[status.tone]:undefined}}>{insight}</span>}</button>})}</CardContent></Card></>;
}
