import {env} from 'cloudflare:workers';
export function storage(){const bindings=env as unknown as {DB?:D1Database;ATHLETE_DATA?:R2Bucket;TOKEN_ENCRYPTION_KEY?:string};if(!bindings.DB||!bindings.ATHLETE_DATA||!bindings.TOKEN_ENCRYPTION_KEY)throw new Error('Account storage unavailable');return {db:bindings.DB,bucket:bindings.ATHLETE_DATA,key:bindings.TOKEN_ENCRYPTION_KEY}}
export type Connection={owner:string;revision:string;token_ciphertext:string;snapshot_key:string;updated_at:string};
export async function connection(owner:string){return storage().db.prepare('SELECT * FROM athlete_connections WHERE owner = ?').bind(owner).first<Connection>()}
export const privateJson=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','Vary':'Cookie','Pragma':'no-cache'}});
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !!origin&&(origin===new URL(request.url).origin||origin==='https://apex-athlete-performance.dalilooksk.chatgpt.site')}
export async function ownerPrefix(owner:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner));return 'athletes/'+Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('')+'/'}
export async function removeObjects(prefix:string){const {bucket}=storage();let cursor:string|undefined;do{const page=await bucket.list({prefix,cursor,limit:500});if(page.objects.length)await bucket.delete(page.objects.map(o=>o.key));cursor=page.truncated?page.cursor:undefined}while(cursor)}
