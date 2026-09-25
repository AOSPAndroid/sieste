const encoder=new TextEncoder();
function bytes(value:string){return Uint8Array.from(atob(value),c=>c.charCodeAt(0))}
function base64(value:Uint8Array){return btoa(Array.from(value,b=>String.fromCharCode(b)).join(''))}
async function key(secret:string){const raw=bytes(secret);if(raw.length!==32)throw new Error('Invalid encryption configuration');return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt'])}
export async function seal(token:string,secret:string,owner:string){const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(owner)},await key(secret),encoder.encode(token));return `v1.${base64(iv)}.${base64(new Uint8Array(ciphertext))}`}
export async function unseal(value:string,secret:string,owner:string){const [version,iv,data]=value.split('.');if(version!=='v1'||!iv||!data)throw new Error('Invalid encrypted value');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:encoder.encode(owner)},await key(secret),bytes(data)))}
