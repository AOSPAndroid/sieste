"use client";
import WeeklyVolume from './weekly-volume';
import FatigueRecovery from './fatigue-recovery';
import type {AthleteData} from './analytics';

export default function HomeAnalysisWidgets({data,now}:{data:AthleteData;now:Date;isDemo?:boolean}){
 return <><WeeklyVolume data={data} now={now}/><FatigueRecovery data={data} now={now}/></>;
}
