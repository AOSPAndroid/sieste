import fitWorkerUrl from './import-fit.worker.ts?worker&url';
export async function decodeImportedFit(bytes:ArrayBuffer,name:string){
 const worker=new Worker(fitWorkerUrl,{type:'module'});
 return new Promise<any>((resolve,reject)=>{
  const finish=()=>{clearTimeout(timer);worker.terminate()};
  const timer=setTimeout(()=>{finish();reject(Error('FIT import took too long. Please try a smaller file.'))},60000);
  worker.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(data.activity)};
  worker.onerror=()=>{finish();reject(Error('This FIT file could not be read. Export it again.'))};
  worker.postMessage({bytes,name},[bytes]);
 });
}
