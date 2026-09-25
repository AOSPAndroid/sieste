export function refreshHealth(name:string,old:any,now:Date,hasToday:boolean){
 const age=now.getTime()-Date.parse(old?.attemptedAt??old?.retrievedAt??'');
 if(age<3600000)return false;
 const daily=['querySleepData','querySleepHrv','queryRestingHeartRate','queryFitnessAssessmentOverview'].includes(name);
 return !(daily&&hasToday&&(old?.retrievedAt??'').slice(0,10)===now.toISOString().slice(0,10));
}
