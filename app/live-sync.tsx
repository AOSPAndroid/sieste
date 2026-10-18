'use client';
import {createContext,useContext,useState,type CSSProperties,type ReactNode} from 'react';
import {cn} from '@/lib/utils';

// `syncing` is true while a background refresh runs. Only values that can still
// change today (steps, calories, recovery, today's sessions) show it; settled
// readings such as last night's sleep stay still. `epoch` changes when a sync
// delivers a new dashboard, so arrival highlights ignore date-range navigation.
export const LiveSyncContext=createContext({syncing:false,epoch:''});
export const useLiveSync=()=>useContext(LiveSyncContext).syncing;

// Counts changes to a value that arrived with a new sync; 0 until the first one.
export function useArrival(value:unknown){
 const {epoch}=useContext(LiveSyncContext);
 const [state,setState]=useState({value,epoch,count:0});
 if(Object.is(state.value,value)&&state.epoch===epoch)return state.count;
 const count=!Object.is(state.value,value)&&state.epoch!==epoch&&state.epoch!==''?state.count+1:state.count;
 setState({value,epoch,count});
 return count;
}

// Ids delivered by a sync after first paint, e.g. a new workout. Ids that only
// come into view because the visible date range moved are not marked.
export function useArrivals(ids:string[]){
 const {epoch}=useContext(LiveSyncContext);
 const key=ids.join('|');
 const [state,setState]=useState(()=>({key,epoch,known:new Set(ids),fresh:new Set<string>()}));
 if(state.key===key&&state.epoch===epoch)return state.fresh;
 const synced=state.epoch!==epoch&&state.epoch!=='';
 const fresh=synced?new Set(ids.filter(id=>!state.known.has(id))):state.key===key?state.fresh:new Set<string>();
 setState({key,epoch,known:new Set([...state.known,...ids]),fresh});
 return fresh;
}

// A number that plays a short highlight when a sync changes it.
export function LiveValue({value,className,style,children}:{value:unknown;className?:string;style?:CSSProperties;children:ReactNode}){
 const count=useArrival(value);
 return <strong key={count} className={cn('live-value',className,count>0&&'live-arrived')} style={style}>{children}</strong>;
}
