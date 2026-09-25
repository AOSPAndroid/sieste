// Publish workouts before waiting for health. A failed second phase leaves them visible.
export async function progressiveSync(body:any,onData:(data:any)=>void,onPhase:(phase:string)=>void,request:typeof fetch=fetch){
 async function phase(name:string){onPhase(name==='workouts'?'Syncing workouts…':'Workouts updated · refreshing health…');const start=performance.now();
  try{const response=await request('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,phase:name}),signal:AbortSignal.timeout(90000)});const data:any=await response.json();if(!response.ok)throw new Error(data.error||'Sync could not finish. Saved data remains.');if(!Array.isArray(data.activities)||!data.sleep||!data.hrv)throw new Error('The provider returned incomplete data.');onData(data);return data;}
  finally{performance.measure('sieste-sync-'+name,{start,end:performance.now()});}
 }
 const data=await phase('workouts');if(data.provider==='tredict')await phase('health');return data;
}
