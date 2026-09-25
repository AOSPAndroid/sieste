// Replace the authoritative recent window; preserve history outside it.
export function mergeRecentSnapshot(prior:any,fresh:any){
 const complete=fresh.historyComplete===true,cutoff=Date.parse(fresh.historyStart);
 const activities=new Map(prior.activities.filter((a:any)=>!complete||Date.parse(a.date)<cutoff).map((a:any)=>[a.id,a]));
 for(const a of fresh.activities)activities.set(a.id,a);
 return {...prior,...fresh,activities:[...activities.values()].sort((a:any,b:any)=>b.date.localeCompare(a.date)),sleep:{...prior.sleep,...fresh.sleep},hrv:{...prior.hrv,...fresh.hrv},extra:{...prior.extra,...fresh.extra,efforts:{...prior.extra?.efforts,...fresh.extra?.efforts,trainingEfforts:{...prior.extra?.efforts?.trainingEfforts,...fresh.extra?.efforts?.trainingEfforts}}},sources:{...prior.sources,...fresh.sources},historyStart:prior.historyStart,historyComplete:prior.historyComplete&&complete,fullSyncedAt:prior.fullSyncedAt};
}
