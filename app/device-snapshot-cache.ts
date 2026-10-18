import type { AthleteData,Workout } from './analytics';

export const SNAPSHOT_TTL=14*86400000;
const MAX_BYTES=15*1024*1024,DATABASE='sieste-device-cache',STORE='dashboards',ACTIVITIES='activities';
type Snapshot={version:1|2;scope:string;savedAt:number;expiresAt:number;data:AthleteData};
type StoredSnapshot={version:2;scope:string;savedAt:number;expiresAt:number;data:Omit<AthleteData,'activities'>;activityIds:string[]};
type ActivityRow={scope:string;id:string;data:Workout};
let activeScope:string|null=null,generation=0,database:Promise<IDBDatabase|null>|null=null;
let known=new Map<string,string>(),writeQueue:Promise<unknown>=Promise.resolve();
const serializedRows=new WeakMap<object,string>();
const encode=(value:unknown)=>JSON.stringify(value,(key,value)=>key==='seriesSampled'||/token|secret|password|authorization|credential|api.?key/i.test(key)?undefined:value);

export function validDashboard(value:unknown):value is AthleteData{
 if(!value||typeof value!=='object')return false;
 const d=value as Partial<AthleteData>;
 return Array.isArray(d.activities)&&!!d.sleep&&typeof d.sleep==='object'&&!Array.isArray(d.sleep)&&!!d.hrv&&typeof d.hrv==='object'&&!Array.isArray(d.hrv);
}
function openDatabase(){
 if(database)return database;
 database=new Promise<IDBDatabase|null>(resolve=>{
  if(typeof indexedDB==='undefined'){resolve(null);return}
  let done=false;
  const finish=(db:IDBDatabase|null)=>{if(done){db?.close();return}done=true;clearTimeout(timer);resolve(db)};
  const timer=setTimeout(()=>finish(null),1000);
  try{
   const request=indexedDB.open(DATABASE,2);
   request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'scope'});
    if(!db.objectStoreNames.contains(ACTIVITIES)){const rows=db.createObjectStore(ACTIVITIES,{keyPath:['scope','id']});rows.createIndex('scope','scope')}
   };
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();database=null};finish(db)};
   request.onerror=()=>finish(null);request.onblocked=()=>finish(null);
  }catch{finish(null)}
 });return database;
}
function transaction(db:IDBDatabase,mode:IDBTransactionMode,work:(meta:IDBObjectStore,rows:IDBObjectStore)=>void){
 return new Promise<boolean>(resolve=>{try{
  const tx=db.transaction([STORE,ACTIVITIES],mode);
  tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false);
  work(tx.objectStore(STORE),tx.objectStore(ACTIVITIES));
 }catch{resolve(false)}});
}
function deleteScope(meta:IDBObjectStore,rows:IDBObjectStore,scope:string){
 meta.delete(scope);
 const cursor=rows.index('scope').openKeyCursor(scope);
 cursor.onsuccess=()=>{if(cursor.result){rows.delete(cursor.result.primaryKey);cursor.result.continue()}};
}
// Scope is remembered on this device and then verified by the account check.
export function activateSnapshotScope(scope:string|null){
 if(scope===activeScope)return;
 activeScope=scope;generation++;known=new Map();
 if(scope)void(async()=>{
  const epoch=generation,db=await openDatabase();
  if(!db||epoch!==generation||activeScope!==scope)return;
  await transaction(db,'readwrite',(meta,rows)=>{
   const keys=meta.getAllKeys();keys.onsuccess=()=>{if(epoch!==generation||activeScope!==scope)return;for(const key of keys.result)if(key!==scope)deleteScope(meta,rows,String(key))};
  });
 })();
}
export async function readDeviceSnapshot(scope:string,now=Date.now()):Promise<Snapshot|null>{
 if(!scope||scope!==activeScope)return null;
 const epoch=generation,db=await openDatabase();
 if(!db||epoch!==generation||scope!==activeScope)return null;
 let entry:Snapshot|StoredSnapshot|undefined,activityRows:ActivityRow[]=[];
 const ok=await transaction(db,'readonly',(meta,rows)=>{
  const request=meta.get(scope);request.onsuccess=()=>{entry=request.result};
  const activities=rows.index('scope').getAll(scope);activities.onsuccess=()=>{activityRows=activities.result};
 });
 if(!ok||epoch!==generation||scope!==activeScope||!entry)return null;
 const byId=new Map(activityRows.map(row=>[row.id,row.data]));
 const data=entry.version===2?{...entry.data,activities:(entry as StoredSnapshot).activityIds?.map(id=>byId.get(id))}:entry.data;
 if(![1,2].includes(entry.version)||entry.scope!==scope||!Number.isFinite(entry.savedAt)||entry.savedAt>now||entry.expiresAt!==entry.savedAt+SNAPSHOT_TTL||entry.expiresAt<=now||!validDashboard(data)||data.activities.some(a=>!a)){
  await transaction(db,'readwrite',(meta,rows)=>deleteScope(meta,rows,scope));known=new Map();return null;
 }
 if(entry.version===2)known=new Map(activityRows.map(row=>[row.id,encode(row.data)]));
 return {...entry,data} as Snapshot;
}
export async function writeDeviceSnapshot(scope:string,data:AthleteData,now=Date.now()){
 if(!scope||scope!==activeScope||!validDashboard(data))return false;
 const epoch=generation;
 const task=writeQueue.then(async()=>{
  const db=await openDatabase();
  if(!db||epoch!==generation||scope!==activeScope)return false;
  try{
   const {activities,...metadata}=data,serialized=encode(metadata),next=new Map<string,string>(),changed:ActivityRow[]=[];
   let bytes=new TextEncoder().encode(serialized).byteLength;
   for(const activity of activities){
    if(!activity||typeof activity.id!=='string')return false;
    let encoded=serializedRows.get(activity);
    if(encoded===undefined){encoded=encode(activity);serializedRows.set(activity,encoded)}
    next.set(activity.id,encoded);bytes+=new TextEncoder().encode(encoded).byteLength;
    if(bytes>MAX_BYTES)return false;
    if(known.get(activity.id)!==encoded)changed.push({scope,id:activity.id,data:JSON.parse(encoded)});
   }
   if(bytes>MAX_BYTES||epoch!==generation||scope!==activeScope)return false;
   const saved=await transaction(db,'readwrite',(meta,rows)=>{
    for(const row of changed)rows.put(row);
    const old=meta.get(scope);old.onsuccess=()=>{
     const previous=old.result as StoredSnapshot|undefined;
     for(const id of previous?.activityIds??[])if(!next.has(id))rows.delete([scope,id]);
    };
    meta.put({version:2,scope,savedAt:now,expiresAt:now+SNAPSHOT_TTL,data:JSON.parse(serialized),activityIds:[...next.keys()]} satisfies StoredSnapshot);
   });
   if(saved&&epoch===generation&&scope===activeScope){known=next;return true}return false;
  }catch{return false}
 });
 writeQueue=task.catch(()=>false);return task;
}
const SCOPE_HINT='sieste-device-scope';
export function rememberedScope():string|null{try{return localStorage.getItem(SCOPE_HINT)||null}catch{return null}}
export function rememberScope(scope:string|null){try{if(scope)localStorage.setItem(SCOPE_HINT,scope);else localStorage.removeItem(SCOPE_HINT)}catch{/* Storage unavailable: wait for the account check. */}}
export async function clearDeviceSnapshot(){
 rememberScope(null);
 activeScope=null;known=new Map();const epoch=++generation,db=await openDatabase();
 if(db&&epoch===generation)await transaction(db,'readwrite',(meta,rows)=>{meta.clear();rows.clear()});
}
