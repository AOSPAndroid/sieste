"use client";
import {lazy,Suspense,useState} from 'react';
import {Share2} from 'lucide-react';
import ShareLoading from './share-loading';
import type {AthleteData} from './analytics';
const TodayShare=lazy(()=>import('./today-share'));
export default function HomeShare({data,now,token,isDemo}:{data:AthleteData;now:Date;token:string;isDemo:boolean}){
 const [shareNow,setShareNow]=useState<Date|null>(null);
 const close=()=>setShareNow(null);
 return <><button className="home-share-button" onClick={()=>setShareNow(isDemo?now:new Date())}><Share2 size={14}/><span>Share today</span></button>{shareNow&&<Suspense fallback={<ShareLoading onClose={close}/>}><TodayShare data={data} now={shareNow} token={token} isDemo={isDemo} onClose={close}/></Suspense>}</>;
}
