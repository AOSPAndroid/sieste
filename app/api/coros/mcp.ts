import {accessCredentials,issuer,CorosConnection,CorosError} from '../../../db/coros';
import {requestPool} from '../request-pool';
const clients=new Map<string,{token:string;expires:number;task:Promise<CorosClient>}>();
type CorosClient={tools:any[];callRaw:(name:string,args?:any)=>Promise<any>;call:(name:string,args?:any)=>Promise<any>};
export async function createCorosClient(row:CorosConnection):Promise<CorosClient>{
 const credentials=await accessCredentials(row),key=row.owner+':'+row.revision+':'+row.region,old=clients.get(key);
 if(old&&old.token===credentials.accessToken&&old.expires>Date.now())return old.task;
 const task=openClient(row,credentials.accessToken).catch(error=>{if(clients.get(key)?.task===task)clients.delete(key);throw error;});
 if(clients.size>=128){for(const [key,value] of clients)if(value.expires<Date.now())clients.delete(key);if(clients.size>=128)clients.delete(clients.keys().next().value!);}
 clients.set(key,{token:credentials.accessToken,expires:Date.now()+86400000,task});return task;
}
export function unwrapTool(result:any){if(result?.isError)throw new CorosError('COROS could not return this data. Try syncing again.');if(result?.structuredContent)return result.structuredContent;const texts=(result?.content??[]).filter((x:any)=>x.type==='text').map((x:any)=>x.text);for(const value of texts){try{return JSON.parse(value)}catch{/* Some tools return a JSON fenced block. */}const fenced=value.match(/```(?:json)?\s*([\s\S]*?)```/);if(fenced)try{return JSON.parse(fenced[1])}catch{}}return {text:texts.join('\n')}}
export function resolveCorosTool(tools:any[],name:string){
 // Current COROS renamed the sleep endpoint; keep legacy callers/cache keys stable.
 const names=name.toLowerCase()==='querysleepdata'?['querysleepoverview','querysleepdata']:[name.toLowerCase()];
 for(const candidate of names){const tool=tools.find(t=>t.name.toLowerCase()===candidate);if(tool)return tool;}
 return undefined;
}
async function openClient(row:CorosConnection,accessToken:string):Promise<CorosClient>{const endpoint=issuer(row.region)+'/mcp',pool=requestPool(4);let session='',nextId=0,restarting:Promise<void>|null=null;
 async function send(method:string,params?:any,notify=false){const id=notify?undefined:++nextId;let response:Response|undefined;
 const attempts=method==='tools/call'&&/downloadActivityFitFiles/i.test(params?.name??'')?1:3;
 for(let attempt=0;attempt<attempts;attempt++){
  const sessionId=session;response=await fetch(endpoint,{method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-03-26',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',...(id===undefined?{}:{id}),method,params}),signal:AbortSignal.timeout(20000)});
  if(response.status===404&&sessionId){await response.body?.cancel();throw new SessionExpired(sessionId);}
  if(response.status!==429&&response.status<500||attempt===attempts-1)break;
  const retry=response.headers.get('retry-after'),seconds=retry?Number(retry):NaN,delay=retry?(Number.isFinite(seconds)?seconds*1000:Date.parse(retry)-Date.now()):400*2**attempt+Math.random()*300;
  // Do not wait past the route's deadline or retry earlier than Retry-After.
  if(!Number.isFinite(delay)||delay>5000)break;
  await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,Math.max(0,delay)));
 }
 if(!response)throw new CorosError('COROS is temporarily unavailable.');if(response.status===401||response.status===403)throw new CorosError('Reconnect COROS to continue syncing.',401);if(response.status===429)throw new CorosError('COROS is limiting requests. Your saved data is unchanged; try again later.',429);if(!response.ok)throw new CorosError('COROS is temporarily unavailable. Your saved data is unchanged.');session=response.headers.get('mcp-session-id')||session;if(notify)return null;let message:any;
 if(response.headers.get('content-type')?.includes('text/event-stream')){const reader=response.body?.getReader();if(!reader)throw new CorosError('Empty COROS response.');const decoder=new TextDecoder();let buffer='',size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12000000)throw new CorosError('COROS returned too much data for one request.');buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const raw=event.split('\n').filter(v=>v.startsWith('data:')).map(v=>v.slice(5).trimStart()).join('\n');if(!raw)continue;const parsed=JSON.parse(raw);if(parsed.id===id){message=parsed;break}}if(message)break}}finally{await reader.cancel()}}
 else message=await response.json();if(message?.error)throw new CorosError('COROS rejected this data request. Please try again.');if(message?.id!==id||!('result' in message))throw new CorosError('COROS returned an unexpected response.');return message.result;
 }
 async function initialize(){session='';await send('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'sieste',version:'1.0.0'}});await send('notifications/initialized',undefined,true);}
 await initialize();const catalogue=await send('tools/list');const tools:any[]=catalogue?.tools??[];
 async function rpc(method:string,params?:any){return pool(async()=>{try{return await send(method,params)}catch(error){if(!(error instanceof SessionExpired))throw error;if(!restarting&&error.session===session)restarting=initialize().finally(()=>{restarting=null});if(restarting)await restarting;return send(method,params);}});}
 return {tools,async callRaw(name:string,args:any={}){const tool=resolveCorosTool(tools,name);if(!tool)throw new CorosError("COROS tool unavailable.",422);return rpc("tools/call",{name:tool.name,arguments:args})},async call(name:string,args:any={}){const tool=resolveCorosTool(tools,name);if(!tool)throw new CorosError(`COROS has not enabled ${name} for this connection.`,422);return unwrapTool(await rpc('tools/call',{name:tool.name,arguments:args}))}};
}
class SessionExpired extends Error {constructor(public session:string){super('COROS session expired.');}}
