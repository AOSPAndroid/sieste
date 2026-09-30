"use client";
import {useEffect,useState} from 'react';
import {Copy,Download,Share2} from 'lucide-react';
import type {AthleteData} from './analytics';
import {weekOverview,localDate} from './week-overview';
import {sportFamily,sportName,runningPace,workoutSpeed} from './sports';

const valid=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const duration=(n:number)=>`${Math.floor(Math.round(n)/60)}h${String(Math.round(n)%60).padStart(2,'0')}`;
export default function HomeSnapshot({data,dates,now}:{data:AthleteData;dates:Date[];now:Date}){
 const [asset,setAsset]=useState<{url:string;blob:Blob}|null>(null),[message,setMessage]=useState('Preparing image…');
 const end=dates.at(-1)!,filename=`sieste-${localDate(end)}-${dates.length}days.png`;
 useEffect(()=>{let active=true,url='';
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx){setMessage('Image creation is unavailable in this browser.');return}
  const groups=dates.map(day=>({day,items:data.activities.filter(a=>localDate(new Date(a.date))===localDate(day)&&new Date(a.date)<=now).sort((a,b)=>a.date.localeCompare(b.date))}));
  const columns=Math.min(3,dates.length),width=720,col=656/columns;
  const rows=Array.from({length:Math.ceil(groups.length/columns)},(_,i)=>groups.slice(i*columns,(i+1)*columns));
  const heights=rows.map(row=>48+Math.max(1,...row.map(g=>g.items.length))*132);
  const height=420+heights.reduce((a,b)=>a+b,0);
  canvas.width=width*2;canvas.height=height*2;ctx.scale(2,2);ctx.fillStyle='#f7f7fb';ctx.fillRect(0,0,width,height);
  const text=(s:string,x:number,y:number,size=16,color='#232333',bold=false,max=650)=>{ctx.font=`${bold?650:400} ${size}px system-ui, sans-serif`;ctx.fillStyle=color;ctx.fillText(s,x,y,max)};
  const box=(x:number,y:number,w:number,h:number)=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(x,y,w,h,16);ctx.fill()};
  text('sieste',32,49,30,'#232333',true);text(end.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}),370,47,17,'#707080');
  box(20,70,680,292);text('Daily health',34,101,18,'#232333',true);text('7-day trends',550,101,14,'#707080');
  const days=weekOverview(data,end,sportFamily).rows,coros=data.extra?.coros;
  const metrics=[['sleep','Sleep','', '#8773dc'],['hrv','HRV',' ms','#369f83'],['rhr','Resting HR',' bpm','#d96688'],['score','Sleep score',' /100','#8773dc'],['steps','Steps','','#5089d6'],['calories','Calories',' kcal','#d8974b']];
  metrics.forEach(([key,label,unit,color],i)=>{const x=36+i%3*224,y=130+Math.floor(i/3)*112;
   const values=days.map(d=>{const stamp=d.iso.replaceAll('-',''),v=key==='score'?coros?.sleepWindows?.[stamp]?.score:key==='steps'||key==='calories'?coros?.daily?.[stamp]?.[key]:d[key as 'sleep'|'hrv'|'rhr'];return valid(v)?v:null});
   const v=values.at(-1)??null;text(label,x,y,14,'#707080');text(v===null?'—':(key==='sleep'?duration(v*60):Math.round(v).toLocaleString('en-GB'))+unit,x,y+32,27,'#232333',true,205);
   const nums=values.filter(valid),lo=Math.min(...nums),hi=Math.max(...nums);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();let previous=false;
   values.forEach((v,j)=>{if(v===null){previous=false;return}const px=x+j*31,py=y+64-(hi===lo?8:(v-lo)/(hi-lo)*18);if(previous)ctx.lineTo(px,py);else ctx.moveTo(px,py);previous=true});ctx.stroke();
   values.forEach((v,j)=>{if(v===null)return;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+j*31,y+64-(hi===lo?8:(v-lo)/(hi-lo)*18),2.5,0,Math.PI*2);ctx.fill()});
  });
  text(`Training · ${dates.length} days`,32,392,18,'#232333',true);let top=410;
  rows.forEach((row,ri)=>{row.forEach((g,ci)=>{const x=32+ci*col;box(x-4,top,col-8,heights[ri]-12);text(g.day.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),x+8,top+25,15,'#6151bf',true);
   if(!g.items.length)text('No sessions synced',x+8,top+62,13,'#90909b',false,col-25);
   g.items.forEach((a,j)=>{const y=top+52+j*132,s=a.summary??{},family=sportFamily(a),speed=workoutSpeed(a),pace=s.pace>0?s.pace:s.distance>0&&s.duration>0?s.duration/s.distance*1000:null;
    text(a.title||sportName(family),x+8,y,16,'#6151bf',true,col-25);text(new Date(a.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x+8,y+20,12,'#90909b');
    const lines=[valid(s.duration)?duration(s.duration/60):'—',valid(s.distance)?`${(s.distance/1000).toFixed(2)} km`:'',family==='cycling'?(speed!==null?speed.toFixed(1)+' km/h':''):family==='running'?runningPace(pace):'',valid(s.heartrate)?Math.round(s.heartrate)+' bpm':'',valid(s.calories)?Math.round(s.calories)+' kcal':''].filter(Boolean);
    text(lines.slice(0,2).join(' · '),x+8,y+47,16,'#232333',true,col-25);text(lines.slice(2).join(' · '),x+8,y+72,13,'#555565',false,col-25);
   });
  });top+=heights[ri]});
  text('Recorded data · daily totals may be partial',32,height-10,11,'#90909b');
  canvas.toBlob(blob=>{if(!active||!blob){if(active)setMessage('Could not create the image.');return}url=URL.createObjectURL(blob);setAsset({blob,url});setMessage('Ready to copy, save or share.');},'image/png');
  return()=>{active=false;if(url)URL.revokeObjectURL(url)};
 },[data,dates,now]);
 const save=()=>{if(!asset)return;const a=document.createElement('a');a.href=asset.url;a.download=filename;a.click();setMessage('PNG download started. You can also press and hold the preview to save it.');};
 const copy=async()=>{if(!asset)return;try{await navigator.clipboard.write([new ClipboardItem({'image/png':asset.blob})]);setMessage('Image copied.');}catch{setMessage('Copy is unavailable here. Use Save PNG or Share instead.');}};
 const share=async()=>{if(!asset)return;const file=new File([asset.blob],filename,{type:'image/png'});try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file]});}else save();}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setMessage('Sharing failed. Try Save PNG instead.');}};
 return <div className="home-snapshot"><div className="home-snapshot-actions"><button disabled={!asset} onClick={copy}><Copy size={15}/>Copy image</button><button disabled={!asset} onClick={save}><Download size={15}/>Save PNG</button><button disabled={!asset} onClick={share}><Share2 size={15}/>Share</button></div><p role="status">{message}</p>{asset&&<img src={asset.url} alt="Daily health and all workouts in the selected period"/>}<small>Health is from {end.toLocaleDateString('en-GB')}. All workouts in your selected period are included. Longer weeks create a taller image.</small></div>;
}

