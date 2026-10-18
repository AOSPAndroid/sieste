'use client';
import {createContext,useContext,useState,type CSSProperties,type ReactNode} from 'react';
import {cn} from '@/lib/utils';

// True while a background refresh is running. Only values that can still change
// today (steps, calories, recovery, today's sessions) show it; settled readings
// such as last night's sleep stay still.
export const LiveSyncContext=createContext(false);
export const useLiveSync=()=>useContext(LiveSyncContext);

// Counts changes to a value after first paint; 0 until the first change.
export function useArrival(value:unknown){
 const [state,setState]=useState({value,count:0});
 if(!Object.is(state.value,value))setState({value,count:state.count+1});
 return Object.is(state.value,value)?state.count:state.count+1;
}

// Ids that appeared after first paint, e.g. a workout delivered by a sync.
export function useArrivals(ids:string[]){
 const key=ids.join('|');
 const [state,setState]=useState(()=>({key,known:new Set(ids),fresh:new Set<string>()}));
 if(state.key!==key){
  const fresh=new Set(ids.filter(id=>!state.known.has(id)));
  setState({key,known:new Set([...state.known,...ids]),fresh});
  return fresh;
 }
 return state.fresh;
}

// A number that plays a short highlight when a refresh changes it.
export function LiveValue({value,className,style,children}:{value:unknown;className?:string;style?:CSSProperties;children:ReactNode}){
 const count=useArrival(value);
 return <strong key={count} className={cn('live-value',className,count>0&&'live-arrived')} style={style}>{children}</strong>;
}
