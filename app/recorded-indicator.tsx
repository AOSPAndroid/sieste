import type {Trend} from './trend';
import TrendBadge from './trend-badge';
type Reading={date:string;value:unknown};
export function recordedTrend(readings:Reading[],direction:'higher'|'lower'|'neutral'='neutral',completeDays=false,now=new Date()):Trend{
 const today=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`,unique=new Map<string,number>();
 for(const r of readings){const d=r.date.replaceAll('-','').slice(0,8);if(/^\d{8}$/.test(d)&&d<=today&&(!completeDays||d<today)&&typeof r.value==='number'&&Number.isFinite(r.value))unique.set(d,r.value)}
 const rows=[...unique].sort(([a],[b])=>a.localeCompare(b)),last=rows.at(-1),prior=rows.at(-2),missing=(description:string):Trend=>({tone:'missing',arrow:'—',text:'No comparison',description});
 if(!last||!prior)return missing('Two dated readings are needed; nothing is inferred from missing values.');
 const parse=(d:string)=>new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T12:00:00`),age=(now.getTime()-parse(last[0]).getTime())/86400000,gap=(parse(last[0]).getTime()-parse(prior[0]).getTime())/86400000;
 if(age>7||gap>35)return missing('The comparison is too old to indicate current progress.');
 const diff=last[1]-prior[1],pct=prior[1]===0?null:diff/Math.abs(prior[1])*100,small=pct!==null&&Math.abs(pct)<2,good=direction==='higher'?diff>0:diff<0;
 return {tone:diff===0||small?'steady':direction==='neutral'?'neutral':good?'good':'watch',arrow:diff===0?'→':diff>0?'↑':'↓',text:diff===0?'Unchanged':`${pct===null?Math.abs(diff).toFixed(1):Math.abs(pct).toFixed(1)+'%'}${small?' · small change':''}`,description:`${last[1]} (${last[0]}) vs ${prior[1]} (${prior[0]}). ${completeDays?'Last two completed recorded days; today excluded. ':''}${direction==='neutral'?'Direction only: higher is not automatically better.':small?'Under 2% is treated as small variation, not an alert.':'A favourable or adverse estimate change, not confirmed fitness or a diagnosis.'}`};
}
export default function RecordedIndicator({readings,direction='neutral',completeDays=false}:{readings:Reading[];direction?:'higher'|'lower'|'neutral';completeDays?:boolean}){return <span className="recorded-indicator"><TrendBadge trend={recordedTrend(readings,direction,completeDays)}/>{completeDays&&<small>completed days</small>}</span>}
