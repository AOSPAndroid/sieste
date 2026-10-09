import {referenceText,referenceTextSize,type ReferenceFace} from './share-reference-type';
import {shareMetricLabel,shareLabelMode} from './share-labels';
import type {ShareDesign,ShareStat} from './share-card-design';

/** A small, reference-led collection of photo overlays. The canvas is never the card. */
export const referenceActivityDesigns=[
 {key:'refhero',name:'Headline',description:'Bold distance · three small readings'},
 {key:'refstack',name:'Three lines',description:'Distance, pace and exact time'},
 {key:'refweekday',name:'Day headline',description:'Weekday · compact bold distance'},
 {key:'refroute',name:'Route',description:'Just a fine trace of your route'},
 {key:'refdayroute',name:'Day & route',description:'Weekday · red trace · distance'},
 {key:'refroutehero',name:'Route headline',description:'Fine route above a compact stat footer'},
 {key:'reftall',name:'Tall distance',description:'Condensed distance · pace and time'},
 {key:'reftallday',name:'Tall day',description:'Two strong lines · weekday and distance'},
 {key:'refivory',name:'Ivory stack',description:'Six readings in a quiet centred column'},
 {key:'reftoday',name:'Today',description:'A day and a single activity line'},
 {key:'refserif',name:'Serif',description:'Distance in serif type · fine pace'},
 {key:'refschedule',name:'Date & stats',description:'Day and start time beside your readings'},
 {key:'refcard',name:'Activity card',description:'Soft grey card · title and six readings'},
 {key:'refsportcard',name:'Sport card',description:'Sport icon · distance · pace and time'},
 {key:'refcaption',name:'Title & distance',description:'A simple caption with handwritten distance'},
 {key:'refsingle',name:'One reading',description:'A small caption above one stat'},
 {key:'refpair',name:'Two readings',description:'Two aligned readings and quiet captions'},
 {key:'refpairroute',name:'Readings & route',description:'Two quiet readings beside a fine route'},
 {key:'reftriple',name:'Three readings',description:'Distance, pace and time on one line'},
 {key:'refquad',name:'Four readings',description:'A balanced two by two grid'},
 {key:'refsix',name:'Six readings',description:'Three columns · two rows'},
 {key:'reflaps',name:'Splits',description:'Recorded lap paces · simple bars'},
 {key:'refbubble',name:'Message',description:'Blue activity message · recorded start time'},
 {key:'refsummary',name:'Activity sentence',description:'A quiet gold header above your activity'}
] as const;
export type ReferenceTemplate=typeof referenceActivityDesigns[number]['key'];
export const referenceRouteTemplates:ReferenceTemplate[]=['refroute','refdayroute','refroutehero','refpairroute'];
const statLimits:Record<ReferenceTemplate,number>={refsingle:1,refpair:2,reftriple:3,refquad:4,refsix:6,refhero:4,refstack:3,refweekday:1,refroute:0,refdayroute:1,refroutehero:4,reftall:3,reftallday:1,refivory:6,reftoday:1,refserif:2,refschedule:3,refcard:6,refsportcard:3,refcaption:1,reflaps:0,refpairroute:2,refbubble:2,refsummary:2};
export function referenceStatLimit(template:string){return statLimits[template as ReferenceTemplate]??6;}
const xml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const safe=(value:string)=>value&&!/^\s*(?:NaN|Infinity|undefined|null)\s*$/i.test(value)?value:'—';
const priority=['distance','pace','speed','duration','ascent','calories','hr','power','cadence'];
const labels:Record<string,string>={distance:'DISTANCE',pace:'PACE',speed:'SPEED',duration:'TIME',ascent:'ELEVATION',calories:'CALORIES',hr:'HEART RATE',power:'POWER',cadence:'CADENCE',sleep:'SLEEP',hrv:'HRV',score:'SLEEP SCORE',steps:'STEPS'};
const sportGlyphs:Record<string,string>={
 running:'<circle cx="16" cy="4" r="2"/><path d="m5 9 4-2 4 3 4 2 3-2M13 10l-3 5 5 3-1 4M10 15l-4 5H2"/>',
 cycling:'<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><circle cx="15" cy="3" r="2"/><path d="m12 7-4 5 6 2v7M12 7l4 4h4M5 17l3-5"/>',
 walking:'<circle cx="13" cy="3" r="2"/><path d="m7 11 3-4 4 1 2 5 4 1M12 8l-2 7-4 7M10 15l5 2 1 5"/>',
 strength_training:'<path d="m7 7 10 10M3 8l5-5M16 21l5-5M2 5l3-3M19 22l3-3M5 10l5-5M14 19l5-5"/>',
 swimming:'<circle cx="17" cy="7" r="2"/><path d="m4 11 5-5 5 5-3 3M2 16q2-2 4 0t4 0t4 0t4 0t4 0M2 21q2-2 4 0t4 0t4 0t4 0t4 0"/>',
 hiking:'<circle cx="13" cy="3" r="2"/><path d="m7 11 3-4 4 1 2 5h4M12 8l-2 7-4 7M10 15l5 2 1 5M20 10v12M6 7l-2 6"/>'
};

/** Compact activity clocks are intentional; data-stat-value always retains the exact source. */
export function referenceStatValue(stat:ShareStat,{compactClock=true,upper=true,distanceDecimals}:{compactClock?:boolean;upper?:boolean;distanceDecimals?:number}={}){
 let value=safe(stat.value);const unit=stat.unit;
 if(value==='—')return value;
 if(stat.key==='distance'&&unit==='km'&&distanceDecimals!==undefined){const km=Number(value.replaceAll(',',''));if(Number.isFinite(km)&&km>=0)value=km.toFixed(distanceDecimals);}
 if(stat.key==='duration'&&compactClock){
  const clock=value.split(':').map(Number);
  if(clock.every(Number.isFinite)&&((unit==='h:mm:ss'&&clock.length===3)||(unit==='min:sec'&&clock.length===2))){
   const seconds=clock.length===3?clock[0]*3600+clock[1]*60+clock[2]:clock[0]*60+clock[1];
   const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=Math.floor(seconds%60);
   const compact=h?`${h}h ${String(m).padStart(2,'0')}m`:m?`${m}m ${String(s).padStart(2,'0')}s`:`${s}s`;
   return upper?compact.toUpperCase():compact;
  }
 }
 if(unit==='min:sec'||unit==='h:mm:ss'||!unit)return value;
 if(unit==='/km')return value+(upper?'/KM':'/km');
 const shown=stat.key==='calories'?'cal':unit;
 return value+' '+(upper?shown.toUpperCase():shown);
}

export function renderReferenceShare(o:ShareDesign,{ink:oInk}:{ink?:string}={}){
 const ink=oInk??o.accent??(o.ink==='black'?'#111111':'#ffffff');
 const template=o.template as ReferenceTemplate,parts:string[]=[],cy=o.height/2;
 const ordered=o.stats.map((stat,index)=>({stat,index})).sort((a,b)=>{
  const rank=(key:string)=>{const n=priority.indexOf(key);return n<0?priority.length:n};
  return rank(a.stat.key)-rank(b.stat.key)||a.index-b.index;
 }).map(item=>item.stat);
 const hero=ordered.find(stat=>stat.key==='distance')??ordered[0];
 const support=ordered.filter(stat=>stat!==hero);
 const labelMode=shareLabelMode(o);
 const attachedDistance=(stat:ShareStat,value:string)=>stat.key==='distance'&&stat.unit==='km'?value.replace(' KM','KM'):value;
 const tag=(stat:ShareStat,body:string)=>`<g data-share-stat="true" data-share-stat-key="${xml(stat.key)}" data-stat-key="${xml(stat.key)}" data-stat-value="${xml(stat.value)}" data-stat-unit="${xml(stat.unit)}">${body}</g>`;
 function plain(value:string,x:number,y:number,size:number,width:number,{color=ink,weight=600,anchor='start',family='Arial,Helvetica,sans-serif',spacing=0}:{color?:string;weight?:number;anchor?:'start'|'middle'|'end';family?:string;spacing?:number}={}){
  // Scale the size proportionally; never squash letters to fill a box.
  const fitted=Math.min(size,width/Math.max(1,[...value].length*.57));
  return `<text x="${x}" y="${y}" fill="${color}" font-family="${family}" font-size="${fitted.toFixed(2)}" font-weight="${weight}" text-anchor="${anchor}"${spacing?` letter-spacing="${spacing}"`:''}>${xml(value)}</text>`;
 }
 const display=(value:string,x:number,y:number,width:number,height:number,face:ReferenceFace='wide',center=false,color=ink)=>referenceText(value,{x,y,width,height,face,color,align:center?'middle':'start'});
 const caption=(stat:ShareStat,x:number,y:number,width:number,color=ink)=>{
  if(labelMode==='none'||labelMode==='icons')return '';
  const label=labelMode==='short'?labels[stat.key]??stat.label.toUpperCase():shareMetricLabel(stat.key,stat.label,'full').toUpperCase();
  return `<g data-share-caption="${xml(stat.key)}" data-share-label-key="${xml(stat.key)}" data-share-label-mode="${labelMode}" data-share-label-kind="metric">${plain(label,x,y,19,width,{anchor:'middle',weight:700,color})}</g>`;
 };
 const reading=(stat:ShareStat|undefined,x:number,y:number,width:number,height:number,face:ReferenceFace='wide',center=false,options:{compactClock?:boolean;upper?:boolean;distanceDecimals?:number;color?:string}={})=>stat?tag(stat,display(attachedDistance(stat,referenceStatValue(stat,options)),x,y,width,height,face,center,options.color??ink)):'';
 const textReading=(stat:ShareStat|undefined,x:number,y:number,size:number,width:number,options:{compactClock?:boolean;upper?:boolean;distanceDecimals?:number;color?:string;anchor?:'start'|'middle'|'end'}={})=>stat?tag(stat,plain(referenceStatValue(stat,options),x,y,size,width,{anchor:options.anchor??'start',color:options.color??ink,weight:700})):'';
 const title=(x:number,y:number,width:number,size=44,color=ink)=>plain(o.title||o.sport,x,y,size,width,{color,weight:700});
 const day=(x:number,y:number,width:number,height:number,center=false)=>display((o.weekday||'').toUpperCase(),x,y,width,height,'wide',center);
 function trace(x:number,y:number,width:number,height:number,color=ink){
  const route=o.route;if(!route)return '';
  const segments=route.segments.map(segment=>segment.filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y))).filter(segment=>segment.length>1);
  const points=segments.flat();if(points.length<2)return '';
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const point of points){minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);}
  const spanX=maxX-minX,spanY=maxY-minY;if(spanX<1e-10&&spanY<1e-10)return '';
  // The references use a fine trace; an explicit user thickness still takes effect.
  const stroke=typeof o.routeStroke==='number'&&Number.isFinite(o.routeStroke)?Math.max(2,Math.min(30,o.routeStroke)):4;
  const inset=stroke/2+4,scale=Math.min((width-inset*2)/Math.max(spanX,1e-9),(height-inset*2)/Math.max(spanY,1e-9));
  const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
  return `<g data-share-route="true">${segments.map(segment=>{
   const stride=Math.max(1,Math.ceil(segment.length/3000));
   const d=segment.filter((_,i)=>i%stride===0||i===segment.length-1).map((point,i)=>`${i?'L':'M'}${(x+width/2+(point.x-centerX)*scale).toFixed(2)},${(y+height/2+(point.y-centerY)*scale).toFixed(2)}`).join(' ');
   return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('')}</g>`;
 }
 function grid(stats:ShareStat[],{x=180,y=cy-50,width=720,columns=3,rowHeight=106,valueHeight=54,color=ink}:{x?:number;y?:number;width?:number;columns?:number;rowHeight?:number;valueHeight?:number;color?:string}={}){
  const cell=width/columns;
  stats.forEach((stat,i)=>{const cx=x+(i%columns+.5)*cell,top=y+Math.floor(i/columns)*rowHeight;
   parts.push(caption(stat,cx,top,cell-22,color));
   parts.push(textReading(stat,cx,top+valueHeight+8,valueHeight,cell-22,{anchor:'middle',color,distanceDecimals:1}));
  });
 }
 if(['refsingle','refpair','reftriple','refquad','refsix'].includes(template)){
  const count=({refsingle:1,refpair:2,reftriple:3,refquad:4,refsix:6} as Record<string,number>)[template];
  const chosen=ordered.slice(0,count),columns=count===1?1:count===2||count===4?2:3,rows=Math.ceil(chosen.length/columns);
  const width=count===1?420:count===2?640:740;
  grid(chosen,{x:(1080-width)/2,y:cy-rows*55-10,width,columns,rowHeight:116,valueHeight:count>=3?48:56});
 }else if(template==='refpairroute'){
  grid(ordered.slice(0,2),{x:146,y:cy-35,width:494,columns:2,valueHeight:48});
  parts.push(trace(689,cy-113,246,226));
 }else if(template==='refbubble'){
  const chosen=ordered.slice(0,2),message=chosen.map(stat=>referenceStatValue(stat,{upper:false,distanceDecimals:1})).join(', ');
  const x=146,y=cy-96,width=788,height=152;
  const supplied=o.bubbleColor;
  const bubbleColor=supplied&&/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(supplied)?supplied:'#007aff';
  const expanded=bubbleColor.length===4?'#'+[...bubbleColor.slice(1)].map(value=>value+value).join(''):bubbleColor;
  const channels=[1,3,5].map(i=>parseInt(expanded.slice(i,i+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  const luminance=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722,bodyColor=luminance>.179?'#111111':'#ffffff';
  parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="76" fill="${bubbleColor}"/><path d="M875 ${y+116}Q911 ${y+154}944 ${y+157}Q924 ${y+135}925 ${y+100}Z" fill="${bubbleColor}"/>`);
  parts.push(chosen.reduce((body,stat)=>tag(stat,body),plain(message,540,y+99,74,width-100,{anchor:'middle',color:bodyColor,weight:400})));
  if(o.time){const verb=o.sportFamily==='running'?'Ran':o.sportFamily==='cycling'?'Rode':'Recorded';parts.push(`<g data-share-activity-time="true">${plain(verb+' '+o.time,x+width,cy+113,32,width,{anchor:'end',weight:400})}</g>`);}
 }else if(template==='refsummary'){
  const chosen=ordered.slice(0,2),first=chosen[0],second=chosen[1];
  const family=({running:'run',cycling:'ride',walking:'walk',hiking:'hike',swimming:'swim'} as Record<string,string>)[o.sportFamily??''];
  let sentence=chosen.map(stat=>stat.label.toLowerCase()+' '+referenceStatValue(stat,{upper:false,distanceDecimals:1})).join(' · ');
  if(first?.key==='distance'&&first.unit==='km'&&family){
   sentence=referenceStatValue(first,{upper:false,distanceDecimals:1}).replace(' km',' kilometre')+' '+family;
   if(second?.key==='pace')sentence+=' at '+referenceStatValue(second,{upper:false})+' pace';
   else if(second?.key==='speed')sentence+=' at '+referenceStatValue(second,{upper:false});
   else if(second)sentence+=' · '+referenceStatValue(second,{upper:false});
  }
  const lines:string[]=[],words=sentence.split(/\s+/);let line='';
  for(const word of words){const candidate=line?line+' '+word:word;if(candidate.length*55*.55>788&&line){lines.push(line);line=word;}else line=candidate;}
  if(line)lines.push(line);
  const top=cy-lines.length*66/2+5,gold='#d4a629';
  parts.push(plain(o.brand?'sieste':'Activity',146,top-39,26,500,{color:gold,weight:600}));
  if(first)parts.push(tag(first,plain(referenceStatValue(first,{upper:false,distanceDecimals:1}),934,top-39,26,300,{color:gold,anchor:'end',weight:500})));
  const body=lines.map((value,i)=>plain(value,146,top+i*66+43,55,788,{weight:700})).join('');
  parts.push(chosen.reduce((content,stat)=>tag(stat,content),body));
 }else if(template==='refhero'){
  parts.push(reading(hero,146,cy-105,788,140,'wide'));
  const shown=support.slice(0,3),width=788/Math.max(1,shown.length);
  shown.forEach((stat,i)=>parts.push(reading(stat,146+i*width,cy+56,width-16,33,'wide')));
 }else if(template==='refstack'){
  const stats=ordered.slice(0,3),lineHeight=130,top=cy-stats.length*lineHeight/2;
  parts.push(plain((o.title||o.sport).toUpperCase(),154,top-28,34,772,{weight:800}));
  stats.forEach((stat,i)=>{
   if(stat.key==='distance'&&stat.unit==='km'&&safe(stat.value)!=='—'){
    const x=154,y=top+i*lineHeight,value=safe(stat.value),box={width:700,height:108,face:'wide' as const};
    const size=referenceTextSize(value,box),unitX=x+size.width+6,unitY=y+(box.height-size.height)/2;
    parts.push(tag(stat,referenceText(value,{x,y,...box,color:ink})+`<g data-share-raised-unit="km">${referenceText('KM',{x:unitX,y:unitY,width:Math.max(1,772-size.width-6),height:size.height*.35,face:'wide',color:ink})}</g>`));
    return;
   }
   const value=stat.key==='pace'&&safe(stat.value)!=='—'?safe(stat.value).replace(':',"'")+'"':attachedDistance(stat,referenceStatValue(stat,{compactClock:stat.key!=='duration'}));
   parts.push(tag(stat,display(value,154,top+i*lineHeight,772,108,'wide')));
  });
 }else if(template==='refweekday'){
  parts.push(day(128,cy-122,824,47,true),reading(hero,128,cy-50,824,124,'wide',true));
 }else if(template==='refroute'){
  parts.push(trace(180,cy-270,720,540));
 }else if(template==='refdayroute'){
  parts.push(day(168,cy-365,744,68,true),trace(240,cy-244,600,440,'#ee1646'),reading(hero,128,cy+261,824,95,'wide',true));
 }else if(template==='refroutehero'){
  parts.push(trace(194,cy-377,692,478),reading(hero,158,cy+176,764,107,'wide',true));
  const shown=support.slice(0,3),width=764/Math.max(1,shown.length);
  shown.forEach((stat,i)=>parts.push(reading(stat,158+i*width,cy+315,width-20,29,'wide')));
 }else if(template==='reftall'){
  parts.push(reading(hero,86,cy-241,908,424,'tall',false,{distanceDecimals:1}));
  if(support[0])parts.push(reading(support[0],104,cy+232,388,61,'tall'));
  if(support[1])parts.push(reading(support[1],692,cy+232,284,61,'tall'));
 }else if(template==='reftallday'){
  parts.push(display((o.weekday||'').toUpperCase(),238,cy-319,604,233,'tall'),reading(hero,238,cy-55,604,319,'tall',false,{distanceDecimals:1}));
 }else if(template==='refivory'){
  const shown=ordered.slice(0,6),line=124,top=cy-shown.length*line/2;
  shown.forEach((stat,i)=>parts.push(textReading(stat,540,top+i*line+98,104,700,{anchor:'middle',upper:false,distanceDecimals:1})));
 }else if(template==='reftoday'){
  const dayLabel=(o as ShareDesign&{displayDay?:string}).displayDay||o.weekday||'';
  const family=({running:'run',cycling:'ride',walking:'walk',hiking:'hike',swimming:'swim'} as Record<string,string>)[o.sportFamily??''];
  const activity=hero?referenceStatValue(hero,{upper:false,distanceDecimals:1})+(hero.key==='distance'&&family?' '+family:''):o.sport;
  parts.push(plain(dayLabel,540,cy-65,82,700,{anchor:'middle',weight:700}),hero?tag(hero,plain(activity,540,cy+116,86,850,{anchor:'middle',weight:700})):plain(activity,540,cy+116,86,850,{anchor:'middle',weight:700}));
 }else if(template==='refserif'){
  if(hero)parts.push(tag(hero,display(referenceStatValue(hero,{upper:false}).replace(' km','km'),220,cy-106,640,150,'serif',true)));
  if(support[0])parts.push(textReading(support[0],540,cy+105,36,520,{anchor:'middle',upper:false}));
 }else if(template==='refschedule'){
  const x=140,top=cy-119,left=[o.weekday||'',o.date,o.time].filter((value):value is string=>!!value);
  left.slice(0,3).forEach((value,i)=>parts.push(display(value.toUpperCase(),x,top+i*68,376,46,'wide')));
  const right=ordered.slice(0,3);
  right.forEach((stat,i)=>parts.push(reading(stat,610,top+i*68,334,46,'wide')));
 }else if(template==='refcard'){
  const x=142,y=cy-212,w=796,h=424;
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="63" fill="#545454" fill-opacity=".82"/>`);
  parts.push(title(x+48,y+88,w-96,63));
  grid(ordered.slice(0,6),{x:x+48,y:y+149,width:w-96,columns:3,rowHeight:113,valueHeight:43});
 }else if(template==='refsportcard'){
  const x=145,y=cy-159,w=790,h=318;
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="66" fill="#545454" fill-opacity=".82"/>`);
  parts.push(plain(o.sport,x+58,y+78,55,w-116,{weight:700}));
  const glyph=sportGlyphs[o.sportFamily??''];
  if(glyph)parts.push(`<g data-sport-icon="${xml(o.sportFamily??'')}" transform="translate(${x+57} ${y+126}) scale(3.5)" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`);
  parts.push(textReading(hero,x+166,y+193,89,w-224,{upper:false}));
  const shown=support.slice(0,2).sort((a,b)=>a.key==='duration'?-1:b.key==='duration'?1:0);
  const sub=shown.map(stat=>referenceStatValue(stat,{upper:false})).join(' – ');
  parts.push(shown.reduce((body,stat)=>tag(stat,body),plain(sub,x+170,y+259,37,w-228,{weight:500})));
 }else if(template==='refcaption'){
  parts.push(plain((o.title||o.sport).toUpperCase(),146,cy+27,61,472,{weight:500}));
  if(hero)parts.push(tag(hero,referenceText(referenceStatValue(hero,{distanceDecimals:1}),{x:650,y:cy-42,width:284,height:85,face:'hand',color:ink,align:'end'})));
 }else if(template==='reflaps'){
  const laps=o.laps??[];
  if(!laps.length)return '';
  const count=Math.min(20,laps.length),shown=laps.slice(0,count),row=Math.min(49,790/count),top=cy-count*row/2;
  parts.push(display('LAP',212,top-45,76,25,'wide'),display(o.cycling?'KM/H':'PACE',326,top-45,172,25,'wide'));
  const metric=(lap:typeof shown[number])=>o.cycling?Number.isFinite(lap.value)&&lap.value!>=0?lap.value!*3.6:null:Number.isFinite(lap.pace)&&lap.pace!>0?lap.pace:null;
  const values=shown.map(metric).filter((value):value is number=>value!==null),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):0,range=Math.max(30,max-min);
  shown.forEach((lap,i)=>{
   const y=top+i*row,value=metric(lap),seconds=value===null?null:Math.round(value);
   const displayed=value===null?'—':o.cycling?value.toFixed(1):`${Math.floor(seconds!/60)}:${String(seconds!%60).padStart(2,'0')}`;
   const bar=value===null?0:o.cycling?78+value/Math.max(1,max)*317:118+(max-value)/range*277;
   const index=Number.isFinite(lap.index)?lap.index:i+1;
   parts.push(`<g data-share-lap="${index}" data-lap-${o.cycling?'speed':'pace'}="${value===null?'missing':value}">${display(String(index),212,y,76,row*.65,'wide')}${display(displayed,326,y,172,row*.65,'wide')}${bar?`<rect x="522" y="${y+row*.03}" width="${bar.toFixed(2)}" height="${(row*.7).toFixed(2)}" rx="2" fill="${ink}"/>`:''}</g>`);
  });
  if(laps.length>count)parts.push(plain(`FIRST ${count} OF ${laps.length} RECORDED LAPS`,540,top+count*row+32,18,800,{anchor:'middle',weight:500}));
 }
 const footerSpace:Partial<Record<ReferenceTemplate,number>>={refstack:250,refroute:270,refdayroute:356,refroutehero:344,reftall:293,reftallday:264,refivory:360,refcard:212,refsportcard:159,reflaps:395};
 let footer=cy+(footerSpace[template]??145)+52;
 if(o.date&&template!=='refschedule'){parts.push(`<g data-share-date="true">${plain(o.date,540,footer,18,850,{anchor:'middle',weight:500})}</g>`);footer+=34;}
 if(o.brand&&template!=='refsummary'){parts.push(`<g data-share-brand="true">${plain('SIESTE',540,footer,18,850,{anchor:'middle',weight:700,spacing:2})}</g>`);footer+=34;}
 if(o.demo)parts.push(`<g data-share-demo="true">${plain('ILLUSTRATIVE DATA',540,footer,16,850,{anchor:'middle',weight:600,spacing:1})}</g>`);
 return `<g data-reference-share="${template}">${parts.join('')}</g>`;
}
