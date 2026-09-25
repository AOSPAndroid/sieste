// Personal Tredict integration. Tokens and athlete records are never persisted.
import {workoutEvidence} from '../../training-coach-data';
const API='https://www.tredict.com/api/oauth/v2/';
const headers={'Cache-Control':'no-store, private','Pragma':'no-cache'};
function reply(body:unknown,status=200){return Response.json(body,{status,headers})}
class UpstreamError extends Error {constructor(public status:number){super('Tredict request failed')}}
function message(status:number){return status===401||status===403?'Tredict rejected this token. Check its activityRead and bodyvaluesRead permissions. If inactive, sign in to Tredict to reactivate it.':status===429?'Tredict is limiting requests. Please wait a minute before trying again.':'Tredict is temporarily unavailable. Please try again shortly.'}
type RawActivity={id?:string;_id?:string;date?:string;sportType?:string;subSportType?:string;title?:string;summary?:Record<string,unknown>;extendedSummary?:Record<string,unknown>};
type ApiResult={_embedded?:{activityList?:RawActivity[]};activityList?:RawActivity[];_links?:{next?:{href?:string}};sleep?:Record<string,unknown>;hrv?:Record<string,unknown>};
function heartRateHistogram(detail:Record<string,unknown>){const s=detail.seriesSampled as {sampleSize?:number;data?:{heartrate?:unknown[]}}|undefined,values=s?.data?.heartrate,step=s?.sampleSize;if(!Array.isArray(values)||typeof step!=='number'||!Number.isFinite(step)||step<=0)return null;const summary=detail.summary as {durationTotal?:number}|undefined;const cap=summary?.durationTotal;const secondsByBpm:Record<string,number>={};let validSeconds=0,missingSeconds=0;values.forEach((v,i)=>{const seconds=typeof cap==='number'&&Number.isFinite(cap)&&cap>=0?Math.max(0,Math.min(step,cap-i*step)):step;if(typeof v==='number'&&Number.isFinite(v)&&v>0&&v<300){const bpm=Math.round(v);secondsByBpm[bpm]=(secondsByBpm[bpm]??0)+seconds;validSeconds+=seconds}else missingSeconds+=seconds});return {secondsByBpm,validSeconds,missingSeconds,sampleSeconds:step}}
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin&&origin!=='https://apex-athlete-performance.dalilooksk.chatgpt.site')return reply({error:'Cross-site requests are not allowed.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'Expected JSON.'},415);
 const raw=await request.text();if(raw.length>10000)return reply({error:'Invalid token.'},400);
 let token:unknown,payload:{action?:string;ids?:string[];id?:string};try{payload=JSON.parse(raw);token=JSON.parse(raw).token}catch{return reply({error:'Invalid request.'},400)}
 if(typeof token!=='string'||!token.trim()||token.length>8192||/[\r\n]/.test(token))return reply({error:'Enter a valid Tredict personal access token.'},400);
 const accessToken=token.trim().replace(/^Bearer\s+/i,'');
 if(!accessToken||/\s/.test(accessToken))return reply({error:'The token contains spaces. Copy the complete personal API token from Tredict.'},400);
 const newest=new Date(),oldest=new Date(newest);oldest.setUTCHours(0,0,0,0);oldest.setUTCFullYear(newest.getUTCFullYear()-1,0,1);oldest.setUTCDate(oldest.getUTCDate()-31);
 const query=new URLSearchParams({startDate:newest.toISOString(),endDate:oldest.toISOString()});
 async function get(url:string):Promise<ApiResult>{const parsed=new URL(url);if(parsed.origin!=='https://www.tredict.com'||!parsed.pathname.startsWith('/api/oauth/v2/'))throw new Error('Unexpected API link');const res=await fetch(parsed,{headers:{Authorization:`Bearer ${accessToken}`,Accept:'application/json'},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(20000)});if(res.status>=300&&res.status<400)throw new Error('Unexpected Tredict redirect');if(!res.ok)throw new UpstreamError(res.status);return res.json() as Promise<ApiResult>}
 try{
 if(payload.action==='detail'||payload.action==='preview'||payload.action==='enrich'){
  const ids=payload.action!=='enrich'?[payload.id]:payload.ids;
  if(!Array.isArray(ids)||!ids.length||ids.length>4||ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(id)))return reply({error:'Invalid activity selection.'},400);
  const details=[];
  for(const id of ids){const detail=await get(`${API}activity/${encodeURIComponent(id!)}?extraValues=1&withLaps=1${payload.action!=='preview'?'&allSeries=1':''}`) as unknown as Record<string,unknown>;const hrHistogram=heartRateHistogram(detail),evidence=workoutEvidence(detail);details.push(payload.action==='preview'?{id,summary:detail.summary,laps:detail.laps}:payload.action==='detail'?{...detail,hrHistogram,evidence}:{id,summary:detail.summary,hrHistogram,evidence});}
  return reply({details});
 }
 const results=await Promise.allSettled([get(`${API}activityList?${query}&pageSize=500&extendedSummary=1`),get(`${API}sleep?${query}`),get(`${API}hrv?${query}`)]);
 const activityResult=results[0];if(activityResult.status==='rejected')throw activityResult.reason;
 const warnings:string[]=[];let page=activityResult.value;const rawActivities:RawActivity[]=[];const visited=new Set<string>();
 for(let i=0;i<20;i++){
  const items=page?._embedded?.activityList??page?.activityList;
  if(!Array.isArray(items))throw new Error('Invalid activity data');
  rawActivities.push(...items);
  const next=page?._links?.next?.href;
  if(!next||items.some((a:RawActivity)=>a.date&&new Date(a.date)<oldest))break;
  if(i===19){warnings.push('Training history was truncated. Totals may be incomplete.');break}
  if(visited.has(next))throw new Error('Repeated API page');visited.add(next);page=await get(next);
 }
 const number=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:undefined;
 const unique=new Map();
 for(const a of rawActivities){if(!a.date||isNaN(Date.parse(a.date))||new Date(a.date)<oldest||new Date(a.date)>newest)continue;const s=a.summary??a.extendedSummary??{};const id=a.id??a._id;if(!id)continue;unique.set(id,{id,date:a.date,sportType:a.sportType??'misc',subSportType:typeof a.subSportType==='string'?a.subSportType:undefined,title:a.title??(typeof s.title==='string'?s.title:undefined),summary:s})}
 const activities=Array.from(unique.values()).sort((a,b)=>b.date.localeCompare(a.date));
 if(activities.some(a=>a.summary.duration==null))warnings.push('Some sessions have no duration. Training totals exclude missing durations.');
 function health(index:number,key:"sleep"|"hrv"){const r=results[index];if(r.status==='rejected'){warnings.push(`${key==='hrv'?'HRV':'Sleep'} could not be synced. ${r.reason instanceof UpstreamError?message(r.reason.status):'Please try again.'}`);return {}}const source=r.value?.[key];if(!source||typeof source!=='object'){warnings.push(`${key==='hrv'?'HRV':'Sleep'} data was unavailable in the Tredict response.`);return {}}return Object.fromEntries(Object.entries(source).filter(([date,v])=>/^\d{8}$/.test(date)&&Array.isArray(v)&&number(v[0])!==undefined).map(([date,v])=>{const pair=v as unknown[];return [date,[number(pair[0]),number(pair[1])??null]]}))}
 const endpoints=['efforts','bodyvalues','capacity','zones','equipmentList','plannedTrainingList'];
 const upcoming=new Date(newest);upcoming.setUTCDate(upcoming.getUTCDate()+90);
 const extras=await Promise.allSettled(endpoints.map(key=>get(`${API}${key}${key==='efforts'?'?'+query:key==='plannedTrainingList'?'?'+new URLSearchParams({startDate:oldest.toISOString(),endDate:upcoming.toISOString()}):''}`)));
 const sources:Record<string,{status:string;message?:string}>={},extra:Record<string,unknown>={};
 extras.forEach((result,i)=>{const key=endpoints[i];if(result.status==='fulfilled'){extra[key]=result.value;sources[key]={status:'synced'}}else{sources[key]={status:'unavailable',message:result.reason instanceof UpstreamError?message(result.reason.status):'This source could not be loaded. Sync again to retry.'};warnings.push(`${key} could not be synced.`)}});
 return reply({provider:'tredict',activities,sleep:health(1,'sleep'),hrv:health(2,'hrv'),extra,sources,historyVersion:2,historyStart:oldest.toISOString(),historyComplete:!warnings.some(w=>w.includes('truncated')),warnings,syncedAt:newest.toISOString()});
 }catch(error){return reply({error:error instanceof UpstreamError?message(error.status):'Unable to complete the sync. Check your connection and try again.'},error instanceof UpstreamError&&[401,403,429].includes(error.status)?error.status:502)}
}
