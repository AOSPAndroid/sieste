export const overnightSources=['querySleepData','querySleepHrv','queryRestingHeartRate'];
export function healthDay(now:Date,timeZone='UTC'){
 try{return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now).replaceAll('-','')}catch{return now.toISOString().slice(0,10).replaceAll('-','')}
}
export function hasDailyReading(name:string,day:string,sleep:any,hrv:any,bodyvalues:any[]){
 const positive=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>0;
 if(name==='querySleepData')return positive(sleep?.[day]?.[0]);
 if(name==='querySleepHrv')return positive(hrv?.[day]?.[0]);
 if(name==='queryRestingHeartRate')return bodyvalues.some(r=>r.timestamp?.slice(0,10).replaceAll('-','')===day&&positive(r.hrRestDynamic));
 return true;
}
export function refreshHealth(name:string,old:any,now:Date,hasToday:boolean,manual=false){
 // A dated measurement is the completion marker, not a successful API request.
 if(overnightSources.includes(name)){
  if(hasToday)return false;
  if(manual)return true;
 }
 const age=now.getTime()-Date.parse(old?.attemptedAt??old?.retrievedAt??'');
 if(age<3600000)return false;
 return !(name==='queryFitnessAssessmentOverview'&&hasToday&&(old?.retrievedAt??'').slice(0,10)===now.toISOString().slice(0,10));
}

export function hasSleepWindowReading(day:string,sleep:any,windows:any){
 const w=windows?.[day],pattern=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
 if(!hasDailyReading('querySleepData',day,sleep,{},[]))return false;
 if(!pattern.test(w?.bedtime??'')||!pattern.test(w?.wakeTime??''))return false;
 const bed=Date.parse(w.bedtime.replace(' ','T')),wake=Date.parse(w.wakeTime.replace(' ','T'));
 return Number.isFinite(bed)&&Number.isFinite(wake)&&wake>bed&&w.wakeTime.slice(0,10).replaceAll('-','')===day;
}
