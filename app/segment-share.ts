export type ShareSegment={label:string;start:number;end:number;durationSeconds?:number;distance?:number|null;cadence?:number|null;power?:number|null;speed?:number|null;hr?:number|null;gain?:number|null;grade?:number|null;badges?:string[]};
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function readableTime(minutes:number){const seconds=Math.max(0,Math.round(minutes*60)),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return [h?`${h}h`:null,m?`${m} min`:null,s?`${s}s`:null].filter(Boolean).join(' ')||'0s'}
const pace=(speed:number,metres:number)=>{const seconds=Math.round(metres/speed);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`};
export function segmentShare({title,sport,date,mode,source,segments,short=false,timing=false}:{title:string;sport:string;date?:string;mode:string;source?:string;segments:ShareSegment[];short?:boolean;timing?:boolean}){
 const heading=title.trim()||({cycling:'Cycling',running:'Running',walking:'Walking',hiking:'Hiking',swimming:'Swimming'} as Record<string,string>)[sport]||'Workout';
 const duration=(s:ShareSegment)=>mode==='laps'&&valid(s.durationSeconds)&&s.durationSeconds>0?s.durationSeconds/60:Math.max(0,s.end-s.start);
 const total=segments.reduce((sum,s)=>sum+duration(s),0),climbs=mode==='climbs';
 const chosen=short&&segments.length>3?[...segments].sort((a,b)=>Number(!!b.badges?.length)-Number(!!a.badges?.length)||duration(b)-duration(a)).slice(0,3).sort((a,b)=>a.start-b.start):segments;
 if(climbs){
  const clock=(minutes:number)=>{const seconds=Math.max(0,Math.round(minutes*60)),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=String(seconds%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${s}`:`${m}:${s}`};
  const lines=[`*${sport==='cycling'?'🚴':sport==='running'?'🏃':'⛰️'} Climb notes*`,heading+(date?' · '+date:'')];
  if(chosen.length<segments.length)lines.push(`Highlights · ${chosen.length} of ${segments.length}`);
  let hasHr=false,hasCadence=false;
  for(const s of chosen){
   const name=[s.label.replace(/^Climb\s+/i,'')],terrain=[`⏱️ ${clock(duration(s))}`],sensors:string[]=[];
   if(valid(s.distance)&&s.distance>=0)name.push(s.distance>=1000?`${(s.distance/1000).toFixed(2)} km`:`${Math.round(s.distance)} m`);
   if(valid(s.grade))name.push(`${s.grade.toFixed(1)}%`);
   if(valid(s.gain))terrain.push(`⛰️ ${s.gain>=0?'+':''}${Math.round(s.gain)} m`);
   if(sport==='cycling'&&valid(s.power)&&s.power>=0)sensors.push(`⚡ ${Math.round(s.power)} W`);
   else if(valid(s.speed)&&s.speed>0)sensors.push(['running','walking','hiking','swimming'].includes(sport)?`🏃 ${pace(s.speed,sport==='swimming'?100:1000)} ${sport==='swimming'?'/100m':'/km'}`:`🚴 ${(s.speed*3.6).toFixed(1)} km/h`);
   if(valid(s.hr)&&s.hr>0){sensors.push(`❤️ ${Math.round(s.hr)}`);hasHr=true}
   if(valid(s.cadence)&&s.cadence>=0){sensors.push(`🔄 ${Math.round(s.cadence)}`);hasCadence=true}
   lines.push('',`*${name.join(' · ')}*`,terrain.join(' · '));
   if(sensors.length)lines.push(sensors.join(' · '));
   if(timing)lines.push(`Starts ${readableTime(s.start)} into the activity`);
  }
  const legend=[hasHr?'❤️ bpm':null,hasCadence?`🔄 ${sport==='cycling'?'rpm':'steps/min'}`:null].filter(Boolean);
  lines.push('',...(legend.length?[legend.join(' · ')]:[]),'sieste');
  return lines.join('\n');
 }
 const lines=[heading+(date?' · '+date:''),`${segments.length} ${mode==='laps'?(segments.length===1?'recorded lap':'recorded laps'):climbs?(segments.length===1?'detected climb':'detected climbs'):mode==='sections'?(segments.length===1?'detected fast section':'detected fast sections'):(segments.length===1?'detected effort':'detected efforts')} · ${readableTime(total)} ${climbs?'climbing':mode==='laps'?'in laps':mode==='sections'?'in fast sections':'of efforts'}`];
 const gains=segments.map(s=>s.gain);if(climbs&&gains.length&&gains.every(valid))lines.push(`${Math.round(gains.reduce((a,b)=>a+b,0))} m gained across these climbs`);
 if(chosen.length<segments.length)lines.push(`Highlights · ${chosen.length} of ${segments.length}`);
 for(const s of chosen){const metrics:string[]=[];if(sport==='cycling'&&valid(s.power))metrics.push(`${Math.round(s.power)} W avg`);else if(valid(s.speed)&&s.speed>0)metrics.push(['running','walking','hiking','swimming'].includes(sport)?`${pace(s.speed,sport==='swimming'?100:1000)} ${sport==='swimming'?'/100m':'/km'} pace`:`${(s.speed*3.6).toFixed(1)} km/h avg`);if(valid(s.hr)&&s.hr>0)metrics.push(`${Math.round(s.hr)} bpm avg`);
 const terrain:string[]=[];if(valid(s.gain))terrain.push(climbs?`${Math.round(s.gain)} m climbed`:`${s.gain>=0?'+':''}${Math.round(s.gain)} m net elevation`);if(valid(s.grade))terrain.push(`${s.grade.toFixed(1)}% avg gradient`);
 lines.push('',`${s.label} · ${readableTime(duration(s))}`,metrics.join(' · '),terrain.join(' · '));if(s.badges?.length)lines.push(s.badges.map(b=>b==='Highest avg'?(source==='heartrate'?'Highest average HR':source==='speed'?'Fastest average speed':source==='power'||sport==='cycling'?'⚡ Highest average power':'⚡ Strongest detected effort'):b.startsWith('Longest')?'◷ Longest duration':b==='Most elevation'?'△ Most elevation': '✓ Consistent repeat').join(' · '));if(timing)lines.push(`Starts ${readableTime(s.start)} into the activity`);
 }
 lines.push('',mode==='laps'?'Recorded laps · sieste':'Automatically detected from recorded data · sieste');return lines.filter((v,i)=>v!==''||i>0&&lines[i-1]!=='').join('\n');
}
