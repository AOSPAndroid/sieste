// Only explicitly mapped COROS fields cross the provider boundary. Version 3
// invalidates details/analyses which previously spread an archived summary.
export const COROS_NATIVE_VERSION=3;
const recordKeys=['duration','durationTotal','distance','heartrate','calories','sets','pace','speed','trainingLoad','aerobicTrainingEffect','anaerobicTrainingEffect'];
const nativeKeys=[...recordKeys,'cadence','stepLength','power','heartrateMax','powerMax','speedMax','temperature','groundContactTime','verticalRatio','verticalOscillation','altitude','hrBands','zonesDistribution'];
export function corosNativeSummary(summary:any,verified=false){return Object.fromEntries((verified?nativeKeys:recordKeys).filter(k=>summary?.[k]!==undefined).map(k=>[k,summary[k]]))}
export function corosNativeActivity(a:any){
 const verified=a.nativeVersion===COROS_NATIVE_VERSION;
 const result:any={id:a.id,provider:'coros',coros:a.coros,date:a.date,localDay:a.localDay,sportType:a.sportType,subSportType:a.subSportType,title:a.title,sessionLabel:a.sessionLabel,summary:corosNativeSummary(a.summary,verified)};
 if(a.fallbackId)result.fallbackId=a.fallbackId; // Removal alias only; never a data source.
 if(verified)for(const key of ['nativeVersion','analysisSource','recordedSource','analyzed','evidence','hrHistogram','laps','seriesSampled'])if(a[key]!==undefined)result[key]=a[key];
 return result;
}
export function corosNativeSnapshot(data:any){if(!data||data.provider!=='coros')return data;const {archiveActivities,archivedZones,...coros}=data.extra?.coros??{};const nativeHealth=coros.importVersion===2;return {...data,activities:(data.activities??[]).filter((a:any)=>a.provider==='coros').map(corosNativeActivity),sleep:nativeHealth?data.sleep:{},hrv:nativeHealth?data.hrv:{},sources:Object.fromEntries(Object.entries(data.sources??{}).filter(([,v]:any)=>v.provider==='coros')),extra:{coros,bodyvalues:nativeHealth?data.extra?.bodyvalues:{bodyvalues:[]},efforts:nativeHealth?data.extra?.efforts:{trainingEfforts:{}}},sourceNote:'COROS · native workout and health data'}}
