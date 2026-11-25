import {detectedWorkoutBlocks} from './detected-workout-blocks';
import {effortProfile} from './effort-profile-data';
import {effortReference} from './effort-reference';
import {workoutBlocks, type WorkoutBlock} from './workout-blocks-data';
import {withRepElevation} from './workout-blocks-terrain';
import {effortSensor} from './workout-insights';

export function locateWorkoutBlocks(detail: Record<string, any>, family: string, recorded?: WorkoutBlock[]) {
 if(detail.mergedIds)return [];
 const laps=recorded??(Array.isArray(detail.laps)?workoutBlocks(detail.laps,family):[]);
 const series=detail.seriesSampled;
 const sensor=effortSensor(detail,family);
 const profile=()=>effortProfile(detail,sensor,family,effortReference(detail,family));
 const found=laps.length||!series?.data||sensor==='heartrate'
  ?laps:detectedWorkoutBlocks(profile(),series.sampleSize,series.data);
 if(!found.length||family==='swimming')return found;
 const needsElevation=found.some(block=>block.reps.some(rep=>rep.ascent===null||rep.descent===null));
 const aligned=laps.length&&needsElevation&&Array.isArray(series?.data?.altitude)?profile().laps:[];
 return withRepElevation(found,series,aligned);
}
