const decay=Math.exp(-1/7);
export const fatigueWarmupDays=28;
export type FatigueIssue='history'|'sync'|'excluded'|'load';
type Day={iso:string;effort:number|null;fatigueCovered:boolean;fatigueIssue?:FatigueIssue|null};

/** A recent-load proxy with a seven-day time constant, not measured tiredness. */
export function trainingFatigue<T extends Day>(rows:T[],today:string){
 let count=0,seed=0,estimate:number|null=null,gap:{iso:string;reason:FatigueIssue}|null=null;
 return rows.map(row=>{
  const provisional=row.iso===today,valid=row.fatigueCovered&&row.effort!==null&&Number.isFinite(row.effort)&&row.effort>=0;
  if(!valid){count=0;seed=0;estimate=null;gap={iso:row.iso,reason:row.fatigueIssue??'load'};}
  else{
   count++;
   if(count<=7){seed+=row.effort!;if(count===7)estimate=seed/7;}
   else estimate=estimate!*decay+row.effort!*(1-decay);
  }
  const finishedDays=Math.max(0,count-(provisional&&valid?1:0));
  const fatigue=finishedDays>=fatigueWarmupDays?estimate:null;
  return {...row,fatigue,fatigueDays:finishedDays,fatigueProvisional:provisional,fatigueGap:fatigue===null?gap:null};
 });
}

export function fatigueStatus(row:{fatigue:number|null;fatigueDays:number;fatigueProvisional:boolean;fatigueGap:{iso:string;reason:FatigueIssue}|null}){
 if(row.fatigue!==null)return row.fatigueProvisional?'provisional':'';
 const gap=row.fatigueGap,progress=`${row.fatigueDays}/${fatigueWarmupDays} completed days`;
 if(!gap)return progress;
 if(gap.reason==='history')return row.fatigueDays>0?progress:'history import incomplete';
 if(gap.reason==='sync')return 'sync needed';
 const date=new Date(gap.iso+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
 const reason=`${gap.reason==='excluded'?'removed workout':'missing load'} · ${date}`;
 return row.fatigueDays>0?`${progress} · ${reason}`:reason;
}
