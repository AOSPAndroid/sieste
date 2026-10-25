export type WeatherHour={time:number;temperature:number|null;rainChance:number|null;rain:number|null;wind:number|null;direction:number|null;gust:number|null;code:number|null;daylight:number|null;models?:{rainy:number;total:number}};
export type WeatherRules={minTemp:number;maxTemp:number;rainChance:number;wind:number;gust:number};
export const defaultWeatherRules:WeatherRules={minTemp:8,maxTemp:30,rainChance:20,wind:20,gust:35};
export type WeatherGrade='good'|'mixed'|'poor'|'unknown';
export const weatherLabels:Record<WeatherGrade,string>={good:'Favourable',mixed:'Mixed',poor:'Poor',unknown:'Incomplete forecast'};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
export type SunDay={date:string;sunrise:number|null;sunset:number|null};
export function parseWeather(payload:any):{hours:WeatherHour[];timezone:string;sun:SunDay[]}{
 const h=payload?.hourly;if(!Array.isArray(h?.time))throw new Error('The forecast is unavailable. Please try again.');
 const timezone=typeof payload.timezone==='string'?payload.timezone:'UTC';new Intl.DateTimeFormat('en-GB',{timeZone:timezone});
 const hours:WeatherHour[]=h.time.flatMap((time:unknown,i:number)=>typeof time!=='number'||!Number.isFinite(time)?[]:[{time,temperature:num(h.temperature_2m?.[i]),rainChance:num(h.precipitation_probability?.[i]),rain:num(h.precipitation?.[i]),wind:num(h.wind_speed_10m?.[i]),direction:num(h.wind_direction_10m?.[i]),gust:num(h.wind_gusts_10m?.[i]),code:num(h.weather_code?.[i]),daylight:num(h.is_day?.[i])}]);
 if(!hours.length)throw new Error('No hourly forecast was returned.');const sun:SunDay[]=(Array.isArray(payload.daily?.time)?payload.daily.time:[]).flatMap((t:unknown,i:number)=>typeof t==='number'&&Number.isFinite(t)?[{date:weatherDay(t,timezone),sunrise:num(payload.daily.sunrise?.[i]),sunset:num(payload.daily.sunset?.[i])}]:[]);return {hours:hours.sort((a,b)=>a.time-b.time),timezone,sun};
}
// Independent forecast models served by Open-Meteo. Each covers its own horizon,
// so later days are blended from fewer models.
export const weatherSources=[
 {id:'ecmwf_ifs025',name:'ECMWF',from:'European Centre'},
 {id:'icon_seamless',name:'ICON',from:'DWD · Germany'},
 {id:'gfs_seamless',name:'GFS',from:'NOAA · USA'},
 {id:'meteofrance_seamless',name:'Météo-France',from:'AROME · ARPEGE'},
 {id:'ukmo_seamless',name:'Met Office',from:'UK'},
] as const;
export type WeatherSourceId=typeof weatherSources[number]['id'];
export type WeatherSource='blend'|WeatherSourceId;
const median=(values:number[])=>{if(!values.length)return null;const v=[...values].sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2};
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
// Directions average on the circle, so 350° and 10° give 0°, not 180°.
const bearing=(degrees:number[])=>{if(!degrees.length)return null;const x=degrees.reduce((a,d)=>a+Math.cos(d*Math.PI/180),0),y=degrees.reduce((a,d)=>a+Math.sin(d*Math.PI/180),0);if(Math.hypot(x,y)<1e-9)return null;return (Math.atan2(y,x)*180/Math.PI+360)%360};
// The most common weather code; a tie goes to the more severe (higher) code.
const commonCode=(codes:number[])=>{if(!codes.length)return null;const counts=new Map<number,number>();codes.forEach(c=>counts.set(c,(counts.get(c)??0)+1));return [...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0][0]};
const raining=(h:WeatherHour)=>(h.rain!==null&&h.rain>=0.1)||(h.rainChance!==null&&h.rainChance>=50);
/** One model's view of a multi-model payload, with the model suffix removed from each field. */
type MultiModelPayload={hourly?:Record<string,unknown>;daily?:Record<string,unknown>;[key:string]:unknown};
export function modelPayload(payload:MultiModelPayload,id:string){
 const pick=(block?:Record<string,unknown>)=>block&&Object.fromEntries(Object.entries(block).flatMap(([k,v])=>k==='time'?[[k,v]]:k.endsWith('_'+id)?[[k.slice(0,-id.length-1),v]]:[]));
 return {...payload,hourly:pick(payload?.hourly),daily:pick(payload?.daily)};
}
/** Each model's hours plus a blend: medians for amounts, mean rain chance, circular mean wind direction. */
export function parseWeatherSources(payload:MultiModelPayload){
 const sources:Partial<Record<WeatherSourceId,WeatherHour[]>>={};let timezone='UTC',sun:SunDay[]=[];
 for(const {id} of weatherSources){try{const parsed=parseWeather(modelPayload(payload,id));if(parsed.hours.some(h=>h.temperature!==null)){sources[id]=parsed.hours;timezone=parsed.timezone;if(!sun.some(d=>d.sunrise!==null))sun=parsed.sun}}catch{}}
 const models=Object.values(sources) as WeatherHour[][];
 if(!models.length)throw new Error('The forecast is unavailable. Please try again.');
 const times=[...new Set(models.flatMap(m=>m.map(h=>h.time)))].sort((a,b)=>a-b),byTime=models.map(m=>new Map(m.map(h=>[h.time,h])));
 const hours:WeatherHour[]=times.map(time=>{
  const at=byTime.map(m=>m.get(time)).filter((h):h is WeatherHour=>!!h&&h.temperature!==null),values=(key:keyof WeatherHour)=>at.map(h=>h[key]).filter((v):v is number=>typeof v==='number');
  return {time,temperature:median(values('temperature')),rainChance:mean(values('rainChance')),rain:median(values('rain')),wind:median(values('wind')),direction:bearing(values('direction')),gust:median(values('gust')),code:commonCode(values('code')),daylight:byTime.map(m=>m.get(time)?.daylight).find(v=>typeof v==='number')??null,models:{rainy:at.filter(raining).length,total:at.length}};
 });
 return {hours,timezone,sun,sources};
}
export function weatherAssessment(h:WeatherHour,rules:WeatherRules=defaultWeatherRules):{grade:WeatherGrade;reasons:string[]}{
 const reasons:string[]=[];let poor=false;
 if(h.code!==null&&[56,57,66,67,71,73,75,77,85,86,95,96,99].includes(h.code)){reasons.push(h.code>=95?'Thunderstorms':'Snow or freezing precipitation');poor=true}
 if(h.temperature!==null&&(h.temperature<0||h.temperature>=35)){reasons.push(h.temperature<0?'Freezing conditions':'Very hot');poor=true}
 if(h.wind!==null&&h.wind>40||h.gust!==null&&h.gust>60){reasons.push('Strong wind or gusts');poor=true}
 if(h.rain!==null&&h.rain>=2){reasons.push('Heavy rain');poor=true}
 if(poor)return {grade:'poor',reasons};
 if([h.temperature,h.rainChance,h.rain,h.wind,h.gust,h.code,h.daylight].some(v=>v===null))return {grade:'unknown',reasons:['Some forecast fields are missing']};
 if(h.daylight!==1)reasons.push('After dark');
 if(h.temperature!<rules.minTemp)reasons.push('Below your temperature range');
 if(h.temperature!>rules.maxTemp)reasons.push('Above your temperature range');
 if(h.rainChance!>rules.rainChance||h.rain!>0.1||[51,53,55,61,63,65,80,81,82].includes(h.code!))reasons.push('Rain possible');
 if(h.wind!>rules.wind)reasons.push('Wind above your limit');
 if(h.gust!>rules.gust)reasons.push('Gusts above your limit');
 return {grade:reasons.length?'mixed':'good',reasons:reasons.length?reasons:['Dry outlook · light wind · daylight']};
}
export function weatherDay(time:number,timezone:string){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time*1000))}
export function weatherTime(time:number,timezone:string){return new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(time*1000))}
export function ridingWindows(hours:WeatherHour[],duration:number,rules:WeatherRules,now=Date.now()/1000){
 const n=Math.max(1,Math.min(12,Math.floor(duration)));const windows:{start:number;end:number;hours:WeatherHour[]}[]=[];
 // Rain is a preceding-hour total: include the end sample as well as the start.
 for(let i=0;i+n<hours.length;i++){const slice=hours.slice(i,i+n+1);if(slice[0].time<now)continue;if(slice.every((h,j)=>weatherAssessment(h,rules).grade==='good'&&(!j||h.time-slice[j-1].time===3600)))windows.push({start:slice[0].time,end:slice[n].time,hours:slice})}
 return windows;
}

export function windBearing(degrees:number|null){
 if(degrees===null||!Number.isFinite(degrees))return null;
 const from=((degrees%360)+360)%360;
 return {from:['N','NE','E','SE','S','SW','W','NW'][Math.round(from/45)%8],towards:(from+180)%360};
}
export function bestRidingWindow(windows:ReturnType<typeof ridingWindows>){
 const rank=(w:typeof windows[number])=>[Math.max(...w.hours.map(h=>h.rainChance!)),Math.max(...w.hours.map(h=>h.rain!)),w.hours.reduce((s,h)=>s+h.wind!,0)/w.hours.length,Math.max(...w.hours.map(h=>h.gust!)),w.start];
 return [...windows].sort((a,b)=>{const x=rank(a),y=rank(b);for(let i=0;i<x.length;i++){if(x[i]!==y[i])return x[i]-y[i]}return 0})[0];
}

export function rainSignal(h:WeatherHour):'forecast'|'possible'|null{
 if((h.rain!==null&&h.rain>0)||(h.code!==null&&[51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(h.code)))return 'forecast';
 return h.rainChance!==null&&h.rainChance>=20?'possible':null;
}

// Summarise the chosen ride, or that day's remaining daylight. Never use midnight
// as a proxy for a future day's cycling conditions.
/** Whether the blended models agree about rain across these hours; null for a single model. */
export function modelAgreement(hours:WeatherHour[]){
 const rated=hours.filter(h=>h.models&&h.models.total>=2);if(!rated.length)return null;
 const total=Math.max(...rated.map(h=>h.models!.total)),wet=rated.filter(h=>h.models!.rainy>0);
 if(!wet.length)return {kind:'dry' as const,total,rainy:0,start:null,end:null};
 const rainy=Math.max(...wet.map(h=>h.models!.rainy)),start=wet[0].time,end=wet.at(-1)!.time+3600;
 return {kind:wet.every(h=>h.models!.rainy===h.models!.total)?'wet' as const:'split' as const,total,rainy,start,end};
}
export function ridingOutlook(dayHours:WeatherHour[],best:ReturnType<typeof bestRidingWindow>,rules:WeatherRules=defaultWeatherRules){
 const daylight=dayHours.filter(h=>h.daylight===1),hours=best?.hours??(daylight.length?daylight:dayHours);
 if(!hours.length)return null;
 const assessments=hours.map(h=>weatherAssessment(h,rules)),priority:WeatherGrade[]=['poor','unknown','mixed','good'];
 let grade=priority.find(g=>assessments.some(a=>a.grade===g))!;
 let reasons=[...new Set(assessments.filter(a=>a.grade!=='good').flatMap(a=>a.reasons))];
 if(!best&&grade==='good'){grade='mixed';reasons=['No complete ride window fits the selected duration']}
 const peak=(key:'temperature'|'rainChance'|'rain'|'wind'|'gust')=>hours.some(h=>h[key]===null)?null:Math.max(...hours.map(h=>h[key]!));
 const minTemp=hours.some(h=>h.temperature===null)?null:Math.min(...hours.map(h=>h.temperature!));
 const windHour=hours.reduce((a,b)=>(b.wind??-1)>(a.wind??-1)?b:a);
 const risk=hours.some(h=>rainSignal(h)==='forecast')?'forecast':hours.some(h=>rainSignal(h)==='possible')?'possible':null;
 return {start:hours[0].time,end:best?.end??hours.at(-1)!.time,scope:best?'Ride window':daylight.length?'Daylight outlook':'Remaining hours',minTemp,
  hour:{...hours[0],temperature:peak('temperature'),rainChance:peak('rainChance'),rain:peak('rain'),wind:peak('wind'),gust:peak('gust'),direction:windHour.direction},
  rain: risk,models:modelAgreement(hours),assessment:{grade,reasons:reasons.length?reasons:['Dry outlook · light wind · daylight']}};
}
// Next two hours in 15-minute steps, for deciding whether to head out now.
export type NowcastSlot={time:number;rain:number|null;chance:number|null};
export function parseNowcast(payload:unknown):NowcastSlot[]{
 const m=(payload as {minutely_15?:Record<string,unknown[]>}|null)?.minutely_15,time=Array.isArray(m?.time)?m.time:[];
 return time.flatMap((t,i)=>typeof t==='number'&&Number.isFinite(t)?[{time:t,rain:num(m?.precipitation?.[i]),chance:num(m?.precipitation_probability?.[i])}]:[]).sort((a,b)=>a.time-b.time);
}
const wetSlot=(s:NowcastSlot)=>(s.rain!==null&&s.rain>=.1)||(s.chance!==null&&s.chance>=50);
/** One sentence: dry, raining until when, or dry until when and for how long. */
export function nowcastSummary(slots:NowcastSlot[],timezone:string){
 const known=slots.filter(s=>s.rain!==null||s.chance!==null);if(!known.length)return null;
 const end=known.at(-1)!.time+900,firstWet=known.findIndex(wetSlot);
 if(firstWet<0)return {kind:'dry' as const,text:'Dry for the next 2 hours'};
 if(firstWet===0){const dry=known.findIndex(s=>!wetSlot(s));return {kind:'wet' as const,text:dry<0?'Rain for the next 2 hours':`Raining now · drying from ${weatherTime(known[dry].time,timezone)}`}}
 const after=known.slice(firstWet),stop=after.findIndex(s=>!wetSlot(s)),minutes=(stop<0?end-after[0].time:after[stop].time-after[0].time)/60;
 return {kind:'later' as const,text:`Dry until ${weatherTime(known[firstWet].time,timezone)}, then rain${stop<0?' for the rest of the 2 hours':` for about ${minutes} min`}`};
}
