import {storage,ownerPrefix} from './storage';
import {seal,unseal} from './token-crypto';
export const COROS_REGIONS={eu:'https://mcpeu.coros.com',us:'https://mcpus.coros.com',cn:'https://mcpcn.coros.com'} as const;
export type Region=keyof typeof COROS_REGIONS;
export type CorosConnection={owner:string;revision:string;credentials:string;region:Region;snapshot_key:string|null;updated_at:string};
export type Credentials={clientId:string;accessToken:string;refreshToken?:string;expiresAt:number};
export class CorosError extends Error{constructor(message:string,public status=502){super(message)}}
export function issuer(region:string){if(!(region in COROS_REGIONS))throw new CorosError('Choose your COROS account region.',400);return COROS_REGIONS[region as Region]}
export async function corosConnection(owner:string){return storage().db.prepare('SELECT * FROM coros_connections WHERE owner = ?').bind(owner).first<CorosConnection>()}
export async function encodeCredentials(owner:string,value:unknown){return seal(JSON.stringify(value),storage().key,owner+':coros')}
export async function decodeCredentials<T>(owner:string,value:string):Promise<T>{return JSON.parse(await unseal(value,storage().key,owner+':coros'))}
export async function corosPrefix(owner:string){return (await ownerPrefix(owner))+'coros/'}
// OAuth errors only a new sign-in can fix (RFC 6749 §5.2), e.g. a refresh token
// COROS has already rotated or revoked. Retrying these never helps.
const SIGN_IN_ERRORS=new Set(['invalid_grant','invalid_client','unauthorized_client','invalid_token']);
export async function corosJson(url:string,init:RequestInit,{retries=1,delay=1500}:{retries?:number;delay?:number}={}){
 for(let attempt=0;;attempt++){
  const retry=attempt<retries,pause=()=>new Promise(resolve=>setTimeout(resolve,delay));
  let r:Response;
  try{r=await fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(20000)})}
  catch{
   console.error('COROS OAuth request failed',{path:new URL(url).pathname,status:'no response',attempt});
   if(retry){await pause();continue}
   throw new CorosError('COROS did not respond. Your saved data is unchanged; try again in a few minutes.',503);
  }
  if(r.ok)return r.json() as Promise<any>;
  const body=await r.json().catch(()=>null) as {error?:unknown}|null,code=typeof body?.error==='string'?body.error:undefined;
  // Status and OAuth error code only: never tokens or response bodies.
  console.error('COROS OAuth request failed',{path:new URL(url).pathname,status:r.status,error:code,attempt});
  if(r.status===429)throw new CorosError('COROS is limiting requests. Please try again later.',429);
  if(r.status===401||r.status===403||(code&&SIGN_IN_ERRORS.has(code)))throw new CorosError('Your COROS sign-in has expired. Reconnect COROS in Account to keep syncing.',401);
  if(r.status>=500&&retry){await pause();continue}
  throw new CorosError(r.status>=500?'COROS is temporarily unavailable. Your saved data is unchanged; try again in a few minutes.':'COROS could not complete this request. Please retry.',r.status>=500?503:502);
 }
}
export function tokenCredentials(payload:any,clientId:string,oldRefresh?:string):Credentials{if(typeof payload?.access_token!=='string'||!payload.access_token)throw new CorosError('COROS did not return an access token. Please reconnect.');return {clientId,accessToken:payload.access_token,refreshToken:payload.refresh_token??oldRefresh,expiresAt:Date.now()+Math.max(0,Number(payload.expires_in??3600))*1000}}
const refreshing=new Map<string,Promise<Credentials>>();
export async function accessCredentials(row:CorosConnection):Promise<Credentials>{const saved=await decodeCredentials<Credentials>(row.owner,row.credentials);if(saved.expiresAt>Date.now()+60000)return saved;if(!saved.refreshToken)throw new CorosError('Please reconnect COROS to continue syncing.',401);const key=row.owner+row.revision;const pending=refreshing.get(key);if(pending)return pending;const work=(async()=>{const lease=Date.now()+60000;const lock=await storage().db.prepare('UPDATE coros_connections SET refresh_lock = ? WHERE owner = ? AND revision = ? AND credentials = ? AND refresh_lock < ?').bind(lease,row.owner,row.revision,row.credentials,Date.now()).run();if(!lock.meta.changes)throw new CorosError('COROS connection is refreshing. Please try again shortly.',409);try{const payload=await corosJson(issuer(row.region)+'/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:saved.clientId,refresh_token:saved.refreshToken!})});const next=tokenCredentials(payload,saved.clientId,saved.refreshToken);const encrypted=await encodeCredentials(row.owner,next);const result=await storage().db.prepare('UPDATE coros_connections SET credentials = ? WHERE owner = ? AND revision = ? AND credentials = ?').bind(encrypted,row.owner,row.revision,row.credentials).run();if(!result.meta.changes){const latest=await corosConnection(row.owner);if(!latest||latest.revision!==row.revision)throw new CorosError('Your connection changed. Reload and try again.',409);return decodeCredentials<Credentials>(row.owner,latest.credentials)}return next}finally{await storage().db.prepare('UPDATE coros_connections SET refresh_lock = 0 WHERE owner = ? AND revision = ? AND refresh_lock = ?').bind(row.owner,row.revision,lease).run()}})();refreshing.set(key,work);try{return await work}finally{refreshing.delete(key)}}
