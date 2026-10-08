import type {ShareDesign} from './share-card-design';
import {cinematicText} from './cinematic-type';
import {shareMetricLabel} from './share-labels';

export const retroActivityDesigns=[
 {key:'retrohero',name:'Golden hour',description:'Café lettering · giant reading · red shadow',color:'#f4d35e'},
 {key:'retroride',name:'Sunday club',description:'Ivory lettering · indigo shadow · sweeping route',color:'#f3e8d0'},
 {key:'retroswoop',name:'Slow curve',description:'Flowing serif numbers · curved underline · real stats',color:'#f4d35e'},
 {key:'retrostack',name:'The stat stack',description:'Six bold readings · tiny icons · hard shadows',color:'#f3e8d0'},
 {key:'retrolaps',name:'Lap café',description:'Big headline · recorded splits · compact readings',color:'#f4d35e'},
 {key:'retroseal',name:'Club stamp',description:'Scalloped seal · chunky serif · your route',color:'#f3e8d0'}
] as const;
export const retroRecoveryDesigns=[
 {key:'retrorecovery',name:'Blue morning',description:'Ice blue sleep · cobalt shadow · recovery history',color:'#b7ddf2'},
 {key:'retrotriptych',name:'Recovery club',description:'Three serif readings · history with gaps · day workouts',color:'#b7ddf2'}
] as const;

type Helpers={ink:string;route:(x:number,y:number,w:number,h:number,stroke?:number,inset?:number)=>string;sportIcon:(family:string,x:number,y:number,size:number,color:string)=>string;healthIcon:(key:string,x:number,y:number,size:number,color:string)=>string};
type Stat=ShareDesign['stats'][number];
type HealthKey='sleep'|'score'|'hrv';
const xml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
// Preserve custom titles: cinematicText outlines supported characters and safely
// escapes the existing font fallback for scripts outside the bundled Latin face.
const caption=(value:string)=>value.normalize('NFC').replace(/\s+/g,' ').trim();
const unit=(stat:Stat)=>['min:sec','h:mm:ss'].includes(stat.unit)?'':caption(stat.unit);
const compact=(stat:Stat)=>caption(stat.value)+(unit(stat)?(unit(stat).startsWith('/')?'':' ')+unit(stat):'');
const valid=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const healthValid=(key:HealthKey,value:unknown):value is number=>valid(value)&&(key==='score'?value<=100:key==='hrv'?value>0:true);
const sleepTime=(seconds:number)=>{const minutes=Math.round(seconds/60);return `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`};

function shadowColour(accent:string){
 const palettes:Record<string,string>={'#f4d35e':'#ef3340','#f3e8d0':'#29206b','#b7ddf2':'#174fcd','#ffffff':'#174fcd','#111111':'#f4d35e','#121826':'#f4d35e','#ef3340':'#6f132d','#990f16':'#f4d35e','#0b1f5e':'#a9cfff','#4169e1':'#172866','#064e3b':'#c8a45d','#4f46e5':'#241139','#60a5fa':'#0b1f5e','#b99aff':'#4a0612','#fb923c':'#990f16','#f472b6':'#4a0612','#4a0612':'#f3e8d0','#b64624':'#4a0612','#241139':'#b99aff','#123e45':'#f3e8d0','#c8a45d':'#4a0612'};
 const known=palettes[accent.toLowerCase()];if(known)return known;
 if(!/^#[\da-f]{6}$/i.test(accent))return '#174fcd';
 const r=parseInt(accent.slice(1,3),16),g=parseInt(accent.slice(3,5),16),b=parseInt(accent.slice(5,7),16);
 if(Math.max(r,g,b)-Math.min(r,g,b)<40)return r+g+b>420?'#29206b':'#f4d35e';
 return b>r&&b>g?'#174fcd':g>r&&g>b?'#29206b':r>210&&g>160?'#ef3340':'#4a0612';
}

/** Foreground-only artwork with self-contained retro glyphs for the bundled face. */
export function renderRetroShare(o:ShareDesign,helpers:Helpers):string{
 const {ink}=helpers,h=o.height,shadow=shadowColour(o.accent),parts:string[]=[],shown=o.stats.slice(0,6),first=shown[0],others=shown.slice(1),key=String(o.template);
 const title=caption(o.title)||caption(o.sport)||'Activity',titleRows=title.length>28&&title.includes(' ')?2:1,bottom=h-146,stretchY=Math.min(1.25,1+(h-1080)/3360);
 type LetterOptions={align?:'start'|'middle';shadow?:boolean;stretch?:boolean;wave?:boolean;depth?:number};
 const letter=(value:string,x:number,y:number,width:number,height:number,options:LetterOptions={})=>{
  const text=caption(value);
  // A missing reading is a quiet rule, independent of the display font's very
  // shallow dash bounds. Scaling that glyph to a metric height creates a pill.
  if(!text||/^[—–-]$/.test(text)){
   const length=Math.min(width,Math.min(64,Math.max(48,width*.12))),left=x+(width-length)/2,centerY=y+height*.52;
   return `<g data-cinematic-face="retro" data-cinematic-text="—" aria-label="—"><title>—</title><path d="M${left} ${centerY}h${length}" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/></g>`;
  }
  const glyph=cinematicText(text,{x,y,width,height,face:'retro',color:ink,align:options.align??'start',stretch:options.stretch,warp:options.wave?'wave':undefined});
  if(options.shadow===false)return glyph;
  // Inherited paint lets the parent's finish pass leave this complete hard shadow intact.
  const silhouette=glyph.replace(/ (?:fill|stroke|stroke-width|vector-effect|data-cinematic-text|aria-label)="[^"]*"/g,'').replace(/<title>[\s\S]*?<\/title>/g,'');
  const depth=options.depth??Math.min(12,Math.max(4,height*.045));
  return `<g data-retro-shadow="true" aria-hidden="true" transform="translate(${depth*.8} ${depth})" fill="${shadow}">${silhouette}</g>`+glyph;
 };
 const line=(x:number,y:number,x2:number,y2:number,width=3,opacity=1)=>`<path d="M${x} ${y}L${x2} ${y2}" fill="none" stroke="${ink}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`;
 const labelMode=o.labelMode??'icons';
 const cueLabel=(key:string,fullName:string,x:number,y:number,size:number)=>{
  if(labelMode==='none')return '';
  const full=({sleep:'Sleep duration',score:'Sleep score',hrv:'Heart rate variability'} as Record<string,string>)[key]??fullName;
  const label=shareMetricLabel(key,full,labelMode),width=Math.min(380,Math.max(170,size*7)),height=Math.min(28,size*.72);
  return `<g data-share-label-key="${xml(key)}" data-share-label-mode="${labelMode}">${letter(label,x+size/2-width/2,y+(size-height)/2,width,height,{align:'middle',shadow:false})}</g>`;
 };
 const healthCue=(key:string,x:number,y:number,size:number,color=ink,fullName?:string)=>labelMode==='icons'?helpers.healthIcon(key,x,y,size,color):cueLabel(key,fullName??({sleep:'Sleep',score:'Sleep score',hrv:'Overnight HRV',heartrate:'Heart rate',calories:'Calories',steps:'Steps'} as Record<string,string>)[key]??key,x,y,size);
 const sportCue=(family:string,x:number,y:number,size:number,color=ink)=>labelMode==='icons'?helpers.sportIcon(family,x,y,size,color):cueLabel(family,({running:'Running',cycling:'Cycling',strength_training:'Strength training',swimming:'Swimming',walking:'Walking',hiking:'Hiking',misc:'Activity'} as Record<string,string>)[family]??family,x,y,size);
 const metricIcon=(stat:Stat,x:number,y:number,size=28)=>{
  const health=({hr:'heartrate',heartrate:'heartrate',calories:'calories',sleep:'sleep',hrv:'hrv',score:'score',steps:'steps'} as Record<string,string>)[stat.key];
  if(labelMode!=='icons')return cueLabel(stat.key,stat.label,x,y,size);
  if(health)return healthCue(health,x,y,size,ink,stat.label);
  const glyphs:Record<string,string>={
   distance:'<path d="M5 19 19 5M4 14l6 6M9 9l6 6M14 4l6 6"/>',
   duration:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
   pace:'<path d="M3 17a9 9 0 1 1 18 0M12 14l5-6M5 13l1 1M8 7l1 2M16 7l-1 2"/><circle cx="12" cy="15" r="2"/>',
   speed:'<path d="M3 17a9 9 0 1 1 18 0M12 14l5-6M5 13l1 1M8 7l1 2M16 7l-1 2"/><circle cx="12" cy="15" r="2"/>',
   power:'<path d="m14 2-9 12h7l-2 8 9-12h-7Z"/>',
   ascent:'<path d="m2 20 8-14 5 8 3-5 5 11ZM7 11l3 3 3-3"/>',
   cadence:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2"/>',
   sessions:'<path d="M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z"/>'
  };
  return `<g data-stat-icon="${xml(stat.key)}" transform="translate(${x} ${y}) scale(${size/24})" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyphs[stat.key]??'<path d="M3 12h4l3-8 4 16 3-8h4"/>'}</g>`;
 };
 const metric=(stat:Stat|undefined,x:number,y:number,w:number,height:number,center=true,icon=true)=>{
  if(!stat)return '';
  return `<g data-share-stat-key="${xml(stat.key)}" data-stat-value="${xml(stat.value)}" data-stat-unit="${xml(stat.unit)}">`+
   (icon?metricIcon(stat,center?x+w/2-13:x,y,26):'')+letter(compact(stat),x,y+(icon?40:0),w,height,{align:center?'middle':'start'})+'</g>';
 };
 const hero=(x:number,y:number,w:number,height:number,center=true)=>{
  if(!first)return letter('—',x,y,w,height,{align:center?'middle':'start'});
  const suffix=unit(first),unitHeight=Math.min(68,height*.32),unitY=y+height+26;
  return `<g data-share-stat-key="${xml(first.key)}" data-stat-value="${xml(first.value)}" data-stat-unit="${xml(first.unit)}">`+
   letter(first.value,x,y,w,height,{align:center?'middle':'start'})+
   (suffix?letter(suffix,x,unitY,w,unitHeight,{align:center?'middle':'start'}):'')+'</g>';
 };
 const heading=(y:number,height=52,center=true,x=72,w=936)=>{
  if(o.labelMode==='none'&&title.toLowerCase()===(caption(o.sport)||'Activity').toLowerCase())return '';
  const displayedTitle=labelMode==='short'?shareMetricLabel(o.sportFamily??'misc',title,'short'):title;
  if(o.labelMode==='short')return `<g data-share-label-key="${xml(o.sportFamily??'misc')}" data-share-label-mode="short">${letter(displayedTitle,x,y,w,height,{align:center?'middle':'start',depth:4})}</g>`;
  const words=title.split(' '),split=titleRows===2?words.reduce((best,_,i)=>i>0&&Math.abs(words.slice(0,i).join(' ').length-title.length/2)<Math.abs(words.slice(0,best).join(' ').length-title.length/2)?i:best,Math.max(1,Math.floor(words.length/2))):0;
  const lines=split?[words.slice(0,split).join(' '),words.slice(split).join(' ')]:[title];
  if(o.labelMode==='full')return `<g data-share-label-key="${xml(o.sportFamily??'misc')}" data-share-label-mode="full">${lines.map((value,i)=>letter(value,x,y+i*(height+12),w,height,{align:center?'middle':'start',depth:4})).join('')}</g>`;
  const icon=sportCue(o.sportFamily??'misc',center?524:x,y-50,32,ink);
  return icon+lines.map((value,i)=>letter(value,x,y+i*(height+12),w,height,{align:center?'middle':'start',depth:4})).join('');
 };
 const grid=(stats:Stat[],y:number,columns=3,rowHeight=100,valueHeight=46,x=72,w=936)=>{
  const columnWidth=(w-(columns-1)*24)/columns;
  return stats.map((stat,i)=>metric(stat,x+i%columns*(columnWidth+24),y+Math.floor(i/columns)*rowHeight,columnWidth,valueHeight)).join('');
 };
 const trace=(x:number,y:number,w:number,height:number,stroke=12)=>{
  if(!o.route||height<28)return '';
  const paths=helpers.route(x,y,w,height,stroke,stroke/2+12);
  return paths?`<g data-share-route="true">${paths}</g>`:'';
 };
 const footer=()=>{
  const y=h-91;
  if(o.brand)parts.push(letter('sieste',72,y,188,25,{depth:3}));
  if(o.date)parts.push(letter(o.date,o.brand?344:72,y,o.brand?660:936,22,{align:o.brand?'start':'middle',shadow:false}));
  if(o.demo)parts.push(letter('Illustrative data',72,h-52,936,17,{align:'middle',shadow:false}));
 };

 if(key==='retrorecovery'||key==='retrotriptych'){
  const health=o.dayHealth??{},history=health.history??[],sessions=o.recoveryOnly?[]:(o.dayCards??[]).filter(card=>!!card.sportFamily);
  const workoutHeight=sessions.length?sessions.length*114+46:0,localH=Math.max(h-172,780+workoutHeight),scale=Math.min(1,(h-172)/localH),healthBottom=localH-workoutHeight;
  const readings:Stat[]=[
   {key:'sleep',label:'Sleep',value:healthValid('sleep',health.sleep)?sleepTime(health.sleep):'—',unit:''},
   {key:'score',label:'Sleep score',value:healthValid('score',health.score)?String(Math.round(health.score)):'—',unit:healthValid('score',health.score)?'/100':''},
   {key:'hrv',label:'Overnight HRV',value:healthValid('hrv',health.hrv)?String(Math.round(health.hrv)):'—',unit:healthValid('hrv',health.hrv)?'ms':''}
  ];
  const reading=(stat:Stat,x:number,y:number,w:number,height:number,withIcon=true)=>`<g data-retro-health-key="${stat.key}" data-health-value="${healthValid(stat.key as HealthKey,health[stat.key as HealthKey])?health[stat.key as HealthKey]:''}">`+
   (withIcon?healthCue(stat.key,x+w/2-18,y,36,ink,stat.label):'')+letter(compact(stat),x,y+(withIcon?58:0),w,height,{align:'middle'})+'</g>';
  // dailyShareHistory exposes sleep in hours; the current-day sleep reading is seconds.
  const rangeNumber=(metricKey:HealthKey,value:number)=>metricKey==='sleep'?value.toFixed(1)+'h':String(Math.round(value))+(metricKey==='hrv'?' ms':'');
  const chart=(metricKey:HealthKey,x:number,y:number,w:number,height:number,bars=false)=>{
   const values=history.map(row=>row[metricKey]),recorded=values.filter(value=>healthValid(metricKey,value));
   const base=y+height,step=w/Math.max(1,values.length),xx=(index:number)=>x+step*(index+.5);
   let chartSvg=line(x,base,x+w,base,2,.35);
   if(!recorded.length)return `<g data-retro-history-key="${metricKey}">${chartSvg}${letter('—',x,y+height*.3,w,26,{align:'middle',shadow:false})}</g>`;
   // HRV is a raw millisecond series with its own extent, never a percentage or a 100-ms cap.
   const low=Math.min(...recorded),high=Math.max(...recorded),padding=Math.max((high-low)*.16,metricKey==='sleep'?.15:1),min=bars?0:Math.max(0,low-padding),max=bars?Math.max(high,1):high+padding;
   const yy=(value:number)=>base-(value-min)/Math.max(1,max-min)*height;
   let path='',previous=false;
   values.forEach((value,index)=>{
    if(!healthValid(metricKey,value)){previous=false;chartSvg+=`<circle data-history-missing="true" data-history-date="${xml(history[index].date)}" data-history-index="${index}" cx="${xx(index)}" cy="${base}" r="3.5" fill="none" stroke="${ink}" stroke-width="1.5" opacity=".35"/>`;return;}
    const data=`data-history-date="${xml(history[index].date)}" data-history-index="${index}" data-history-value="${value}"`;
    if(bars){const barWidth=Math.min(28,step*.48);chartSvg+=`<rect ${data} x="${xx(index)-barWidth/2}" y="${yy(value)}" width="${barWidth}" height="${Math.max(1,base-yy(value))}" rx="${barWidth/2}" fill="${ink}"/>`;}
    else{path+=(previous?'L':'M')+xx(index)+' '+yy(value)+' ';previous=true;chartSvg+=`<circle ${data} cx="${xx(index)}" cy="${yy(value)}" r="${index===values.length-1?6:4}" fill="${ink}"/>`;}
   });
   if(path)chartSvg+=`<path data-history-segment="true" d="${path.trim()}" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
   chartSvg+=letter(rangeNumber(metricKey,low)+(low===high?'':' — '+rangeNumber(metricKey,high)),x,base+24,w,18,{align:'middle',shadow:false});
   return `<g data-retro-history-key="${metricKey}" data-history-min="${low}" data-history-max="${high}">${chartSvg}</g>`;
  };
  const dateSpan=(y:number)=>{const start=history[0]?.date,end=history.at(-1)?.date;return start&&end?letter(start.slice(8)+'/'+start.slice(5,7)+' — '+end.slice(8)+'/'+end.slice(5,7),72,y,936,18,{align:'middle',shadow:false}):''};
  parts.push(`<g transform="translate(${540*(1-scale)} ${86}) scale(${scale})">`);
  parts.push(letter(key==='retrotriptych'?'Recovery club':'Recovery',72,0,936,key==='retrotriptych'?64:68,{align:'middle'}));
  const extraTitle=caption(o.title);if(extraTitle)parts.push(letter(extraTitle,72,96,936,23,{align:'middle',shadow:false}));
  if(key==='retrorecovery'){
   const heroHeight=Math.min(206,healthBottom*.24),heroY=150,sideY=heroY+heroHeight+74,chartY=sideY+170,chartHeight=Math.max(68,healthBottom-chartY-88);
   parts.push(reading(readings[0],72,heroY,936,heroHeight,false),healthCue('sleep',518,heroY+heroHeight+27,44,ink));
   parts.push(reading(readings[1],116,sideY,400,75),reading(readings[2],564,sideY,400,75));
   (['sleep','score','hrv'] as HealthKey[]).forEach((metricKey,i)=>{const x=72+i*320;parts.push(healthCue(metricKey,x+130,chartY-42,26,ink),chart(metricKey,x,chartY,296,chartHeight))});
   parts.push(dateSpan(chartY+chartHeight+56));
  }else{
   const metricY=168,chartY=366,chartHeight=Math.max(115,healthBottom-chartY-112);
   readings.forEach((stat,i)=>{const x=72+i*320;parts.push(reading(stat,x,metricY,296,stat.key==='sleep'?80:84));if(i<2)parts.push(line(x+308,metricY+5,x+308,healthBottom-54,2,.35));parts.push(chart(stat.key as HealthKey,x+18,chartY,260,chartHeight,stat.key!=='hrv'))});
   parts.push(dateSpan(chartY+chartHeight+64));
  }
  sessions.forEach((session,index)=>{
   const y=healthBottom+44+index*114;
   const sessionTitle=labelMode==='none'?'':labelMode==='short'?shareMetricLabel(session.sportFamily!,session.title,'short'):session.title;
   parts.push(`<g data-retro-workout="true" data-workout-family="${xml(session.sportFamily!)}">`,line(72,y-20,1008,y-20,2,.45),labelMode==='icons'?sportCue(session.sportFamily!,76,y,27,ink):'',sessionTitle?letter(sessionTitle,labelMode==='icons'?121:76,y,labelMode==='icons'?887:932,24,{shadow:false}):'');
   session.stats.slice(0,3).forEach((stat,j)=>parts.push(metric(stat,112+j*300,y+45,276,34,true,false)));
   parts.push('</g>');
  });
  parts.push('</g>');footer();return parts.join('');
 }

 if(key==='retrohero'){
  const supportY=bottom-(Math.ceil(others.length/3)-1)*110-80,heroY=Math.max(190,h*.17,112+titleRows*62+16),heroHeight=228*stretchY,routeY=heroY+heroHeight+(first&&unit(first)?112:52),routeHeight=supportY-routeY-45;
  parts.push(heading(112,50),hero(64,heroY,952,heroHeight));
  if(o.route)parts.push(trace(110,routeY,860,routeHeight,13));
  else if(routeHeight>85)parts.push(sportCue(o.sportFamily??'misc',540-Math.min(122,routeHeight*.38)/2,routeY+routeHeight*.2,Math.min(122,routeHeight*.38),ink));
  parts.push(grid(others,supportY,3,110,48));
 }else if(key==='retroride'){
  const supportY=bottom-(Math.ceil(others.length/3)-1)*110-80,heroY=Math.max(190,h*.17,112+titleRows*60+18),heroHeight=202*stretchY,routeY=heroY+heroHeight+(first&&unit(first)?110:58),routeHeight=supportY-routeY-30;
  parts.push(heading(112,48),hero(74,heroY,932,heroHeight));
  if(routeHeight>70){
   const ovalY=routeY+10,ovalH=routeHeight-20;
   parts.push(`<ellipse cx="540" cy="${ovalY+ovalH/2}" rx="403" ry="${ovalH/2}" fill="none" stroke="${ink}" stroke-width="3"/>`);
   parts.push(o.route?trace(180,ovalY+18,720,ovalH-36,13):sportCue(o.sportFamily??'cycling',540-Math.min(132,ovalH*.65)/2,ovalY+(ovalH-Math.min(132,ovalH*.65))/2,Math.min(132,ovalH*.65),ink));
  }
  parts.push(grid(others,supportY,3,110,47));
 }else if(key==='retroswoop'){
  const supportY=bottom-(Math.ceil(others.length/3)-1)*106-78,heroY=Math.max(198,h*.18,112+titleRows*60+24),heroHeight=252*stretchY,traceY=heroY+heroHeight+103,traceH=supportY-traceY-32;
  parts.push(heading(112,48));
  if(first)parts.push(`<g data-share-stat-key="${xml(first.key)}" data-stat-value="${xml(first.value)}" data-stat-unit="${xml(first.unit)}" transform="rotate(-4 540 ${heroY+heroHeight/2})">`,letter(first.value,94,heroY,880,heroHeight,{align:'middle',stretch:true,wave:true,depth:11}),unit(first)?letter(unit(first),98,heroY+heroHeight+10,876,59,{align:'middle'}):'',`<path data-retro-ornament="true" d="M136 ${heroY+heroHeight+82}C370 ${heroY+heroHeight+52} 730 ${heroY+heroHeight+48} 944 ${heroY+heroHeight+12}" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>`,'</g>');
  else parts.push(hero(94,heroY,880,heroHeight));
  if(o.route&&traceH>60)parts.push(trace(154,traceY+12,772,traceH-12,11));
  parts.push(grid(others,supportY,3,106,47));
 }else if(key==='retrostack'){
  const headerY=Math.max(104,h*.085),heroY=headerY+(titleRows===2?134:98),heroHeight=Math.min(252,(bottom-heroY)*.31),supportY=heroY+heroHeight+(first&&unit(first)?130:65),step=(bottom-supportY+18)/Math.max(1,others.length);
  parts.push(heading(headerY,45),hero(72,heroY,936,heroHeight));
  others.forEach((stat,index)=>{const y=supportY+index*step;parts.push(line(88,y-24,992,y-24,2,.55),`<g data-share-stat-key="${xml(stat.key)}" data-stat-value="${xml(stat.value)}" data-stat-unit="${xml(stat.unit)}">`,metricIcon(stat,90,y+Math.max(0,(step-40)*.1),30),letter(compact(stat),148,y,844,Math.min(76,step*.57),{align:'middle'}),'</g>')});
 }else if(key==='retrolaps'){
  const headerY=100,heroY=Math.max(182,h*.13,100+titleRows*56+26),heroHeight=176*stretchY,supportY=heroY+heroHeight+(first&&unit(first)?110:58),supportRows=Math.ceil(others.length/3),lapY=supportY+supportRows*86+46,lapH=bottom-lapY;
  parts.push(heading(headerY,44),hero(72,heroY,936,heroHeight),grid(others,supportY,3,86,37));
  const laps=(o.laps??[]).slice(0,12),recorded=laps.map(lap=>o.cycling?lap.value:lap.pace).filter(valid),max=Math.max(1,...recorded),step=Math.min(48,lapH/Math.max(1,laps.length));
  if(laps.length&&lapH>30){
   parts.push(line(72,lapY-19,1008,lapY-19,3,.65));
   laps.forEach((lap,index)=>{
    const y=lapY+index*step,value=o.cycling?lap.value:lap.pace,known=valid(value),label=o.cycling?(known?(value*3.6).toFixed(1):'—'):known?`${Math.floor(Math.round(value)/60)}:${String(Math.round(value)%60).padStart(2,'0')}`:'—';
    parts.push(`<g data-retro-lap-index="${lap.index}"${valid(lap.value)?` data-retro-lap-value="${lap.value}"`:''}${valid(lap.pace)?` data-retro-lap-pace="${lap.pace}"`:''}>`,letter(String(lap.index).padStart(2,'0'),72,y+2,74,Math.min(22,step*.52),{shadow:false}),letter(label,170,y+2,152,Math.min(25,step*.6),{shadow:false}));
    if(known)parts.push(`<rect x="353" y="${y+4}" width="${Math.max(3,value/max*630)}" height="${Math.max(3,Math.min(21,step-12))}" rx="8" fill="${ink}"/>`);
    parts.push('</g>');
   });
   if((o.laps?.length??0)>12)parts.push(letter('First 12 recorded laps',72,lapY+laps.length*step+14,936,17,{align:'middle',shadow:false}));
  }else if(o.route)parts.push(trace(144,lapY,792,lapH,12));
  else if(lapH>90)parts.push(sportCue(o.sportFamily??'misc',475,lapY+Math.max(0,(lapH-130)/2),130,ink));
 }else if(key==='retroseal'){
  const supportY=bottom-(Math.ceil(others.length/3)-1)*100-72,diameter=Math.min(728,supportY-124),r=diameter/2,cy=90+r,cx=540,points=Array.from({length:64},(_,i)=>{const angle=-Math.PI/2+i*Math.PI/32,radius=r+(i%2?0:13);return `${(cx+Math.cos(angle)*radius).toFixed(2)},${(cy+Math.sin(angle)*radius).toFixed(2)}`}).join(' '),valueY=cy-r+174,valueH=Math.min(182,r*.55);
  parts.push(`<g data-retro-shadow="true" aria-hidden="true" transform="translate(7 9)" fill="none" stroke="${shadow}" stroke-width="8"><polygon points="${points}"/></g><polygon points="${points}" fill="none" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/><circle cx="540" cy="${cy}" r="${r-27}" fill="none" stroke="${ink}" stroke-width="2"/>`);
  const sealTitle=caption(o.sport)||title;
  parts.push(sportCue(o.sportFamily??'misc',523,cy-r+52,34,ink),labelMode==='none'?'':letter(labelMode==='short'?shareMetricLabel(o.sportFamily??'misc',sealTitle,'short'):sealTitle,540-r+50,cy-r+104,diameter-100,44,{align:'middle'}),hero(540-r+47,valueY,diameter-94,valueH));
  const traceY=valueY+valueH+(first&&unit(first)?118:42),traceH=cy+r-44-traceY;
  if(o.route&&traceH>30)parts.push(trace(540-r+91,traceY,diameter-182,traceH,10));
  else if(traceH>48)parts.push(letter(title,540-r+75,traceY+Math.max(0,(traceH-30)/2),diameter-150,30,{align:'middle',shadow:false}));
  parts.push(grid(others,supportY,3,100,43));
 }
 footer();return parts.join('');
}
