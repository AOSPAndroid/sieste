const decay=Math.exp(-1/7);
export const fatigueWarmupDays=28;
type Day={iso:string;effort:number|null;fatigueCovered:boolean};

/** A recent-load proxy with a seven-day time constant, not measured tiredness. */
export function trainingFatigue<T extends Day>(rows:T[],today:string){
 let count=0,seed=0,estimate:number|null=null;
 return rows.map(row=>{
  const provisional=row.iso===today,valid=row.fatigueCovered&&row.effort!==null&&Number.isFinite(row.effort)&&row.effort>=0;
  if(!valid){count=0;seed=0;estimate=null;}
  else{
   count++;
   if(count<=7){seed+=row.effort!;if(count===7)estimate=seed/7;}
   else estimate=estimate!*decay+row.effort!*(1-decay);
  }
  const finishedDays=Math.max(0,count-(provisional&&valid?1:0));
  return {...row,fatigue:finishedDays>=fatigueWarmupDays?estimate:null,fatigueDays:finishedDays,fatigueProvisional:provisional};
 });
}
