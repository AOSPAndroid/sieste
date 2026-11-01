import {cyclingReference} from './cycling-advanced-data';
import {capacityAt} from './athlete-thresholds';
import type {EffortReference} from './effort-profile-data';

/** FTP and threshold heart rate that held on the activity date, for anchoring automatic efforts. */
export function effortReference(detail:Parameters<typeof cyclingReference>[0],family:string):EffortReference{
 const ftp=family==='cycling'?cyclingReference(detail).ftp:null;
 const lthr=capacityAt(detail?.cyclingContext?.tredictCapacity,family,detail?.date??'')?.lthr??null;
 return ftp===null&&lthr===null?null:{ftp,lthr};
}
