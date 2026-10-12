import {storage,ownerPrefix} from './storage';
const snapshots=new Map<string,{task:Promise<any>;size:number}>();
let bytes=0;
const MAX_BYTES=25*1024*1024,MAX_KEYS=8;
function immutable(value:any){const stack=[value];while(stack.length){const item=stack.pop();if(!item||typeof item!=='object'||Object.isFrozen(item))continue;Object.freeze(item);for(const child of Object.values(item))if(child&&typeof child==='object')stack.push(child);}return value;}
function forget(key:string){const entry=snapshots.get(key);if(entry){bytes-=entry.size;snapshots.delete(key);}}
export async function savedSnapshot(owner:string,key:string){
 if(!key.startsWith(await ownerPrefix(owner)))throw new Error('Invalid account snapshot.');
 const cached=snapshots.get(key);if(cached){snapshots.delete(key);snapshots.set(key,cached);return cached.task;}
 const entry:{task:Promise<any>;size:number}={task:Promise.resolve(null),size:0};
 entry.task=(async()=>{const object=await storage().bucket.get(key);if(!object){forget(key);return null;}const data=await object.json();if(snapshots.get(key)===entry){entry.size=object.size??JSON.stringify(data).length;bytes+=entry.size;while(snapshots.size>MAX_KEYS||bytes>MAX_BYTES){const first=snapshots.keys().next().value;if(!first)break;forget(first);}}return immutable(data);})().catch(error=>{if(snapshots.get(key)===entry)forget(key);throw error;});
 snapshots.set(key,entry);
 while(snapshots.size>MAX_KEYS)forget(snapshots.keys().next().value!);
 return entry.task;
}
