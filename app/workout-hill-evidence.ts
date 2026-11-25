import {effortProfile} from './effort-profile-data';
import {effortReference} from './effort-reference';
import {HILL_REP_VERSION} from './route-version';
import {sportFamily} from './sports';
import {analyzeWorkoutBlock} from './workout-block-analysis-data';
import {isUphillRep} from './workout-blocks-data';
import {locateWorkoutBlocks} from './workout-blocks-location';
import {hillRepSignature,type HillRepSignature} from './workout-hill-history-data';
import {effortSensor} from './workout-insights';

export function needsHillRepEvidence(detail:any):boolean {
 return Boolean(detail?.seriesSampled?.data&&sportFamily(detail)==='running'&&detail.evidence?.hillRepVersion!==HILL_REP_VERSION);
}

/** Reuse the same rep boundaries as the activity analysis, and keep the stored trail small. */
export function hillRepEvidenceFields(detail:any):{hillRepVersion:number;hillReps:HillRepSignature[]}|undefined {
 if(!needsHillRepEvidence(detail))return;
 const series=detail.seriesSampled;
 const {positionLat,positionLong}=series.data;
 const hillReps:HillRepSignature[]=[];
 if(Array.isArray(positionLat)&&Array.isArray(positionLong)&&positionLat.length>=4&&positionLong.length>=4){
  const blocks=locateWorkoutBlocks(detail,'running').filter(block=>block.reps.some(isUphillRep));
  if(blocks.length){
   const profile=effortProfile(detail,effortSensor(detail,'running'),'running',effortReference(detail,'running'));
   const timedLaps='timerApproximate' in profile&&profile.timerApproximate?[]:profile.laps;
   const distanceAligned='distanceAligned' in profile&&profile.distanceAligned;
   const bounds=new Map(timedLaps.map(lap=>[lap.index,{...lap,distanceAligned}]));
   for(const block of blocks){
    for(const rep of analyzeWorkoutBlock(block,detail,timedLaps).reps){
     if(hillReps.length>=64)break;
     const signature=hillRepSignature(rep,bounds.get(rep.index),series);
     if(signature)hillReps.push(signature);
    }
    if(hillReps.length>=64)break;
   }
  }
 }
 return {hillRepVersion:HILL_REP_VERSION,hillReps};
}

export function withHillRepEvidence<T extends Record<string,any>>(detail:T):T {
 const fields=hillRepEvidenceFields(detail);
 return fields?{...detail,evidence:{...detail.evidence,...fields}}:detail;
}
