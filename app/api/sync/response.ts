const gzipThreshold=4096;

function encodingQualities(header:string|null){
 const qualities=new Map<string,number>();
 for(const item of header?.split(',')??[]){
  const [token,...parameters]=item.trim().toLowerCase().split(';'),name=token.trim();
  if(!name)continue;
  const quality=parameters.map(value=>value.trim()).find(value=>value.startsWith('q='));
  const value=quality?.slice(2).trim();
  const q=value===undefined?1:/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value)?Number(value):0;
  qualities.set(name,Math.min(qualities.get(name)??1,q));
 }
 return qualities;
}

/** A private dashboard has the same semantic revision in gzip and identity form. */
export function matchesDashboardEtag(header:string|null,etag:string){
 const revision=etag.replace(/^W\//,'');
 return header?.split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===revision)??false;
}

export function dashboardHeaders(supplied?:HeadersInit){
 const headers=new Headers(supplied);
 if(!headers.has('Cache-Control'))headers.set('Cache-Control','no-store, private');
 if(!headers.has('Pragma'))headers.set('Pragma','no-cache');
 const vary=headers.get('Vary')?.split(',').map(value=>value.trim()).filter(Boolean)??[];
 for(const name of ['Cookie','Accept-Encoding'])if(!vary.some(value=>value.toLowerCase()===name.toLowerCase()))vary.push(name);
 headers.set('Vary',vary.join(', '));
 return headers;
}

/** Serialize once; Workers encodes the UTF-8 body from Content-Encoding at the HTTP boundary. */
export function dashboardJson(data:unknown,request:Request,supplied?:HeadersInit){
 const headers=dashboardHeaders(supplied),json=JSON.stringify(data);
 if(json===undefined)throw new TypeError('Dashboard JSON must be serializable.');
 const bytes=new TextEncoder().encode(json);
 const qualities=encodingQualities(request.headers.get('Accept-Encoding'));
 const gzip=qualities.get('gzip')??qualities.get('*')??0,identity=qualities.get('identity')??(qualities.get('*')===0?0:undefined);
 headers.set('Content-Type','application/json; charset=utf-8');
 headers.delete('Content-Length');
 headers.delete('Content-Encoding');
 if(gzip>0&&(identity===undefined||gzip>=identity)&&(bytes.byteLength>=gzipThreshold||identity===0)){
  headers.set('Content-Encoding','gzip');
 }
 // Keep the body unencoded: Cloudflare's automatic encoding survives framework
 // response wrappers. Pre-compressing here would gzip it twice on delivery.
 return new Response(bytes,{headers});
}
