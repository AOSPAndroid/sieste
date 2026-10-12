import type {AthleteData,Workout} from './analytics';
type Change={path:string[];value?:unknown;remove?:true};
export type SyncDelta={format:'sieste-delta-v1';baseSyncedAt:string;upserts:Workout[];removed:string[];changes:Change[]};
const ignored=new Set(['activities','syncRevision']);
const plain=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const same=(a:unknown,b:unknown)=>a===b||JSON.stringify(a)===JSON.stringify(b);
export function createSyncDelta(before:AthleteData,after:AthleteData):SyncDelta{
 const old=new Map(before.activities.map(a=>[a.id,a])),current=new Set(after.activities.map(a=>a.id)),changes:Change[]=[];
 const diff=(a:any,b:any,path:string[])=>{
  if(same(a,b))return;
  if(plain(a)&&plain(b)){for(const key of new Set([...Object.keys(a),...Object.keys(b)])){if(path.length===0&&ignored.has(key))continue;if(!(key in b))changes.push({path:[...path,key],remove:true});else diff(a[key],b[key],[...path,key])}}
  else changes.push({path,value:b});
 };
 diff(before,after,[]);
 return {format:'sieste-delta-v1',baseSyncedAt:before.syncedAt??'',upserts:after.activities.filter(a=>!same(old.get(a.id),a)),removed:[...old.keys()].filter(id=>!current.has(id)),changes};
}
export function applySyncDelta(before:AthleteData,delta:SyncDelta):AthleteData{
 if(!before||delta.baseSyncedAt!==(before.syncedAt??''))throw Error('Saved dashboard changed. Refresh before syncing again.');
 const banned=new Set(['__proto__','prototype','constructor']);
 let result:any=before;
 const update=(object:any,path:string[],value:unknown,remove:boolean):any=>{
  const [key,...rest]=path;if(!key||banned.has(key))throw Error('Invalid dashboard update.');
  const copy={...object};if(rest.length)copy[key]=update(object?.[key],rest,value,remove);else if(remove)delete copy[key];else copy[key]=value;return copy;
 };
 for(const change of delta.changes){if(!Array.isArray(change.path)||!change.path.length||ignored.has(change.path[0]))throw Error('Invalid dashboard update.');result=update(result,change.path,change.value,change.remove===true)}
 const removed=new Set(delta.removed),byId=new Map(before.activities.filter(a=>!removed.has(a.id)).map(a=>[a.id,a]));
 for(const activity of delta.upserts)byId.set(activity.id,activity);
 return {...result,activities:[...byId.values()].sort((a,b)=>b.date.localeCompare(a.date))};
}
