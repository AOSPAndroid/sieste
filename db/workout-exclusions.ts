import {storage,ownerPrefix} from './storage';
import {applyWorkoutExclusions,type WorkoutExclusion} from '../app/workout-exclusions';
export async function workoutExclusions(owner:string){const prefix=await ownerPrefix(owner)+'excluded/',result:WorkoutExclusion[]=[];let cursor:string|undefined;do{const page=await storage().bucket.list({prefix,cursor,limit:500,include:['customMetadata']} as R2ListOptions & {include:string[]});for(const obj of page.objects){const id=obj.key.slice(prefix.length).replace(/\.json$/,''),date=obj.customMetadata?.date;if(date)result.push({id,date})}cursor=page.truncated?page.cursor:undefined}while(cursor);return result}
export async function filteredSnapshot(owner:string,data:any){return data?applyWorkoutExclusions(data,await workoutExclusions(owner)):null}
