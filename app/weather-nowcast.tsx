"use client";
import {useEffect,useState} from 'react';
import {CloudRain,Sun} from 'lucide-react';
import {parseNowcast,nowcastSummary,weatherTime,type NowcastSlot} from './weather-recon-data';

type Place={latitude:number;longitude:number};
const REFRESH=10*60*1000;

// Rain over the next two hours in 15-minute steps, for heading out now.
export default function WeatherNowcast({place,timezone,active}:{place:Place;timezone:string;active:boolean}){
 const {latitude,longitude}=place,key=`${latitude},${longitude}`;
 const [result,setResult]=useState<{key:string;slots:NowcastSlot[]}|null>(null);
 useEffect(()=>{
  if(!active)return;let controller=new AbortController();
  const load=()=>{controller.abort();controller=new AbortController();const params=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),minutely_15:'precipitation,precipitation_probability',forecast_minutely_15:'8',timeformat:'unixtime',timezone:'auto'});
   fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(json=>setResult({key,slots:parseNowcast(json)})).catch(()=>{})};
  load();const timer=setInterval(load,REFRESH);
  return()=>{controller.abort();clearInterval(timer)};
 },[active,key,latitude,longitude]);
 const slots=result?.key===key?result.slots:[],summary=nowcastSummary(slots,timezone);
 // Without 15-minute data (outside its coverage) the strip simply stays away.
 if(!summary)return null;
 return <section className={`weather-nowcast is-${summary.kind}`} aria-label="Rain in the next two hours">
  <p>{summary.kind==='dry'?<Sun aria-hidden="true"/>:<CloudRain aria-hidden="true"/>}<strong>{summary.text}</strong></p>
  <div className="weather-nowcast-strip" role="img" aria-label={slots.map(s=>`${weatherTime(s.time,timezone)}: ${s.rain===null?'unknown':`${s.rain.toFixed(1)} mm`}${s.chance!==null?`, ${Math.round(s.chance)}%`:''}`).join('; ')}>
   {slots.map(s=><i key={s.time} style={{'--rain':Math.min(1,Math.max(s.rain??0,0)/1.5),'--chance':(s.chance??0)/100} as React.CSSProperties} className={(s.rain??0)>=.1||(s.chance??0)>=50?'is-wet':''}/>)}
  </div>
  <div className="weather-nowcast-times"><span>Now</span><span>{slots[4]?weatherTime(slots[4].time,timezone):''}</span><span>{slots.at(-1)?weatherTime(slots.at(-1)!.time+900,timezone):''}</span></div>
 </section>;
}
