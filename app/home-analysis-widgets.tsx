"use client";
import WeeklyVolume from './weekly-volume';
import FatigueRecovery from './fatigue-recovery';
import Vo2Tracker from './vo2-tracker';
import type {AthleteData} from './analytics';

export default function HomeAnalysisWidgets({data,now,isDemo=false}:{data:AthleteData;now:Date;isDemo?:boolean}){
 return <><WeeklyVolume data={data} now={now}/><FatigueRecovery data={data} now={now}/><Vo2Tracker data={data} isDemo={isDemo} compact/></>;
}
