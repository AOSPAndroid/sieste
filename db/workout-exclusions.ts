import {storage,ownerPrefix} from './storage';
import {applyWorkoutExclusions,type WorkoutExclusion} from '../app/workout-exclusions';
const migrations=new Map<string,Promise<void>>();
async function migrate(owner:string){
 const {db,bucket}=storage();
 if(await db.prepare('SELECT owner FROM workout_exclusion_migrations WHERE owner=?').bind(owner).first())return;
 const prefix=(await ownerPrefix(owner))+'excluded/',rows:WorkoutExclusion[]=[];let cursor:string|undefined;
 do{const page=await bucket.list({prefix,cursor,limit:500,include:['customMetadata']} as R2ListOptions & {include:string[]});for(const object of page.objects){let date=object.customMetadata?.date;const id=object.key.slice(prefix.length).replace(/\.json$/,'');if(!date){const saved=await bucket.get(object.key);const data:any=saved?await saved.json():null;date=data?.date;}if(date)rows.push({id,date});}cursor=page.truncated?page.cursor:undefined;}while(cursor);
 const writes=rows.map(row=>db.prepare('INSERT INTO workout_exclusions(owner,activity_id,date) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM workout_exclusion_migrations WHERE owner=?) ON CONFLICT DO NOTHING').bind(owner,row.id,row.date,owner));
 // Each import checks the marker, so a concurrent migration cannot reinsert a
 // workout restored after another migration completes.
 for(let i=0;i<writes.length;i+=80)await db.batch(writes.slice(i,i+80));
 await db.prepare('INSERT INTO workout_exclusion_migrations(owner) VALUES(?) ON CONFLICT DO NOTHING').bind(owner).run();
}
async function ready(owner:string){const existing=migrations.get(owner);if(existing)return existing;const task=migrate(owner).finally(()=>migrations.delete(owner));migrations.set(owner,task);return task;}
export async function workoutExclusions(owner:string){await ready(owner);const rows=await storage().db.prepare('SELECT activity_id AS id,date FROM workout_exclusions WHERE owner=?').bind(owner).all<WorkoutExclusion>();return rows.results;}
export async function setWorkoutExclusions(owner:string,rows:WorkoutExclusion[],removed:boolean){await ready(owner);const {db}=storage();if(rows.length)await db.batch(rows.map(row=>removed?db.prepare('INSERT INTO workout_exclusions(owner,activity_id,date) VALUES(?,?,?) ON CONFLICT(owner,activity_id) DO UPDATE SET date=excluded.date').bind(owner,row.id,row.date):db.prepare('DELETE FROM workout_exclusions WHERE owner=? AND activity_id=?').bind(owner,row.id)));}
export async function filteredSnapshot(owner:string,data:any){return data?applyWorkoutExclusions(data,await workoutExclusions(owner)):null}
