'use client';
import {Moon,Activity,Heart,Star,Footprints,Flame} from 'lucide-react';
import type {AthleteData} from './analytics';
import {weekOverview,localDate} from './week-overview';
import {sportFamily} from './sports';

export default function ActivityDailyPeek({data,isDemo}:{data:AthleteData;isDemo:boolean}){
 const now=isDemo?new Date('2026-09-17T12:00:00'):new Date(),day=weekOverview(data,now,sportFamily).rows.at(-1),key=localDate(now).replaceAll('-',''),coros=data.extra?.coros;
 const fmt=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-GB',{maximumFractionDigits:0}):'—';
 const sleep=day?.sleep,minutes=typeof sleep==='number'&&Number.isFinite(sleep)?Math.round(sleep*60):null;
 const metrics=[{label:'Sleep',Icon:Moon,value:minutes===null?'—':`${Math.floor(minutes/60)}h${String(minutes%60).padStart(2,'0')}`,unit:'',color:'#8673ed'},{label:'HRV',Icon:Activity,value:fmt(day?.hrv),unit:'ms',color:'#25a780'},{label:'Rest HR',Icon:Heart,value:fmt(day?.rhr),unit:'bpm',color:'#de6981'},{label:'Score',Icon:Star,value:fmt(coros?.sleepWindows?.[key]?.score),unit:'/100',color:'#9585d6'},{label:'Steps',Icon:Footprints,value:fmt(coros?.daily?.[key]?.steps),unit:'',color:'#6599da'},{label:'Calories',Icon:Flame,value:fmt(coros?.daily?.[key]?.calories),unit:'kcal',color:'#c78c45'}];
 return <div className="activity-daily-peek" onClick={e=>e.stopPropagation()}><header><strong>sieste</strong><span>{isDemo?'Demo · ':''}Today · {now.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span></header><div className="activity-peek-metrics" aria-label="Today’s recorded daily health">{metrics.map(({label,Icon,value,unit,color})=><div key={label} title={`${label}: ${value} ${unit}${['Steps','Calories'].includes(label)?' · today so far':''}`}><span><Icon size={12} style={{color}}/>{label}</span><b>{value}</b></div>)}</div></div>;
}
