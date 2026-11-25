"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import type {Workout} from './analytics';
import {HILL_REP_VERSION} from './route-version';
import {sportFamily} from './sports';
import type {WorkoutRepAnalysis} from './workout-block-analysis-data';
import {isUphillRep} from './workout-blocks-data';
import WorkoutHillHistory from './workout-hill-history';
import {hillRepSignature,hillRepHistory,hillRouteMayContain,sameHillRep,type HillRepSignature} from './workout-hill-history-data';

type WorkoutMeta=Pick<Workout,'id'|'date'|'sportType'|'subSportType'>;
type Props={
 workout:WorkoutMeta;
 reps:readonly WorkoutRepAnalysis[];
 history:readonly Workout[];
 selectedIndex:number|null;
 alignedLaps:readonly {index:number;start:number;end:number;distanceAligned?:boolean}[];
 series:Parameters<typeof hillRepSignature>[2];
 token:string;
};
type SearchResult={id?:string;evidence?:Workout['evidence']};

export default function WorkoutSameHill({workout,reps,history,selectedIndex,alignedLaps,series,token}:Props){
 const [open,setOpen]=useState(false);
 const [checked,setChecked]=useState<Map<string,HillRepSignature[]>>(new Map());
 const [searching,setSearching]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const activeSearch=useRef<AbortController|null>(null);
 useEffect(()=>()=>activeSearch.current?.abort(),[]);

 const hills=useMemo(()=>reps.filter(isUphillRep),[reps]);
 const selectedHill=hills.find(rep=>rep.index===selectedIndex);
 const current=useMemo(()=>{
  if(!open)return null;
  const bounds=new Map(alignedLaps.map(lap=>[lap.index,lap]));
  if(selectedHill)return hillRepSignature(selectedHill,bounds.get(selectedHill.index),series);
  const signatures=hills.slice(0,32).map(rep=>hillRepSignature(rep,bounds.get(rep.index),series))
   .filter((rep):rep is HillRepSignature=>rep!==null);
  // Use the best-supported trace when no rep is selected, since coarse GPS can shift a lap boundary.
  let best:HillRepSignature|null=null;
  let support=-1;
  for(const rep of signatures){
   const matches=signatures.filter(other=>other!==rep&&sameHillRep(rep,other)).length;
   if(matches>support){best=rep;support=matches;}
  }
  return best;
 },[open,selectedHill,hills,alignedLaps,series]);
 const targetOrdinal=reps.findIndex(rep=>rep.index===current?.index)+1;
 const result=useMemo(()=>{
  if(!current)return null;
  const withChecked=history.map(activity=>{
   const hillReps=checked.get(activity.id);
   return hillReps&&activity.evidence?.hillRepVersion!==HILL_REP_VERSION
    ?{...activity,evidence:{...activity.evidence,hillReps}}:activity;
  });
  return hillRepHistory(current,workout,withChecked);
 },[current,workout,history,checked]);
 const candidates=useMemo(()=>{
  if(!current||!token)return [];
  return history.flatMap(activity=>{
   if(activity.id===workout.id||activity.mergedIds||checked.has(activity.id)||
    activity.evidence?.hillRepVersion===HILL_REP_VERSION||sportFamily(activity)!=='running'||
    /indoor|treadmill/i.test(activity.subSportType??''))return [];
   const route=activity.evidence?.route;
   if(route===null||(route&&!hillRouteMayContain(current,route)))return [];
   return [{activity,hasRoute:!!route}];
  }).sort((a,b)=>Number(b.hasRoute)-Number(a.hasRoute)||Date.parse(b.activity.date)-Date.parse(a.activity.date));
 },[current,token,history,workout.id,checked]);

 async function search(){
  if(activeSearch.current||!candidates.length)return;
  const controller=new AbortController();
  activeSearch.current=controller;
  setSearching(true);
  setError(null);
  const ids=candidates.slice(0,4).map(({activity})=>activity.id);
  try{
   const response=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'enrich',token,ids,hillHistory:true,background:true}),
    signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)])});
   const body: {details?:SearchResult[];error?:unknown}=await response.json();
   if(!response.ok||!Array.isArray(body.details)){
    throw Error(typeof body.error==='string'?body.error:'Could not check past workouts.');
   }
   const found=new Map(body.details.map(row=>[row.id,row.evidence]));
   if(ids.some(id=>!found.has(id)))throw Error('Some workouts could not be checked. Try again.');
   if(controller.signal.aborted)return;
   setChecked(previous=>{
    const next=new Map(previous);
    for(const id of ids){
     const evidence=found.get(id);
     next.set(id,evidence?.hillRepVersion===HILL_REP_VERSION&&Array.isArray(evidence.hillReps)?evidence.hillReps:[]);
    }
    return next;
   });
  }catch(cause){
   if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Could not check past workouts.');
  }finally{
   activeSearch.current=null;
   if(!controller.signal.aborted)setSearching(false);
  }
 }
 if(!hills.length)return null;
 return <WorkoutHillHistory current={current} history={result} date={workout.date}
  targetLabel={targetOrdinal?'Rep '+targetOrdinal:undefined} onOpenChange={setOpen} onSearch={search}
  status={searching?'loading':!open?'idle':current?'ready':'unavailable'}
  searchRemaining={candidates.length} searchError={error}/>;
}
