import {fatigueRecovery} from './fatigue-recovery-data';
import {metricStatus} from './metric-status';
import {sportFamily} from './sports';
import type {AthleteData} from './analytics';
export function trainingAssessment(data:AthleteData,now:Date){
 const end=new Date(now);
 const rows=fatigueRecovery(data,end,35),avg=(r:typeof rows)=>r.every(v=>v.effort!==null)?r.reduce((s,v)=>s+v.effort!,0)/r.length:null;
 const recent=avg(rows.slice(-7)),base=avg(rows.slice(0,28)),change=recent!==null&&base!==null&&base>0?(recent/base-1)*100:null;
 const signals=['sleep','hrv','rhr'].map(key=>({key,...metricStatus(key,data,now,sportFamily)}));
 const adverse=signals.filter(s=>['orange','red'].includes(s.tone));
 const raised=change!==null&&change>25;
 let tone='neutral',title='Not enough data to judge yet',advice='Keep recording sleep and recovery readings; the assessment needs complete load history and personal baselines.';
 if(adverse.length){tone=adverse.some(s=>s.tone==='red')?'red':'orange';title=raised?'Training may be outpacing recovery':'Recovery needs attention';advice=raised?'Consider an easier day before adding more intensity.':'Consider keeping your next session easy and check how you feel. These changes can also come from stress or illness.';}
 else if(raised){tone='orange';title='Training load has stepped up';advice='Keep an eye on recovery before increasing again. Higher load alone does not mean you are training too hard.';}
 else if(change!==null&&signals.every(s=>['green','lightgreen'].includes(s.tone))){tone='green';title='No clear signs of training too hard';advice='Load is not sharply above your usual level, and available recovery signals look steady. Check this against how you feel.';}
 const missing=signals.some(s=>['No reading','Older reading','Learning your baseline','Limited coverage'].includes(s.label));
 if(tone==='neutral'&&change!==null&&!missing){title='Recovery signals are mixed';advice='Your load comparison is available, but not all recovery signals meet the dashboard’s green criteria. Review the readings below.';if(signals.some(s=>s.tone==='orange'))tone='orange';}
 const loadText=change!==null?`Last 7 days including today so far: ${change>=0?'+':''}${Math.round(change)}% effort vs the preceding 28-day daily average.`:base===0?'No established load baseline yet.':'Load comparison needs 35 days of recorded load coverage (today is partial).';
 return {tone,title,advice,loadText,signals,change};
}
