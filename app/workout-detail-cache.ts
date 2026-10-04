// In-memory only: no tokens or health data are written to browser storage.
type Entry={data:any;at:number;bytes:number;revision:number};
const cache=new Map<string,Entry>(),pending=new Map<string,Promise<any>>();let bytes=0,generation=0,active=0,previews=0,revision=0;
const listeners=new Set<(token:string|null,id:string|null)=>void>();
export function subscribeWorkoutPreviews(listener:(token:string|null,id:string|null)=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
function changed(token:string|null,id:string|null){for(const listener of listeners)listener(token,id)}
const waiting:{preview:boolean;resolve:()=>void}[]=[];
// Keep one of three slots available for an explicitly opened activity.
function drain(){while(active<3){let index=waiting.findIndex(job=>!job.preview);if(index<0&&previews<2)index=waiting.findIndex(job=>job.preview);if(index<0)return;const [job]=waiting.splice(index,1);active++;if(job.preview)previews++;job.resolve();}}
function acquire(preview:boolean){return new Promise<void>(resolve=>{waiting.push({preview,resolve});drain()})}
const key=(token:string,id:string,action:string)=>`${token}::${action}::${id}`;
export function clearWorkoutCache(){generation++;cache.clear();pending.clear();bytes=0;changed(null,null)}
export function cachedWorkout(token:string,id:string,action='detail'){return cache.get(key(token,id,action))?.data??(action==='preview'?cache.get(key(token,id,'detail'))?.data:null)??null}
function save(k:string,data:any){const size=JSON.stringify(data).length*2;bytes-=cache.get(k)?.bytes??0;cache.delete(k);cache.set(k,{data,at:Date.now(),bytes:size,revision:++revision});bytes+=size;while(bytes>16*1024*1024||cache.size>240){const oldest=cache.keys().next().value!;bytes-=cache.get(oldest)!.bytes;cache.delete(oldest)}}
/** Enrichment already fetched the sensors; publish only its compact Home preview. */
export function rememberWorkoutPreview(token:string,id:string,detail:any){
 if(!Array.isArray(detail.laps))return;
 const existing=cache.get(key(token,id,'preview'));
 // A late response without sensors must not erase a profile already retrieved.
 if(existing?.data.elevationPreview&&!detail.elevationPreview)return;
 save(key(token,id,'preview'),{id,summary:detail.summary,laps:detail.laps,elevationPreview:detail.elevationPreview,previewVersion:detail.previewVersion??1});changed(token,id);
}
export async function loadWorkout(token:string,id:string,action='detail',force=false){
 const k=key(token,id,action),full=action==='preview'?cache.get(key(token,id,'detail')):null,entry=cache.get(k)??full;
 // Providers can finish processing altitude after the first activity retrieval.
 const ttl=['preview','detail'].includes(action)&&!entry?.data.elevationPreview?60000:10*60*1000;
 if(!force&&entry&&Date.now()-entry.at<ttl)return entry.data;
 if(!force&&action==='preview'&&pending.has(key(token,id,'detail')))return pending.get(key(token,id,'detail'))!;
 if(pending.has(k))return pending.get(k)!;const epoch=generation;
 const preview=action==='preview';
 const task=(async()=>{await acquire(preview);
 try{if(epoch!==generation)throw Error('Connection changed.');const started=revision,r=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,id,action}),signal:AbortSignal.timeout(90000)});const body:any=await r.json();if(!r.ok||!body.details?.[0]){if(r.status===401)clearWorkoutCache();throw Error(body.error||'Workout details unavailable.')}if(epoch!==generation)throw Error('Connection changed.');const newer=cache.get(k);if(preview&&newer&&(newer.revision>started||newer.data.elevationPreview&&!body.details[0].elevationPreview))return newer.data;save(k,body.details[0]);if(action==='detail')rememberWorkoutPreview(token,id,body.details[0]);else if(preview)changed(token,id);return body.details[0];}finally{active--;if(preview)previews--;drain();}})();pending.set(k,task);try{return await task}finally{if(pending.get(k)===task)pending.delete(k)}
}
