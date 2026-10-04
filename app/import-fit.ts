import {Decoder,Stream} from '@garmin/fitsdk';
import {decodedFit} from './api/coros/fit';
import {sportFamily,sportName} from './sports';
import {lapElevation} from './lap-elevation';

export const maxImportBytes=16*1024*1024;
export function importedFitMessages(messages:any,name:string,id:string){
 const sessions=messages.sessionMesgs??[];
 if(sessions.length!==1)throw Error(sessions.length?'This file contains multiple sessions. Export a single activity.':'This FIT file has no activity session.');
 const kind=messages.fileIdMesgs?.[0]?.type;
 if(kind!==undefined&&kind!=='activity'&&kind!==4)throw Error('Choose an activity FIT file, rather than a course or workout plan.');
 const session=sessions[0],start=new Date(session.startTime).getTime(),end=new Date(session.timestamp).getTime();
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>48*3600000)throw Error('The FIT activity needs valid timestamps and a duration under 48 hours.');
 const activity={id,date:new Date(start).toISOString(),sportType:typeof session.sport==='string'?session.sport:'misc',subSportType:typeof session.subSport==='string'?session.subSport:undefined,summary:{}};
 const title=name.replace(/\.fit$/i,'').trim().slice(0,80)||sportName(sportFamily(activity));
 const detail=decodedFit(messages,{...activity,title});
 delete detail.coros;delete detail.nativeVersion;
 const timestamps=(messages.recordMesgs??[]).map((r:any)=>new Date(r.timestamp).getTime()).filter(Number.isFinite).sort((a:number,b:number)=>a-b);
 const sparse=timestamps.some((time:number,i:number)=>i>0&&time-timestamps[i-1]>1500);
 return {...detail,provider:'import',imported:true,analyzed:true,recordedSource:'Imported FIT',analysisSource:'Imported FIT',elevationPreview:lapElevation(detail),...(sparse?{notes:'This file has gaps between recorded samples. Charts preserve them; some climb or sensor analyses may be unavailable.'}:{})};
}
export async function importFitFile(file:File){
 if(!/\.fit$/i.test(file.name))throw Error(/\.zip$/i.test(file.name)?'Unzip the Garmin export first, then choose the .fit file inside.':'Choose a .fit activity file exported from Garmin or another watch.');
 if(file.size<14||file.size>maxImportBytes)throw Error('Choose a FIT file up to 16 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),decoder=new Decoder(Stream.fromByteArray(bytes));
 if(!decoder.isFIT()||!decoder.checkIntegrity())throw Error('This FIT file is damaged or incomplete. Export it again.');
 const {messages,errors}=decoder.read();
 if(errors.length)throw Error('This FIT file could not be read completely. Export it again.');
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return importedFitMessages(messages,file.name,'import_'+Array.from(hash.slice(0,16),n=>n.toString(16).padStart(2,'0')).join(''));
}
