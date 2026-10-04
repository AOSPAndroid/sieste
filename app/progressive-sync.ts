// Publish workouts before waiting for health. A failed second phase leaves them visible.
class SyncPhaseError extends Error{constructor(message:string,public canSyncHealth=false){super(message)}}
export async function progressiveSync(body:any,onData:(data:any)=>void,onPhase:(phase:string)=>void,request:typeof fetch=fetch){
 async function phase(name:string,workoutsFailed=false){onPhase(name==='workouts'?'Syncing workouts…':workoutsFailed?'Refreshing health · saved workouts retained…':'Workouts updated · refreshing health…');const start=performance.now();
  try{const response=await request('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,phase:name}),signal:AbortSignal.timeout(90000)});const data:any=await response.json();if(!response.ok)throw new SyncPhaseError(data.error||'Sync could not finish. Saved data remains.',data.canSyncHealth===true);if(!Array.isArray(data.activities)||!data.sleep||!data.hrv)throw new Error('The provider returned incomplete data.');onData(data);return data;}
  finally{performance.measure('sieste-sync-'+name,{start,end:performance.now()});}
 }
 let data;
 try{data=await phase('workouts')}catch(error){
  // Only the authenticated server can confirm a separate saved health connection.
  if(!(error instanceof SyncPhaseError)||!error.canSyncHealth)throw error;
  try{await phase('health',true)}catch(healthError){throw Error(`Workouts: ${error.message} Health: ${healthError instanceof Error?healthError.message:'Sync could not finish.'}`)}
  throw Error(`Health sync completed separately. ${error.message}`);
 }
 if(data.provider==='tredict')await phase('health');return data;
}
