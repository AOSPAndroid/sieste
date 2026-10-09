"use client";
import {lazy,Suspense,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Share2} from 'lucide-react';
import ShareLoading from './share-loading';
import type {AthleteData} from './analytics';
const TodayShare=lazy(()=>import('./today-share'));
export default function HomeShare({data,now,token,isDemo}:{data:AthleteData;now:Date;token:string;isDemo:boolean}){
 const [shareNow,setShareNow]=useState<Date|null>(null);
 const close=()=>setShareNow(null);
 return <><Button variant="default" size="sm" className="home-share-button" onClick={()=>setShareNow(isDemo?now:new Date())}><Share2 data-icon="inline-start"/><span>Share today</span></Button>{shareNow&&<Suspense fallback={<ShareLoading onClose={close}/>}><TodayShare data={data} now={shareNow} token={token} isDemo={isDemo} onClose={close}/></Suspense>}</>;
}
