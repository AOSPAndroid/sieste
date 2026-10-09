"use client";
import {lazy,Suspense,useMemo,type ReactNode} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {Card,CardHeader,CardTitle,CardAction,CardContent,CardDescription} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import type {AthleteData,Workout} from './analytics';
import {weekOverview} from './week-overview';
import {sportFamily} from './sports';
import {useExpand} from './expansion';
import WidgetSpark from './widget-spark';
import {FeatureBoundary,LoadingState} from './loading-state';
const Analytics=lazy(()=>import('./analytics').then(m=>({default:m.Analytics})));
const TrainingComparison=lazy(()=>import('./training-comparison-view'));
const TrainingSnapshot=lazy(()=>import('./training-snapshot'));
const WeekGlance=lazy(()=>import('./week-glance'));
type Metric={label:string;value:unknown;unit?:string;trend?:(number|null)[]};
const format=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-GB',{maximumFractionDigits:1}):'—';
export default function HomeInsightsGrid({data,isDemo,token,syncing,onSelect,setData,onAccount,coach,connected}:{data:AthleteData;isDemo:boolean;token:string;syncing:boolean;onSelect:(a:Workout)=>void;setData:React.Dispatch<React.SetStateAction<AthleteData>>;onAccount:()=>void;coach:ReactNode;connected:ReactNode}){
 const expand=useExpand(),now=useMemo(()=>isDemo?new Date('2026-09-17T23:59:59'):new Date(),[isDemo,data]),week=useMemo(()=>weekOverview(data,now,sportFamily),[data,now]);
 const rows=week.rows,acts=rows.flatMap(r=>r.sessions),body=(data.extra?.bodyvalues?.bodyvalues??[]).filter((r:any)=>new Date(r.timestamp)<=now).sort((a:any,b:any)=>b.timestamp.localeCompare(a.timestamp));
 const latest=(key:string)=>body.find((r:any)=>typeof r[key]==='number')?.[key],c=data.extra?.coros,fit=c?.fitness;
 const mean=(key:string)=>{const values=acts.map(a=>a.summary?.[key]).filter((v:any)=>typeof v==='number'&&Number.isFinite(v));return values.length?values.reduce((s:number,v:number)=>s+v,0)/values.length:null};
 const sources=Object.values(data.sources??{}) as any[],count=(key:string)=>acts.filter(a=>typeof a.summary?.[key]==='number').length;
 const show=(title:string,content:ReactNode)=>expand.widget(title,<FeatureBoundary><Suspense fallback={<LoadingState label="Loading analysis…"/>}>{content}</Suspense></FeatureBoundary>);
 const analysis=(tab:string)=><Analytics data={data} setData={setData} token={token} isDemo={isDemo} syncing={syncing} tab={tab} days={28} onSelect={onSelect} embedded/>;
 const cards:{title:string;note:string;metrics:Metric[];open:()=>void}[]=[
  {title:'Volume & trends',note:'Last 7 days · today partial',metrics:[{label:'Training',value:week.current.minutes===null?null:week.current.minutes/60,unit:'h',trend:rows.map(r=>r.minutes)},{label:'Sessions',value:week.current.sessions},{label:'Running',value:week.current.runKm,unit:'km'},{label:'Cycling',value:week.current.rideKm,unit:'km'}],open:()=>show('Volume & trends',<><TrainingComparison data={data} isDemo={isDemo} syncing={syncing}/><TrainingSnapshot data={data} now={now}/><WeekGlance data={data} isDemo={isDemo}/></>)},
  {title:'Sleep & recovery',note:'7-day averages · recorded nights',metrics:[{label:'Sleep',value:week.current.sleep,unit:'h',trend:rows.map(r=>r.sleep)},{label:'HRV',value:week.current.hrv,unit:'ms',trend:rows.map(r=>r.hrv)},{label:'Resting HR',value:week.current.rhr,unit:'bpm'},{label:'Nights',value:week.current.sleepDays,unit:'/7'}],open:()=>show('Sleep & recovery',analysis('Recovery lab'))},
  {title:'Performance',note:'Last 7 days · session averages',metrics:[{label:'Run VO₂',value:week.current.vo2,trend:rows.map(r=>r.vo2)},{label:'Avg HR',value:mean('heartrate'),unit:'bpm'},{label:'HR coverage',value:count('heartrate'),unit:`/${acts.length}`},{label:'Calories',value:week.current.calories,unit:'kcal'}],open:()=>show('Performance',analysis('Performance lab'))},
  {title:'Training balance',note:'Last 7 days · synced sessions',metrics:[{label:'Active days',value:7-week.current.restDays,trend:rows.map(r=>r.minutes)},{label:'No sessions',value:week.current.restDays,unit:'days'},{label:'Strength',value:week.current.strength},{label:'Longest',value:acts.some(a=>typeof a.summary?.duration==='number')?Math.max(...acts.map(a=>a.summary?.duration??0))/60:null,unit:'min'}],open:()=>show('Training balance',analysis('Injury check'))},
  {title:'Body & zones',note:'Latest recorded values',metrics:[{label:'Weight',value:latest('weightInKilograms')??c?.profile?.weight,unit:'kg'},{label:'FTP',value:fit?.ftp,unit:'W'},{label:'Body fat',value:latest('bodyFatInPercent'),unit:'%'},{label:'Height',value:latest('bodyHeightInCentimeter')??c?.profile?.height,unit:'cm'}],open:()=>show('Body & zones',analysis('Athlete & zones'))},
  {title:'Training insights',note:'Recorded history · tap to compare',metrics:[{label:'Sessions',value:data.activities.length},{label:'Analyzed',value:data.activities.filter(a=>a.analyzed).length},{label:'Run days',value:rows.filter(r=>r.runKm>0).length,unit:'/7'},{label:'Ride days',value:rows.filter(r=>r.rideKm>0).length,unit:'/7'}],open:()=>show('Training insights',coach)},
  {title:'Body & sensors',note:'Available recorded history',metrics:[{label:'Sleep nights',value:Object.keys(data.sleep).length},{label:'HRV days',value:Object.keys(data.hrv).length},{label:'Body readings',value:body.length},{label:'Daily records',value:c?Object.keys(c.daily??{}).length:null}],open:()=>show('Connected data',c?connected:<p>No COROS sensor records are available yet. Your Tredict readings remain in Body & zones and Sleep & recovery.</p>)},
  {title:'Data & account',note:'Coverage · connections & sources',metrics:[{label:'Sources',value:sources.length},{label:'Synced',value:sources.filter(s=>s.status==='synced').length},{label:'Sleep coverage',value:week.current.sleepDays,unit:'/7'},{label:'HRV coverage',value:week.current.hrvDays,unit:'/7'}],open:()=>show('Data & account',<><Button variant="outline" size="sm" onClick={()=>{expand.close();onAccount()}}>Manage connections</Button>{analysis('Data coverage')}</>)}
 ];
 return <section className="home-insights-board" aria-label="Health and training insights"><header><h2>Your data</h2><span>Tap a card to explore</span></header><div className="home-insights-grid">{cards.map(card=><Card key={card.title} size="sm" className="home-insight-card" role="button" tabIndex={0} onClick={card.open} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();card.open()}}} aria-label={'Explore '+card.title}><CardHeader className="home-insight-ribbon"><CardTitle>{card.title}</CardTitle><CardAction><ArrowUpRight size={13} aria-hidden="true"/></CardAction></CardHeader><CardContent className="home-insight-cells">{card.metrics.map(metric=><span className="home-insight-cell" key={metric.label}><small>{metric.label}</small><strong>{format(metric.value)}<em>{metric.unit}</em></strong>{metric.trend&&<WidgetSpark values={metric.trend} label={metric.label+' · last 7 days'} color="#6366b8"/>}</span>)}</CardContent><CardDescription className="home-insight-note">{card.note}</CardDescription></Card>)}</div></section>;
}
