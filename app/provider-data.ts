// Workouts and their load scale stay together. COROS is authoritative for wellness.
export function combineProviders(training:any,health:any){
 if(!training)return health;if(!health)return training;
 return {...training,provider:'tredict',sleep:health.sleep??{},hrv:health.hrv??{},extra:{...training.extra,bodyvalues:health.extra?.bodyvalues??{bodyvalues:[]},coros:health.extra?.coros},sources:{...training.sources,corosHealth:{provider:'coros',retrievedAt:health.syncedAt}},warnings:[...(training.warnings??[]),...(health.warnings??[])],sourceNote:'Tredict workouts · COROS sleep, health and fitness',healthSyncedAt:health.syncedAt};
}
