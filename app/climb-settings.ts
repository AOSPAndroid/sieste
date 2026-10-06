export type CyclingClimbSettings={mode:'whole'|'steep';minGradePercent:number};
export const climbGradeOptions=[2,3,4,5,6,8] as const;
const storageKey='sieste:cycling-climb-settings:v1';
export function normalizeCyclingClimbSettings(value:unknown):CyclingClimbSettings{
 const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
 return {mode:saved.mode==='whole'?'whole':'steep',minGradePercent:typeof saved.minGradePercent==='number'&&climbGradeOptions.some(grade=>grade===saved.minGradePercent)?saved.minGradePercent:3};
}
export function readCyclingClimbSettings():CyclingClimbSettings{
 try{return normalizeCyclingClimbSettings(typeof window==='undefined'?null:JSON.parse(window.localStorage.getItem(storageKey)??'null'))}catch{return normalizeCyclingClimbSettings(null)}
}
export function saveCyclingClimbSettings(settings:CyclingClimbSettings){
 try{if(typeof window!=='undefined')window.localStorage.setItem(storageKey,JSON.stringify(normalizeCyclingClimbSettings(settings)))}catch{/* Settings still work in memory when device storage is unavailable. */}
}
