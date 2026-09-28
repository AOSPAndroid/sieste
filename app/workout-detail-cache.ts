// In-memory only: no tokens or health data are written to browser storage.
type Entry={data:any;at:number;bytes:number};
const cache=new Map<string,Entry>(),pending=new Map<string,Promise<any>>();let bytes=0,generation=0,active=0,previews=0;
const waiting:{preview:boolean;resolve:()=>void}[]=[];
// Keep one of three slots available for an explicitly opened activity.
function drain(){while(active<3){let index=waiting.findIndex(job=>!job.preview);if(index<0&&previews<2)index=waiting.findIndex(job=>job.preview);if(index<0)return;const [job]=waiting.splice(index,1);active++;if(job.preview)previews++;job.resolve();}}
function acquire(preview:boolean){return new Promise<void>(resolve=>{waiting.push({preview,resolve});drain()})}
const key=(token:string,id:string,action:string)=>`${token}::${action}::${id}`;
export function clearWorkoutCache(){generation++;cache.clear();pending.clear();bytes=0}
export function cachedWorkout(token:string,id:string,action='detail'){return cache.get(key(token,id,action))?.data??(action==='preview'?cache.get(key(token,id,'detail'))?.data:null)??null}
function save(k:string,data:any){const size=JSON.stringify(data).length*2;bytes-=cache.get(k)?.bytes??0;cache.delete(k);cache.set(k,{data,at:Date.now(),bytes:size});bytes+=size;while(bytes>16*1024*1024||cache.size>240){const oldest=cache.keys().next().value!;bytes-=cache.get(oldest)!.bytes;cache.delete(oldest)}}
export async function loadWorkout(token:string,id:string,action='detail',force=false){
 const k=key(token,id,action),full=action==='preview'?cache.get(key(token,id,'detail')):null,entry=cache.get(k)??full;
 if(!force&&entry&&Date.now()-entry.at<10*60*1000)return entry.data;
 if(!force&&action==='preview'&&pending.has(key(token,id,'detail')))return pending.get(key(token,id,'detail'))!;
 if(pending.has(k))return pending.get(k)!;const epoch=generation;
 const preview=action==='preview';
 const task=(async()=>{await acquire(preview);
 try{if(epoch!==generation)throw Error('Connection changed.');const r=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,id,action}),signal:AbortSignal.timeout(90000)});const body:any=await r.json();if(!r.ok||!body.details?.[0]){if(r.status===401)clearWorkoutCache();throw Error(body.error||'Workout details unavailable.')}if(epoch!==generation)throw Error('Connection changed.');save(k,body.details[0]);if(action==='detail')save(key(token,id,'preview'),{id,summary:body.details[0].summary,laps:body.details[0].laps});return body.details[0];}finally{active--;if(preview)previews--;drain();}})();pending.set(k,task);try{return await task}finally{if(pending.get(k)===task)pending.delete(k)}
}
