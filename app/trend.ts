import {sportFamily} from './sports';
export type Trend={tone:'good'|'watch'|'bad'|'steady'|'neutral'|'missing';arrow:string;text:string;description:string};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function valueTrend(value:unknown,previous:unknown,direction:'higher'|'lower'|'neutral'='neutral',comparison='previous period',redPercent=10):Trend{
 if(!finite(value)||!finite(previous))return {tone:'missing',arrow:'—',text:'No comparison',description:`Not enough recorded data to compare with ${comparison}.`};
 const change=value-previous,percent=previous!==0?change/Math.abs(previous)*100:null;
 if(Math.abs(change)<1e-9)return {tone:'steady',arrow:'→',text:'Unchanged',description:`${value} vs ${previous} · ${comparison}`};
 const positive=direction==='higher'?change>0:change<0,tone=direction==='neutral'?'neutral':positive?'good':Math.abs(percent??0)>=redPercent?'bad':'watch';
 const amount=percent===null?`${Math.abs(change).toLocaleString('en-GB',{maximumFractionDigits:1})} (new baseline)`:Math.abs(percent)<.1?'<0.1%':`${Math.abs(percent).toFixed(1)}%`;
 return {tone,arrow:change>0?'↑':'↓',text:amount,description:`${value.toLocaleString('en-GB',{maximumFractionDigits:2})} vs ${previous.toLocaleString('en-GB',{maximumFractionDigits:2})} · ${comparison}`};
}
export function sessionTrend(activity:any,history:any[]){
 const family=sportFamily(activity),s=activity.summary??{},date=Date.parse(activity.date);
 if(!['running','cycling'].includes(family)||!finite(s.duration)||s.duration<1200||(!finite(s.heartrate)||s.heartrate<=0)||/(interval|track|tempo|race)/i.test(`${activity.title??''} ${activity.subSportType??''}`))return null;
 const output=(a:any)=>family==='running'?(a.summary?.distance>0&&a.summary?.duration>0?a.summary.duration/a.summary.distance*1000:null):(finite(a.summary?.power)?a.summary.power:null);
 const elevation=(a:any)=>finite(a.summary?.altitude?.ascent)&&a.summary?.distance>0?a.summary.altitude.ascent/(a.summary.distance/1000):null;
 const candidates=history.filter(a=>{const p=a.summary??{},when=Date.parse(a.date);return a.id!==activity.id&&when<date&&when>=date-84*86400000&&sportFamily(a)===family&&(a.subSportType??'generic')===(activity.subSportType??'generic')&&!/(interval|track|tempo|race)/i.test(`${a.title??''} ${a.subSportType??''}`)&&finite(p.duration)&&p.duration>=1200&&Math.abs(p.duration/s.duration-1)<=.2&&finite(p.heartrate)&&p.heartrate>0&&Math.abs(p.heartrate-s.heartrate)<=5&&finite(output(a))&&(!(finite(s.temperature)&&finite(p.temperature))||Math.abs(s.temperature-p.temperature)<=5)&&(!(finite(elevation(a))&&finite(elevation(activity)))||Math.abs(elevation(a)!-elevation(activity)!)<=5)}).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 const prior=candidates[0],value=output(activity);if(!prior||!finite(value)||value<=0||!output(prior)||output(prior)!<=0)return null;
 const label=family==='running'?'Pace':'Power',comparison=`similar ${family==='running'?'run':'ride'} on ${new Date(prior.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`;
 return {metric:family==='running'?'speed':'power',label,prior,trend:valueTrend(value,output(prior),family==='running'?'lower':'higher',comparison),comparison,explanation:'Same sport and subtype, duration within 20% and average HR within 5 bpm. Ascent/km and temperature are matched when both are recorded. Weather, terrain and session purpose can still differ; this comparison does not prove a fitness change.'};
}

export function vo2Trend(activity:any,history:any[]){
 const value=activity.summary?.vo2max,date=Date.parse(activity.date);
 if(sportFamily(activity)!=='running'||!finite(value)||value<=0)return null;
 const prior=history.filter(a=>a.id!==activity.id&&sportFamily(a)==='running'&&Date.parse(a.date)<date&&Date.parse(a.date)>=date-35*86400000&&finite(a.summary?.vo2max)&&a.summary.vo2max>0).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))[0];
 if(!prior)return null;const comparison=`prior running estimate · ${new Date(prior.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`;
 return {metric:'vo2max',label:'VO₂ estimate',prior,comparison,trend:valueTrend(value,prior.summary.vo2max,'higher',comparison,3),explanation:'Latest workout VO₂ estimate versus the prior recorded running estimate. Different workout conditions can change estimates; this is not a confirmed fitness change.'};
}

export function recoveryTrend(value:unknown,previous:unknown,status:import('./metric-status').MetricStatus,comparison='previous recorded day'):Trend{const trend=valueTrend(value,previous,'neutral',comparison);return {...trend,tone:trend.tone==='missing'?'missing':status.tone==='red'?'bad':status.tone==='orange'?'watch':'neutral',description:trend.description+' · '+status.reason};}
