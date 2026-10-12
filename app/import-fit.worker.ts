import {Decoder,Stream} from '@garmin/fitsdk';
import {importedFitMessages,maxImportBytes} from './import-fit';

self.onmessage=async({data}:MessageEvent<{bytes:ArrayBuffer;name:string}>)=>{
 try{
  const bytes=new Uint8Array(data.bytes);
  if(bytes.length<14||bytes.length>maxImportBytes)throw Error('Choose a FIT file up to 16 MB.');
  const decoder=new Decoder(Stream.fromByteArray(bytes));
  if(!decoder.isFIT()||!decoder.checkIntegrity())throw Error('This FIT file is damaged or incomplete. Export it again.');
  const {messages,errors}=decoder.read();
  if(errors.length)throw Error('This FIT file could not be read completely. Export it again.');
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  const id='import_'+Array.from(hash.slice(0,16),n=>n.toString(16).padStart(2,'0')).join('');
  self.postMessage({activity:importedFitMessages(messages,data.name,id)});
 }catch(error){self.postMessage({error:error instanceof Error?error.message:'This FIT file could not be read.'})}
};
