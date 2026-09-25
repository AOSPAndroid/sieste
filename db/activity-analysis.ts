import {corosNativeActivity,COROS_NATIVE_VERSION} from '../app/coros-native';
import {storage} from './storage';
export async function analysisIdentity(token:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('')}
export function analysisSignature(a:any){return JSON.stringify([a.date,a.sportType,a.subSportType??null,a.summary??null])}
export async function restoreAnalyses(owner:string,identity:string,data:any){
 const result=await storage().db.prepare('SELECT activity_id, signature, data FROM athlete_analyses WHERE owner = ? AND identity = ?').bind(owner,identity).all<{activity_id:string;signature:string;data:string}>();
 const labels=await storage().db.prepare('SELECT activity_id,label FROM athlete_session_labels WHERE owner = ? AND identity = ?').bind(owner,identity).all<{activity_id:string;label:string}>();
 const labelMap=new Map(labels.results.map(r=>[r.activity_id,r.label]));
 const map=new Map(result.results.map(r=>[r.activity_id,r]));
 return {...data,activities:data.activities.map((original:any)=>{const a={...original,sessionLabel:labelMap.get(original.id)??original.sessionLabel??null};const row=map.get(a.id);if(!row||row.signature!==analysisSignature(a))return a;try{const d=JSON.parse(row.data);return d.evidence?.version===1&&!(a.provider==='coros'&&(d.analysisSource!=='COROS FIT'||d.nativeVersion!==COROS_NATIVE_VERSION))?{...a,nativeVersion:d.nativeVersion,summary:a.provider==='coros'?corosNativeActivity({...d,nativeVersion:d.nativeVersion}).summary:{...a.summary,...d.summary},hrHistogram:d.hrHistogram,evidence:d.evidence,analysisSource:d.analysisSource,analyzed:true}:a}catch{return a}})};
}
export async function saveAnalysis(owner:string,identity:string,activity:any,detail:any,revision:string,provider:'tredict'|'coros'='tredict'){
 if(detail.evidence?.version!==1)return;
 const compact={nativeVersion:detail.nativeVersion,summary:detail.summary,hrHistogram:detail.hrHistogram,evidence:detail.evidence,analysisSource:detail.analysisSource};
 const table=provider==='coros'?'coros_connections':'athlete_connections';
 await storage().db.prepare(`INSERT INTO athlete_analyses (owner, identity, activity_id, signature, data) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM ${table} WHERE owner = ? AND revision = ?) ON CONFLICT(owner, identity, activity_id) DO UPDATE SET signature = excluded.signature, data = excluded.data`).bind(owner,identity,activity.id,analysisSignature(activity),JSON.stringify(compact),owner,revision).run();
}
