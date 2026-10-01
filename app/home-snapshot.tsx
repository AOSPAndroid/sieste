"use client";
import {useEffect,useState} from 'react';
import {Copy,Download,Share2} from 'lucide-react';
import type {AthleteData} from './analytics';
import {weekOverview,localDate} from './week-overview';
import {sportFamily,sportName,runningPace,workoutSpeed} from './sports';
import {useCalendarDetails} from './calendar-details';
import {lapPreview} from './calendar-preview';

// Vector strokes stay crisp in the exported PNG without emoji/font dependencies.
const icons:Record<string,string>={
 sleep:'M20 15A9 9 0 0 1 9 4 9 9 0 1 0 20 15Z',
 hrv:'M2 12H6L9 3 13 21 16 12H22',
 rhr:'M20.8 4.6A5.5 5.5 0 0 0 13 4.6L12 5.6 11 4.6A5.5 5.5 0 0 0 3.2 12.4L12 21 20.8 12.4A5.5 5.5 0 0 0 20.8 4.6Z',
 score:'M12 2 15 8.5 22 9.5 17 14.5 18 22 12 18.5 6 22 7 14.5 2 9.5 9 8.5Z',
 steps:'M8 3C4 3 4 12 7 13 11 14 12 3 8 3ZM7 16A2 2 0 1 0 7 20 2 2 0 0 0 7 16ZM17 7C13 7 13 16 16 17 20 18 21 7 17 7ZM16 20A1 1 0 1 0 16 22 1 1 0 0 0 16 20Z',
 calories:'M12 2C15 8 10 9 14 12 16 10 17 8 17 8 25 19 17 23 11 22 2 21 2 14 7 8 7 12 9 12 10 9Z',
 cycling:'M6 13A4 4 0 1 0 6 21 4 4 0 0 0 6 13ZM18 13A4 4 0 1 0 18 21 4 4 0 0 0 18 13ZM6 17 10 8 15 17H6M9 8H13M18 17 15 5H18',
 strength_training:'M6 7 17 18M3 8 8 3 11 6 6 11ZM13 18 18 13 21 16 16 21Z',
 running:'M15 2A2 2 0 1 0 15 6 2 2 0 0 0 15 2ZM4 10 9 7 13 9 16 13H21M13 9 10 15 15 18 14 22M10 15 7 20H2',
 swimming:'M2 20Q5 17 8 20T14 20T20 20M4 14 10 8 16 14M10 8 6 4H3M17 8A2 2 0 1 0 17 12 2 2 0 0 0 17 8Z',
};

const valid=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const duration=(n:number)=>`${Math.floor(Math.round(n)/60)}h${String(Math.round(n)%60).padStart(2,'0')}`;
export default function HomeSnapshot({data,dates,now,token,isDemo}:{data:AthleteData;dates:Date[];now:Date;token:string;isDemo:boolean}){
 const [asset,setAsset]=useState<{url:string;blob:Blob}|null>(null),[message,setMessage]=useState('Preparing image…');
 const end=dates.at(-1)!,filename=`sieste-${localDate(end)}-${dates.length}days.png`;
 const keys=dates.map(localDate),signature=data.activities.filter(a=>keys.includes(localDate(new Date(a.date)))&&new Date(a.date)<=now).map(a=>a.id).sort().join('|');
 const details=useCalendarDetails(signature,token,isDemo,data.syncedAt),detailJson=JSON.stringify(details);
 const pending=!isDemo&&!!token&&signature.split('|').filter(Boolean).some(id=>!details[id]);
 useEffect(()=>{let active=true,url='';
  setAsset(null);setMessage(pending?'Loading recorded laps…':'Preparing image…');if(pending)return;
  const detail=JSON.parse(detailJson);
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx){setMessage('Image creation is unavailable in this browser.');return}
  const groups=dates.map(day=>({day,items:data.activities.filter(a=>localDate(new Date(a.date))===localDate(day)&&new Date(a.date)<=now).sort((a,b)=>a.date.localeCompare(b.date))}));
  const columns=Math.min(3,dates.length),width=720,col=656/columns;
  const rows=Array.from({length:Math.ceil(groups.length/columns)},(_,i)=>groups.slice(i*columns,(i+1)*columns));
  const heights=rows.map(row=>48+Math.max(1,...row.map(g=>g.items.length))*132);
  const height=420+heights.reduce((a,b)=>a+b,0);
  canvas.width=width*2;canvas.height=height*2;ctx.scale(2,2);ctx.fillStyle='#f7f7fb';ctx.fillRect(0,0,width,height);
  const text=(s:string,x:number,y:number,size=16,color='#232333',bold=false,max=650)=>{ctx.font=`${bold?650:400} ${size}px system-ui, sans-serif`;ctx.fillStyle=color;ctx.fillText(s,x,y,max)};
  const box=(x:number,y:number,w:number,h:number)=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(x,y,w,h,16);ctx.fill()};
  const icon=(key:string,x:number,y:number,color:string,size=17)=>{ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2D(icons[key]??icons.hrv));ctx.restore()};
  text('sieste',32,49,30,'#232333',true);text(end.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}),370,47,17,'#707080');
  box(20,70,680,292);text('Daily health',34,101,18,'#232333',true);text('7-day trends',550,101,14,'#707080');
  const days=weekOverview(data,end,sportFamily).rows,coros=data.extra?.coros;
  const metrics=[['sleep','Sleep','', '#8773dc'],['hrv','HRV',' ms','#369f83'],['rhr','Resting HR',' bpm','#d96688'],['score','Sleep score',' /100','#8773dc'],['steps','Steps','','#5089d6'],['calories','Calories',' kcal','#d8974b']];
  metrics.forEach(([key,label,unit,color],i)=>{const x=36+i%3*224,y=130+Math.floor(i/3)*112;
   const values=days.map(d=>{const stamp=d.iso.replaceAll('-',''),v=key==='score'?coros?.sleepWindows?.[stamp]?.score:key==='steps'||key==='calories'?coros?.daily?.[stamp]?.[key]:d[key as 'sleep'|'hrv'|'rhr'];return valid(v)?v:null});
   const v=values.at(-1)??null;icon(key,x,y-14,color);text(label,x+23,y,14,'#707080');text(v===null?'—':(key==='sleep'?duration(v*60):Math.round(v).toLocaleString('en-GB'))+unit,x,y+32,27,'#232333',true,205);
   const nums=values.filter(valid),lo=Math.min(...nums),hi=Math.max(...nums);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();let previous=false;
   values.forEach((v,j)=>{if(v===null){previous=false;return}const px=x+j*31,py=y+64-(hi===lo?8:(v-lo)/(hi-lo)*18);if(previous)ctx.lineTo(px,py);else ctx.moveTo(px,py);previous=true});ctx.stroke();
   values.forEach((v,j)=>{if(v===null)return;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+j*31,y+64-(hi===lo?8:(v-lo)/(hi-lo)*18),2.5,0,Math.PI*2);ctx.fill()});
  });
  text(`Training · ${dates.length} days`,32,392,18,'#232333',true);let top=410;
  rows.forEach((row,ri)=>{row.forEach((g,ci)=>{const x=32+ci*col;box(x-4,top,col-8,heights[ri]-12);text(g.day.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),x+8,top+25,15,'#6151bf',true);
   if(!g.items.length)text(localDate(g.day)>localDate(now)?'Upcoming':'Rest day',x+8,top+62,13,'#90909b',false,col-25);
   g.items.forEach((a,j)=>{const y=top+52+j*132,s={...a.summary,...detail[a.id]?.summary},family=sportFamily(a),speed=workoutSpeed({summary:s}),pace=s.pace>0?s.pace:s.distance>0&&s.duration>0?s.duration/s.distance*1000:null;
    icon(family==='walking'||family==='hiking'?'steps':family,x+8,y-14,'#6151bf');text(a.title||sportName(family),x+31,y,16,'#6151bf',true,col-48);text(new Date(a.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x+8,y+20,12,'#90909b');
    const lines=[valid(s.duration)?duration(s.duration/60):'—',valid(s.distance)?`${(s.distance/1000).toFixed(2)} km`:'',family==='cycling'?(speed!==null?speed.toFixed(1)+' km/h':''):family==='running'?runningPace(pace):'',valid(s.heartrate)?Math.round(s.heartrate)+' bpm':'',valid(s.calories)?Math.round(s.calories)+' kcal':''].filter(Boolean);
    text(lines.slice(0,2).join(' · '),x+8,y+47,16,'#232333',true,col-25);text(lines.slice(2).join(' · '),x+8,y+72,13,'#555565',false,col-25);
    const laps=lapPreview(detail[a.id]?.laps??[],family==='cycling');
    if(laps.length){const total=laps.reduce((n,l)=>n+(l.duration??0),0),timed=total>0&&laps.every(l=>l.duration!==null),max=Math.max(.001,...laps.map(l=>l.value??0));let left=x+8;
     laps.forEach(l=>{const w=(timed?l.duration!/total:1/laps.length)*(col-26),h=l.value===null?2:Math.max(2,l.value/max*17);ctx.fillStyle=l.value===null?'#dddde7':'#7770d6';ctx.fillRect(left,y+98-h,Math.max(.5,w-1),h);left+=w});
     text(`${laps.length} laps · ${timed?'width = time · ':''}height = speed`,x+8,y+112,9,'#90909b',false,col-26);
    }else if(family==='running'||family==='cycling')text(detail[a.id]?.failed?'Laps unavailable':'No recorded laps',x+8,y+100,10,'#90909b');
   });
  });top+=heights[ri]});
  text('Recorded data · daily totals may be partial',32,height-10,11,'#90909b');
  canvas.toBlob(blob=>{if(!active||!blob){if(active)setMessage('Could not create the image.');return}url=URL.createObjectURL(blob);setAsset({blob,url});setMessage('Ready to copy, save or share.');},'image/png');
  return()=>{active=false;if(url)URL.revokeObjectURL(url)};
 },[data,dates,now,detailJson,pending]);
 const save=()=>{if(!asset)return;const a=document.createElement('a');a.href=asset.url;a.download=filename;a.click();setMessage('PNG download started. You can also press and hold the preview to save it.');};
 const copy=async()=>{if(!asset)return;try{await navigator.clipboard.write([new ClipboardItem({'image/png':asset.blob})]);setMessage('Image copied.');}catch{setMessage('Copy is unavailable here. Use Save PNG or Share instead.');}};
 const share=async()=>{if(!asset)return;const file=new File([asset.blob],filename,{type:'image/png'});try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file]});}else save();}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setMessage('Sharing failed. Try Save PNG instead.');}};
 return <div className="home-snapshot"><div className="home-snapshot-actions"><button disabled={!asset} onClick={copy}><Copy size={15}/>Copy image</button><button disabled={!asset} onClick={save}><Download size={15}/>Save PNG</button><button disabled={!asset} onClick={share}><Share2 size={15}/>Share</button></div><p role="status">{message}</p>{asset&&<img src={asset.url} alt="Daily health and all workouts in the selected period"/>}<small>Health is from {end.toLocaleDateString('en-GB')}. All workouts in your selected period are included. Longer weeks create a taller image.</small></div>;
}

