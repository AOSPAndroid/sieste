import {referenceText,referenceTextSize,referenceLabelText,type ReferenceFace} from './share-reference-type';
import {resolveShareFont} from './share-fonts';
import {shareMetricLabel,shareLabelMode} from './share-labels';
import type {ShareDesign,ShareStat} from './share-card-design';

import {type ReferenceTemplate} from './share-design-catalog';
export {referenceActivityDesigns,referenceRecoveryDesigns,referenceRouteTemplates,referenceStatLimit} from './share-design-catalog';
const xml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const safe=(value:string)=>value&&!/^\s*(?:NaN|Infinity|undefined|null)\s*$/i.test(value)?value:'—';
const priority=['distance','pace','speed','duration','ascent','calories','hr','power','normalizedPower','cadence'];
const labels:Record<string,string>={distance:'DISTANCE',pace:'PACE',speed:'SPEED',duration:'TIME',ascent:'ELEVATION',calories:'CALORIES',hr:'HEART RATE',power:'POWER',normalizedPower:'NP',cadence:'CADENCE',sleep:'SLEEP',hrv:'HRV',score:'SLEEP SCORE',steps:'STEPS'};
const sportGlyphs:Record<string,string>={
 running:'<circle cx="16" cy="4" r="2"/><path d="m5 9 4-2 4 3 4 2 3-2M13 10l-3 5 5 3-1 4M10 15l-4 5H2"/>',
 cycling:'<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><circle cx="15" cy="3" r="2"/><path d="m12 7-4 5 6 2v7M12 7l4 4h4M5 17l3-5"/>',
 walking:'<circle cx="13" cy="3" r="2"/><path d="m7 11 3-4 4 1 2 5 4 1M12 8l-2 7-4 7M10 15l5 2 1 5"/>',
 strength_training:'<path d="m7 7 10 10M3 8l5-5M16 21l5-5M2 5l3-3M19 22l3-3M5 10l5-5M14 19l5-5"/>',
 swimming:'<circle cx="17" cy="7" r="2"/><path d="m4 11 5-5 5 5-3 3M2 16q2-2 4 0t4 0t4 0t4 0t4 0M2 21q2-2 4 0t4 0t4 0t4 0t4 0"/>',
 hiking:'<circle cx="13" cy="3" r="2"/><path d="m7 11 3-4 4 1 2 5h4M12 8l-2 7-4 7M10 15l5 2 1 5M20 10v12M6 7l-2 6"/>'
};
const metricGlyphs:Record<string,string>={
 sleep:'<path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/>',
 score:'<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9Z"/>',
 hrv:'<path d="M2 12h4l3-8 4 16 3-8h6"/>',
 hr:'<path d="M20 4a5 5 0 0 0-8 2 5 5 0 0 0-8-2c-4 4 0 9 8 16 8-7 12-12 8-16Z"/>',
 distance:'<path d="M3 19h18M5 19V5h14v14M5 8h4M5 12h6M5 16h4"/>',
 duration:'<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6M12 2v3M18 6l2-2"/>',
 pace:'<path d="M3 18a9 9 0 1 1 18 0M12 13l5-5M4 18h16"/><circle cx="12" cy="13" r="1"/>',
 speed:'<path d="M3 18a9 9 0 1 1 18 0M12 13l5-5M4 18h16"/><circle cx="12" cy="13" r="1"/>',
 ascent:'<path d="m2 20 7-12 4 7 3-5 6 10ZM9 8l2-4 2 4"/>',
 power:'<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
 normalizedPower:'<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
 cadence:'<path d="M6 21h12L14 3h-4ZM12 17l7-10M7 21v-3h10v3"/>',
 calories:'<path d="M12 2c4 6-1 8 3 11l3-5c6 8 2 14-6 14S2 15 7 8c0 5 4 5 5-6Z"/>',
 steps:'<ellipse cx="8" cy="8" rx="3" ry="6"/><circle cx="7" cy="18" r="2"/><ellipse cx="17" cy="12" rx="3" ry="6"/><circle cx="16" cy="22" r="1"/>'
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
 let positionedFooter:number|undefined;
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
  if(o.fontFace)return referenceLabelText(value,{x,y,size,width,face:o.fontFace,color,anchor,weight,spacing});
  // Scale the size proportionally; never squash letters to fill a box.
  const fitted=Math.min(size,width/Math.max(1,[...value].length*.57));
  return `<text x="${x}" y="${y}" fill="${color}" font-family="${family}" font-size="${fitted.toFixed(2)}" font-weight="${weight}" text-anchor="${anchor}"${spacing?` letter-spacing="${spacing}"`:''}>${xml(value)}</text>`;
 }
 const display=(value:string,x:number,y:number,width:number,height:number,face:ReferenceFace='wide',center=false,color=ink)=>referenceText(value,{x,y,width,height,face:resolveShareFont(o.fontFace,face),color,align:center?'middle':'start'});
 const caption=(stat:ShareStat,x:number,y:number,width:number,color=ink)=>{
  if(labelMode==='none'||labelMode==='icons')return '';
  const label=labelMode==='short'?stat.key==='normalizedPower'&&stat.label.startsWith('Estimated')?'EST. NP':labels[stat.key]??stat.label.toUpperCase():shareMetricLabel(stat.key,stat.label,'full').toUpperCase();
  return `<g data-share-caption="${xml(stat.key)}" data-share-label-key="${xml(stat.key)}" data-share-label-mode="${labelMode}" data-share-label-kind="metric">${plain(label,x,y,19,width,{anchor:'middle',weight:700,color})}</g>`;
 };
 const reading=(stat:ShareStat|undefined,x:number,y:number,width:number,height:number,face:ReferenceFace='wide',center=false,options:{compactClock?:boolean;upper?:boolean;distanceDecimals?:number;color?:string}={})=>stat?tag(stat,display(attachedDistance(stat,referenceStatValue(stat,options)),x,y,width,height,face,center,options.color??ink)):'';
 const textReading=(stat:ShareStat|undefined,x:number,y:number,size:number,width:number,options:{compactClock?:boolean;upper?:boolean;distanceDecimals?:number;color?:string;anchor?:'start'|'middle'|'end'}={})=>stat?tag(stat,plain(referenceStatValue(stat,options),x,y,size,width,{anchor:options.anchor??'start',color:options.color??ink,weight:700})):'';
 const title=(x:number,y:number,width:number,size=44,color=ink)=>plain(o.title||o.sport,x,y,size,width,{color,weight:700});
 const day=(x:number,y:number,width:number,height:number,center=false)=>display((o.weekday||'').toUpperCase(),x,y,width,height,'wide',center);
 const rule=(x1:number,y1:number,x2:number,y2:number)=>`<path data-share-rule="true" d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${ink}" stroke-width="1.5" stroke-opacity=".4"/>`;
 const icon=(key:string,x:number,y:number,size=30,sport=false)=>{
  if(labelMode==='none')return '';
  const glyph=sport?sportGlyphs[key]:metricGlyphs[key];if(!glyph)return '';
  const kind=sport?'sport':['sleep','score','hrv','hr'].includes(key)?'health':'metric';
  return `<g data-${kind}-icon="${xml(key)}" data-share-cue-key="${xml(key)}" transform="translate(${x} ${y}) scale(${size/24})" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`;
 };
 const minimalCaption=(stat:ShareStat,x:number,y:number,width:number)=>labelMode==='icons'?icon(stat.key,x-14,y-23,28):caption(stat,x,y,width);
 const sportMark=(x:number,y:number,size=36,family=o.sportFamily)=>icon(family??'',x,y,size,true);
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
 if(template==='refrail'){
  parts.push(sportMark(126,cy-231,40),reading(hero,126,cy-161,828,136),rule(126,cy+9,954,cy+9));
  const shown=support.slice(0,3),cell=828/Math.max(1,shown.length);
  shown.forEach((stat,i)=>{const x=126+i*cell;parts.push(reading(stat,x,cy+47,cell-24,48),minimalCaption(stat,x+(cell-24)/2,cy+135,cell-24));});
 }else if(template==='refduet'){
  const shown=ordered.slice(0,2),cell=848/Math.max(1,shown.length);
  parts.push(sportMark(522,cy-175,36));
  shown.forEach((stat,i)=>{const x=116+i*cell;parts.push(reading(stat,x+25,cy-86,cell-50,101,'wide',true),minimalCaption(stat,x+cell/2,cy+88,cell-50));});
  if(shown.length===2)parts.push(rule(540,cy-91,540,cy+112));
 }else if(template==='refledger'){
  const shown=ordered.slice(0,3),top=cy-shown.length*61;
  parts.push(sportMark(126,top-69,34));
  shown.forEach((stat,i)=>{
   const y=top+i*122;
   parts.push(minimalCaption(stat,184,y+58,134),tag(stat,referenceText(referenceStatValue(stat,{upper:false}),{x:288,y:y+9,width:642,height:70,face:resolveShareFont(o.fontFace,'wide'),color:ink,align:'end'})));
   if(i<shown.length-1)parts.push(rule(126,y+105,954,y+105));
  });
 }else if(template==='refcompactroute'){
  parts.push(trace(108,cy-186,448,372),rule(602,cy-167,602,cy+167),sportMark(654,cy-203,34),reading(hero,654,cy-139,318,84));
  support.slice(0,2).forEach((stat,i)=>{const y=cy-7+i*107;parts.push(reading(stat,654,y,318,51),minimalCaption(stat,813,y+81,318));});
 }else if(template==='refsplitline'){
  parts.push(sportMark(126,cy-232,38),reading(hero,126,cy-164,828,126));
  const shown=(o.laps??[]).slice(0,16),metrics=shown.map(lap=>o.cycling?typeof lap.value==='number'&&Number.isFinite(lap.value)&&lap.value>=0?lap.value*3.6:null:typeof lap.pace==='number'&&Number.isFinite(lap.pace)&&lap.pace>0?lap.pace:null);
  const values=metrics.filter((value):value is number=>value!==null),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):0;
  if(shown.length){
   const cell=828/shown.length,range=Math.max(1,max-min),baseline=cy+80;
   parts.push(rule(126,baseline,954,baseline));
   shown.forEach((lap,i)=>{
    const value=metrics[i],height=value===null?0:24+(o.cycling?(value-min)/range:(max-value)/range)*54,index=Number.isFinite(lap.index)?lap.index:i+1;
    parts.push(`<g data-share-lap="${index}" data-lap-${o.cycling?'speed':'pace'}="${value===null?'missing':value}">${height?`<rect data-share-lap-bar="true" x="${(126+i*cell).toFixed(2)}" y="${(baseline-height).toFixed(2)}" width="${Math.max(1,cell-4).toFixed(2)}" height="${height.toFixed(2)}" fill="${ink}"/>`:''}</g>`);
   });
  }else parts.push(rule(126,cy+31,954,cy+31));
  support.slice(0,2).forEach((stat,i)=>{const x=126+i*430;parts.push(reading(stat,x,cy+121,398,42),minimalCaption(stat,x+199,cy+211,398));});
 }else if(template==='refcorner'){
  const y=o.height-388;
  parts.push(sportMark(102,y-50,34),reading(hero,102,y+8,706,107),rule(102,y+147,798,y+147));
  support.slice(0,2).forEach((stat,i)=>{const x=102+i*358;parts.push(reading(stat,x,y+182,334,40),minimalCaption(stat,x+167,y+268,334));});
  positionedFooter=o.height-90;
 }else if(template==='refrecoveryline'||template==='refrecoverystack'){
  const health=o.dayHealth??{},valid=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
  const minutes=valid(health.sleep)?Math.round(health.sleep/60):null;
  const healthStats:ShareStat[]=[
   {key:'sleep',label:'Sleep',value:minutes===null?'—':`${Math.floor(minutes/60)}h${String(minutes%60).padStart(2,'0')}`,unit:''},
   {key:'hrv',label:'HRV',value:valid(health.hrv)&&health.hrv>0?String(Math.round(health.hrv)):'—',unit:'ms'},
   {key:'score',label:'Sleep score',value:valid(health.score)&&health.score<=100?String(Math.round(health.score)):'—',unit:'/100'}
  ];
  const history=(health.history??[]).slice(-7),sessions=o.recoveryOnly?[]:(o.dayCards??[]).filter(card=>!!card.sportFamily);
  const healthHeight=template==='refrecoveryline'?318:444,contentHeight=healthHeight+sessions.length*119,scale=Math.min(1,(o.height-296)/Math.max(1,contentHeight)),top=cy-contentHeight*scale/2;
  positionedFooter=top+contentHeight*scale+38;
  parts.push(`<g data-share-recovery-layout="${template}" transform="translate(${((1080-1080*scale)/2).toFixed(3)} ${top.toFixed(3)}) scale(${scale.toFixed(6)})">`);
  function spark(key:'sleep'|'hrv'|'score',x:number,y:number,width:number,height:number){
   const usable=(value:unknown):value is number=>valid(value)&&(key!=='hrv'||value>0)&&(key!=='score'||value<=100);
   const values=history.map(row=>row[key]),known=values.filter(usable);
   if(!known.length)return `<g data-share-history="${key}" data-history-count="0"/>`;
   const min=Math.min(...known),max=Math.max(...known),padding=Math.max((max-min)*.15,key==='sleep'?.1:key==='score'?1:2),span=max-min+padding*2;
   const positions=values.map((value,i)=>usable(value)?{x:x+i*width/Math.max(1,history.length-1),y:y+height-(value-min+padding)/span*height,value}:null);
   let d='',previous=false;
   positions.forEach(point=>{if(point){d+=`${previous?'L':'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)} `;previous=true;}else previous=false;});
   return `<g data-share-history="${key}" data-history-count="${known.length}" data-history-slots="${history.length}"><path d="${d.trim()}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${positions.map((point,i)=>point?`<circle data-history-date="${xml(history[i].date)}" data-history-value="${point.value}" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${i===positions.length-1?4.5:2.3}" fill="${ink}"/>`:'').join('')}</g>`;
  }
  if(template==='refrecoveryline'){
   healthStats.forEach((stat,i)=>{
    const x=108+i*288;
    parts.push(minimalCaption(stat,x+132,34,248),reading(stat,x+8,81,248,68,'wide',true,{upper:false}),spark(stat.key as 'sleep'|'hrv'|'score',x+25,190,214,59));
   });
  }else{
   const sleep=healthStats[0];
   parts.push(minimalCaption(sleep,239,36,268),reading(sleep,108,74,612,131,'wide',false,{upper:false}),spark('sleep',760,110,200,82),rule(108,245,972,245));
   healthStats.slice(1).forEach((stat,i)=>{const x=108+i*450;parts.push(minimalCaption(stat,x+164,293,328),reading(stat,x,324,328,67,'wide',true,{upper:false}),spark(stat.key as 'hrv'|'score',x+357,333,63,45));});
  }
  sessions.forEach((session,i)=>{
   const y=healthHeight+i*119;
   parts.push(`<g data-share-day-activity="${i}" data-share-sport="${xml(session.sportFamily??'')}">`,rule(108,y-17,972,y-17),sportMark(108,y+12,32,session.sportFamily));
   session.stats.slice(0,3).forEach((stat,j)=>parts.push(reading(stat,171+j*267,y+12,246,44,'wide',false,{upper:false})));
   parts.push('</g>');
  });
  parts.push('</g>');
 }else if(['refsingle','refpair','reftriple','refquad','refsix'].includes(template)){
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
    const x=154,y=top+i*lineHeight,value=safe(stat.value),box={width:700,height:108,face:resolveShareFont(o.fontFace,'wide')};
    const size=referenceTextSize(value,box),unitX=x+size.width+6,unitY=y+(box.height-size.height)/2;
    parts.push(tag(stat,referenceText(value,{x,y,...box,color:ink})+`<g data-share-raised-unit="km">${referenceText('KM',{x:unitX,y:unitY,width:Math.max(1,772-size.width-6),height:size.height*.35,face:box.face,color:ink})}</g>`));
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
  if(hero)parts.push(tag(hero,referenceText(referenceStatValue(hero,{distanceDecimals:1}),{x:650,y:cy-42,width:284,height:85,face:resolveShareFont(o.fontFace,'hand'),color:ink,align:'end'})));
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
 const footerSpace:Partial<Record<ReferenceTemplate,number>>={refrail:164,refledger:193,refcompactroute:214,refsplitline:185,refstack:250,refroute:270,refdayroute:356,refroutehero:344,reftall:293,reftallday:264,refivory:360,refcard:212,refsportcard:159,reflaps:395};
 let footer=positionedFooter??cy+(footerSpace[template]??145)+52;
 if(o.date&&template!=='refschedule'){parts.push(`<g data-share-date="true">${plain(o.date,540,footer,18,850,{anchor:'middle',weight:500})}</g>`);footer+=34;}
 if(o.brand&&template!=='refsummary'){parts.push(`<g data-share-brand="true">${plain('SIESTE',540,footer,18,850,{anchor:'middle',weight:700,spacing:2})}</g>`);footer+=34;}
 if(o.demo)parts.push(`<g data-share-demo="true">${plain('ILLUSTRATIVE DATA',540,footer,16,850,{anchor:'middle',weight:600,spacing:1})}</g>`);
 return `<g data-reference-share="${template}">${parts.join('')}</g>`;
}
