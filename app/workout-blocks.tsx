"use client";

import {useId,useMemo,useState} from 'react';
import {ArrowDown,ArrowLeft,ChartNoAxesColumnIncreasing,Mountain} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {finite,repDistance} from './activity-metrics';
import {effortProfile} from './effort-profile-data';
import {effortReference} from './effort-reference';
import {intervalOxygenCost} from './running-economy-data';
import {effortSensor} from './workout-insights';
import type {Workout} from './analytics';
import WorkoutBlockAnalysis,{repRate,type WorkoutBlockFamily} from './workout-block-analysis';
import {analyzeWorkoutBlock} from './workout-block-analysis-data';
import {thresholdBlockEconomy} from './workout-block-economy';
import {isUphillRep,type WorkoutBlock,type WorkoutBlockRep} from './workout-blocks-data';
import './workout-blocks.css';

type Props={
 blocks:WorkoutBlock[];
 detail:Workout&Parameters<typeof analyzeWorkoutBlock>[1]&{cyclingContext?:Parameters<typeof intervalOxygenCost>[1]};
 history:Workout[];
 token:string;
 family:WorkoutBlockFamily;
 selectedIndex:number|null;
 aligned:boolean;
 onSelect:(index:number|null)=>void;
 onViewTimeline:()=>void;
};

function elapsed(seconds:number){
 const total=Math.round(seconds);
 const hours=Math.floor(total/3600);
 const minutes=Math.floor(total/60)%60;
 const remaining=String(total%60).padStart(2,'0');
 return hours?`${hours}:${String(minutes).padStart(2,'0')}:${remaining}`:`${minutes}:${remaining}`;
}

function repMeasures(rep:WorkoutBlockRep,family:WorkoutBlockFamily){
 const rate=repRate(rep.pace,family);
 return [
  rep.distance!==null&&rep.distance>0?repDistance(rep.distance,family):null,
  elapsed(rep.duration),
  rate?rate.value+' '+rate.unit:null,
 ];
}

function climbLabel(rep:WorkoutBlockRep){
 return rep.ascent!==null&&rep.ascent>0?(rep.ascentSource==='estimated'?'~':'+')+Math.round(rep.ascent)+' m':null;
}

export default function WorkoutBlocks({blocks,detail,history,token,family,selectedIndex,aligned,onSelect,onViewTimeline}:Props){
 const id=useId();
 const analysisId=id+'-analysis';
 const [analysisOpen,setAnalysisOpen]=useState(false);
 const reps=useMemo(()=>blocks.flatMap(block=>block.reps).sort((a,b)=>a.index-b.index),[blocks]);
 const {analysis,phaseLaps}=useMemo(()=>{
  if(!analysisOpen)return {analysis:[],phaseLaps:[]};
  const sensor=effortSensor({seriesSampled:detail.seriesSampled},family);
  const profile=effortProfile(detail,sensor,family,effortReference(detail,family));
  const alignedLaps=profile.laps;
  const analysis=blocks.map(block=>{
   const core=analyzeWorkoutBlock(block,detail,alignedLaps,family);
   return {...core,threshold:family==='running'?thresholdBlockEconomy(block,detail,core.reps,alignedLaps):null};
  });
  const phaseLaps='timerApproximate' in profile&&profile.timerApproximate?[]:alignedLaps;
  const distanceAligned='distanceAligned' in profile&&profile.distanceAligned;
  return {analysis,phaseLaps:distanceAligned?phaseLaps.map(lap=>({...lap,distanceAligned})):phaseLaps};
 },[analysisOpen,blocks,detail,family]);
 const oxygen=useMemo(()=>family==='running'&&analysis.length
  ?intervalOxygenCost(analysis.flatMap(set=>set.reps),detail.cyclingContext,history,detail.date)
  :undefined,[analysis,detail.cyclingContext,detail.date,family,history]);
 if(!reps.length)return null;
 const selectedPosition=reps.findIndex(rep=>rep.index===selectedIndex);
 const selected=reps[selectedPosition];
 const source=blocks.every(block=>block.source==='detected')?'Detected from telemetry':'Recorded laps';
 const powerBars=family==='cycling'&&reps.filter(rep=>finite(rep.power)).length>=2;
 const bars=reps.map(rep=>powerBars?rep.power:rep.pace===null?null:3600/rep.pace);
 const readings=bars.filter(finite);
 const high=readings.length>=2?Math.max(0,...readings):0;
 const showClimb=family!=='swimming'&&reps.some(isUphillRep);
 const climbing=showClimb&&reps.every(rep=>rep.ascent!==null)
  ?(reps.some(rep=>rep.ascentSource==='estimated')?'~':'')+Math.round(reps.reduce((sum,rep)=>sum+(rep.ascent??0),0))+' m climbing'
  :null;
 return <Card size="sm" className="workout-blocks" role="region" aria-labelledby={id}>
  <CardHeader className="workout-blocks-header">
   <CardTitle>
    <h3 id={id}>Workout reps</h3>
    <span className="workout-block-legend">{[
     reps.length+' reps',climbing,source,
    ].filter(Boolean).join(' · ')}</span>
   </CardTitle>
   <Button type="button" variant="secondary" size="sm" className="workout-block-analysis-toggle"
    aria-expanded={analysisOpen} aria-controls={analysisId} onClick={()=>setAnalysisOpen(open=>!open)}>
    {analysisOpen?<ArrowLeft data-icon="inline-start" aria-hidden="true"/>:<ChartNoAxesColumnIncreasing data-icon="inline-start" aria-hidden="true"/>}
    {analysisOpen?'Overview':'Rep analysis'}
   </Button>
  </CardHeader>
  {!analysisOpen&&<CardContent className="workout-block-overview">
   <ol className="workout-reps" aria-label={'Reps in workout order'+(high>0?powerBars?', power bars':', speed bars':'')}>
    {reps.map((rep,index)=>{
     const active=selectedIndex===rep.index;
     const uphill=showClimb&&isUphillRep(rep);
     const climb=uphill?climbLabel(rep):null;
     const label=['Rep '+(index+1),...repMeasures(rep,family),climb&&climb+' climbing',
      powerBars&&rep.power!==null?Math.round(rep.power)+' watts':null].filter(Boolean).join(', ');
     const bar=bars[index];
     const rate=repRate(rep.pace,family);
     const output=powerBars?(rep.power===null?null:`${Math.round(rep.power)} W`):rate&&`${rate.value} ${rate.unit}`;
     const time=elapsed(rep.duration);
     return <li key={rep.index}>
      <Button type="button" variant={active?'secondary':'ghost'} size="sm" className="workout-rep"
       aria-label={label} aria-pressed={active} title={label} onClick={()=>onSelect(active?null:rep.index)}>
       {high>0&&<span className="workout-rep-bar" aria-hidden="true">
        {bar!==null&&<i style={{height:(bar/high*100)+'%'}}/>}
       </span>}
       <span className="workout-rep-number">{uphill&&<Mountain size={11} aria-hidden="true"/>}{index+1}</span>
       <strong>{output??time}</strong>
       {output&&<small className="workout-rep-time">{time}</small>}
      </Button>
     </li>;
    })}
   </ol>
  </CardContent>}
  {!analysisOpen&&selected&&<CardContent className="workout-block-selection">
   <div aria-live="polite">
    <p><strong className="workout-block-lap-label">Rep {selectedPosition+1}</strong> {[
     ...repMeasures(selected,family),
     family!=='swimming'&&climbLabel(selected)?climbLabel(selected)+' climbing':null,
     selected.heartrate!==null?Math.round(selected.heartrate)+' bpm':null,
     selected.power!==null?Math.round(selected.power)+' W':null,
    ].filter(Boolean).join(' · ')}
    </p>
    {!aligned&&<small>Timeline highlight unavailable for this rep</small>}
   </div>
   {aligned?<Button type="button" variant="outline" size="sm" className="workout-block-timeline-link" onClick={onViewTimeline}>
    <ArrowDown data-icon="inline-start" aria-hidden="true"/> View timeline
   </Button>:null}
  </CardContent>}
  <CardContent id={analysisId} hidden={!analysisOpen} className="workout-block-analysis-slot">
   {analysisOpen&&<WorkoutBlockAnalysis blocks={blocks} analysis={analysis} oxygen={oxygen} family={family} workout={detail} history={history} token={token}
    series={detail.seriesSampled} alignedLaps={phaseLaps} selectedIndex={selectedIndex}
    onSelect={onSelect} aligned={aligned} onViewTimeline={onViewTimeline}/>}
  </CardContent>
 </Card>;
}
