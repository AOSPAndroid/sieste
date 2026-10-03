"use client";
import {useEffect,useState} from 'react';
import {Copy,Download,Share2} from 'lucide-react';
import type {AthleteData} from './analytics';
import {weekOverview,localDate} from './week-overview';
import {sportFamily,sportName,runningPace,workoutSpeed} from './sports';
import {useCalendarDetails} from './calendar-details';
import {lapPreview} from './calendar-preview';
import {lapElevation} from './lap-elevation';

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
const workoutDuration=(n:unknown)=>!valid(n)?'—':n<3600?`${Math.round(n/60)} min`:duration(n/60);
const sportInk:Record<string,string>={running:'#2563eb',cycling:'#7c3aed',strength_training:'#b76a08'};
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
  const groups=dates.map(day=>({day,items:data.activities.filter(a=>localDate(new Date(a.date))===localDate(day)&&new Date(a.date)<=now).sort((a,b)=>a.date.localeCompare(b.date)).map(a=>{
   const recorded=detail[a.id],s={...a.summary,...recorded?.summary},family=sportFamily(a),cycling=family==='cycling',speed=workoutSpeed({summary:s}),pace=s.pace>0?s.pace:s.distance>0&&s.duration>0?s.duration/s.distance*1000:null;
   const stats=[{label:'Duration',value:workoutDuration(s.duration)},...(valid(s.distance)?[{label:'Distance',value:`${(s.distance/1000).toFixed(2)} km`}]:[]),...(family!=='strength_training'?[{label:cycling?'Avg speed':'Avg pace',value:cycling?(speed===null?'—':speed.toFixed(1)+' km/h'):runningPace(pace)}]:[]),{label:'Avg HR',value:valid(s.heartrate)?Math.round(s.heartrate)+' bpm':'—'},...(valid(s.calories)?[{label:'Calories',value:Math.round(s.calories)+' kcal'}]:[])];
   const laps=family==='strength_training'?[]:lapPreview(recorded?.laps??[],cycling),elevation=recorded?.elevationPreview??lapElevation(recorded),lapTop=43+Math.ceil(stats.length/2)*31,showLap=family!=='strength_training'&&(laps.length>0||family==='running'||cycling);
   return {a,family,cycling,recorded,stats,laps,elevation,lapTop,height:lapTop+(showLap?60:8)};
  })}));
  const columns=Math.min(3,dates.length),width=720,col=656/columns;
  const rows=Array.from({length:Math.ceil(groups.length/columns)},(_,i)=>groups.slice(i*columns,(i+1)*columns));
  const heights=rows.map(row=>44+Math.max(52,...row.map(g=>g.items.reduce((n,item)=>n+item.height+8,0))));
  const height=420+heights.reduce((a,b)=>a+b,0);
  canvas.width=width*2;canvas.height=height*2;ctx.scale(2,2);ctx.fillStyle='#f6f6f9';ctx.fillRect(0,0,width,height);
  const text=(s:string,x:number,y:number,size=16,color='#242433',bold=false,max=650)=>{ctx.font=`${bold?650:400} ${size}px system-ui, sans-serif`;ctx.fillStyle=color;ctx.fillText(s,x,y,max)};
  const box=(x:number,y:number,w:number,h:number,fill='#fff',radius=16)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fill()};
  const icon=(key:string,x:number,y:number,color:string,size=17)=>{ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2D(icons[key]??icons.hrv));ctx.restore()};
  text('sieste',32,49,30,'#242433',true);text(end.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}),370,47,17,'#686875');
  box(20,70,680,292);text(localDate(end)===localDate(now)?'Today’s health':'Daily health',34,101,18,'#242433',true);text('7-day trends',550,101,14,'#686875');
  const healthAt=new Date(end);healthAt.setHours(23,59,59,999);if(localDate(end)===localDate(now))healthAt.setTime(now.getTime());
  const days=weekOverview(data,healthAt,sportFamily).rows,coros=data.extra?.coros;
  const metrics=[['sleep','Sleep','', '#8773dc'],['hrv','HRV',' ms','#369f83'],['rhr','Resting HR',' bpm','#d96688'],['score','Sleep score',' /100','#8773dc'],['steps','Steps','','#5089d6'],['calories','Calories',' kcal','#d8974b']];
  metrics.forEach(([key,label,unit,color],i)=>{const x=36+i%3*224,y=130+Math.floor(i/3)*112;
   const values=days.map(d=>{const stamp=d.iso.replaceAll('-',''),v=key==='score'?coros?.sleepWindows?.[stamp]?.score:key==='steps'||key==='calories'?coros?.daily?.[stamp]?.[key]:d[key as 'sleep'|'hrv'|'rhr'];return valid(v)?v:null});
   const v=values.at(-1)??null;icon(key,x,y-14,color);text(label,x+23,y,14,'#707080');text(v===null?'—':(key==='sleep'?duration(v*60):Math.round(v).toLocaleString('en-GB'))+unit,x,y+32,27,'#232333',true,205);
   const nums=values.filter(valid),lo=Math.min(...nums),hi=Math.max(...nums);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();let previous=false;
   values.forEach((v,j)=>{if(v===null){previous=false;return}const px=x+j*31,py=y+64-(hi===lo?8:(v-lo)/(hi-lo)*18);if(previous)ctx.lineTo(px,py);else ctx.moveTo(px,py);previous=true});ctx.stroke();
   values.forEach((v,j)=>{if(v===null)return;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+j*31,y+64-(hi===lo?8:(v-lo)/(hi-lo)*18),2.5,0,Math.PI*2);ctx.fill()});
  });
  text(`Training · ${dates.length} days`,32,392,18,'#242433',true);let top=410;
  rows.forEach((row,ri)=>{row.forEach((g,ci)=>{
   const x=32+ci*col,current=localDate(g.day)===localDate(now);box(x-4,top,col-8,heights[ri]-12,'#f7f7f9',9);box(x-4,top,col-8,30,current?'#f0efff':'#f7f7f9',9);
   text(current?'Today':g.day.toLocaleDateString('en-GB',{weekday:'short'}),x+8,top+20,11,current?'#5145cd':'#686875');ctx.textAlign='right';text(g.day.toLocaleDateString('en-GB',{day:'numeric',month:'short'}),x+col-22,top+20,11,current?'#5145cd':'#242433',true);ctx.textAlign='left';
   if(!g.items.length)text(localDate(g.day)>localDate(now)?'Upcoming':'Rest day',x+8,top+62,12,'#81818e',false,col-25);
   let y=top+38;
   g.items.forEach(({a,family,cycling,recorded,stats,laps,elevation,lapTop,height:cardHeight})=>{
    const ink=sportInk[family]??'#64748b',chartX=x+8,chartWidth=col-32,chartY=y+lapTop+12,chartHeight=28;
    box(x+2,y,col-20,cardHeight,'#fff',7);icon(family==='walking'||family==='hiking'?'steps':family,x+8,y+4,ink,14);text(a.title||sportName(family),x+28,y+16,13,ink,true,col-52);text(new Date(a.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x+28,y+30,9,'#81818e');
    stats.forEach((stat,i)=>{const sx=x+8+i%2*(col-32)/2,sy=y+49+Math.floor(i/2)*31; text(stat.label,sx,sy,9,'#686875',false,(col-36)/2);text(stat.value,sx,sy+17,14,'#242433',true,(col-36)/2)});
    if(laps.length){
     text(`${laps.length} laps · ${cycling?'km/h':'pace'}`,chartX,y+lapTop+6,6,'#64748b',false,chartWidth);
     if(elevation){ctx.textAlign='right';text(`${Math.round(elevation.min)}–${Math.round(elevation.max)} m`,chartX+chartWidth,y+lapTop+6,6,'#64748b');ctx.textAlign='left'}
     const total=laps.reduce((n,l)=>n+(l.duration??0),0),timed=total>0&&laps.every(l=>l.duration!==null),max=Math.max(.001,...laps.map(l=>l.value??0));let left=chartX;
     laps.forEach(l=>{const w=(timed?l.duration!/total:1/laps.length)*chartWidth,h=l.value===null?2:Math.max(2,l.value/max*chartHeight*.96);ctx.fillStyle=l.value===null?'#dddde7':ink;ctx.fillRect(left,chartY+chartHeight-h,Math.max(0,w-chartWidth*.002),h);left+=w});
     if(elevation){
      ctx.save();ctx.beginPath();ctx.rect(chartX,chartY,chartWidth,chartHeight);ctx.clip();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.lineJoin='round';ctx.lineCap='round';const range=elevation.max-elevation.min;
      elevation.segments.forEach((segment:{x:number;metres:number}[])=>{ctx.beginPath();segment.forEach((point,i)=>{const px=chartX+point.x*chartWidth,py=chartY+(range>0?.92-(point.metres-elevation.min)/range*.84:.5)*chartHeight;if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py)});ctx.stroke()});ctx.restore();
     }
     text(laps.slice(0,4).map(l=>cycling?(l.value===null?'—':(l.value*3.6).toFixed(1)):runningPace(l.pace).replace(' /km','')).concat(laps.length>4?[`+${laps.length-4}`]:[]).join('   '),chartX,y+lapTop+49,8,'#64748b',false,chartWidth);
    }else if(family==='running'||cycling)text(recorded?.failed?'Laps unavailable':'No recorded laps',chartX,y+lapTop+22,9,'#81818e');
    y+=cardHeight+8;
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
