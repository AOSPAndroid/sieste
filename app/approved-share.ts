import {cinematicText} from './cinematic-type';
import type {ShareDesign,ShareStat} from './share-card-design';

export const approvedActivityDesigns=[
 {key:'approvedrun',name:'Café run · original',description:'The original yellow running sticker',color:'#ffdf00'},
 {key:'approvedride',name:'Club ride · original',description:'The original ivory cycling sticker',color:'#fff4d5'}
] as const;
export const approvedRecoveryDesigns=[
 {key:'approvedrecovery',name:'Blue recovery · original',description:'The original glossy blue recovery sticker',color:'#b7ddf2'}
] as const;
type Helpers={ink:string;route:(x:number,y:number,w:number,h:number,stroke?:number,inset?:number)=>string};
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const known=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const clock=(stat:ShareStat)=>{
 const numbers=stat.value.split(':').map(Number);
 if(numbers.length===3&&numbers.every(Number.isFinite))return `${numbers[0]}h${String(numbers[1]).padStart(2,'0')}`;
 return stat.value;
};

/** Three compact original compositions, with live readings and vector sticker materials. */
export function renderApprovedShare(o:ShareDesign,helpers:Helpers){
 const recovery=o.template==='approvedrecovery',ride=o.template==='approvedride',finished=!!o.finish&&o.finish!=='solid';
 const original=!finished&&o.accent.toLowerCase()===(recovery?'#b7ddf2':ride?'#fff4d5':'#ffdf00');
 const face=finished?helpers.ink:original?(recovery?'url(#approvedBlue)':ride?'#fff4d5':'#ffdf00'):helpers.ink;
 const shadow=recovery?'#1453dd':ride?'#181653':'#e72620';
 const rim=finished?helpers.ink:recovery?'#389ee9':shadow,light=recovery?'#e8fbff':ride?'#fffdfa':'#fff38a';
 const parts:string[]=[];
 const blueStops='<stop offset="0" stop-color="#ebffff"/><stop offset=".20" stop-color="#b4f2ff"/><stop offset=".62" stop-color="#69c8f5"/><stop offset=".85" stop-color="#72dafc"/><stop offset="1" stop-color="#259aeb"/>';
 // Filtering the painted group keeps these inset lights in canvas coordinates,
 // after each font outline's native upward-y transform has been applied.
 const bevel=(id:string,size:number)=>`<filter id="${id}" x="-15%" y="-30%" width="130%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${size*.62}" result="soft"/><feOffset in="soft" dx="${-size*.64}" dy="${-size*.9}" result="lowerOffset"/><feComposite in="SourceAlpha" in2="lowerOffset" operator="out" result="lowerEdge"/><feFlood flood-color="${original?'#0789df':'#111827'}" flood-opacity=".52" result="shade"/><feComposite in="shade" in2="lowerEdge" operator="in" result="lowerShade"/><feOffset in="soft" dx="${size*.8}" dy="${size}" result="upperOffset"/><feComposite in="SourceAlpha" in2="upperOffset" operator="out" result="upperEdge"/><feFlood flood-color="#f0fdff" flood-opacity=".86" result="light"/><feComposite in="light" in2="upperEdge" operator="in" result="upperLight"/><feGaussianBlur in="SourceAlpha" stdDeviation="${size*.12}" result="rimSoft"/><feOffset in="rimSoft" dx="${size*.2}" dy="${size*.26}" result="rimOffset"/><feComposite in="SourceAlpha" in2="rimOffset" operator="out" result="rimEdge"/><feFlood flood-color="#ffffff" flood-opacity=".82" result="specular"/><feComposite in="specular" in2="rimEdge" operator="in" result="specularRim"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="lowerShade"/><feMergeNode in="upperLight"/><feMergeNode in="specularRim"/></feMerge></filter>`;
 parts.push(`<defs><linearGradient id="approvedBlue" x1="0" y1="0" x2=".20" y2="1">${blueStops}</linearGradient><linearGradient id="approvedBlueType" x1="0" y1="1" x2=".20" y2="0">${blueStops}</linearGradient>${recovery?bevel('approvedBevel',8)+bevel('approvedBevelSmall',3):''}</defs>`);
 // The approved square compositions stay together when exported to taller canvases.
 const top=(o.height-1080)/2;
 parts.push(`<g data-approved-design="${o.template}" transform="translate(0 ${top})">`);
 const guarded=(body:string)=>original?`<g data-approved-material="true">${body}</g>`:body;
 const paintShape=(shape:string,{depth=12,stroke=3,gloss=recovery,front=face,edgeColor=rim}:{depth?:number;stroke?:number;gloss?:boolean;front?:string;edgeColor?:string}={})=>{
  const widened=(amount:number)=>shape.replace(/stroke-width="([\d.]+)"/g,(_,width)=>`stroke-width="${Number(width)+amount}"`);
  const paint=(body:string,fill:string,width:number)=>`<g fill="${fill}" stroke="${fill}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill">${body}</g>`;
  // Connected, protected extrusion. Wide icon strokes retain their filled silhouettes.
  const extrusion=`<g data-approved-shadow="true" aria-hidden="true">${[1,.66,.33].map(step=>`<g transform="translate(${depth*.64*step} ${depth*step})">${paint(widened(stroke*2+2),shadow,stroke*2+2)}</g>`).join('')}</g>`;
  const rounding=recovery?1.4:Math.min(3,stroke*.7);
  const edge=paint(widened(stroke*2),edgeColor,stroke*2)+paint(shape,front,rounding);
  const glossShape=shape.replace(/stroke-width="[\d.]+"/g,'stroke-width="2"');
  const highlight=gloss&&!recovery?`<g transform="translate(-1.1 -1.1)" fill="none" stroke="${light}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" opacity=".78">${glossShape}</g>`:'';
  const frontLayer=gloss&&recovery?`<g filter="url(#${depth>=7?'approvedBevel':'approvedBevelSmall'})">${edge}</g>`:edge;
  return extrusion+guarded(frontLayer+highlight);
 };
 // Glyphs are positioned in canvas coordinates; a rightward shear matches the soft italic reference.
 const letter=(value:string,x:number,y:number,width:number,height:number,depth=12,italic=true)=>{
  if(value==='—')return `<g data-cinematic-face="approved" data-cinematic-text="—"><title>—</title><path d="M${x+width/2-20} ${y+height/2}h40" fill="none" stroke="${face==='url(#approvedBlue)'?'#69c8f5':face}" stroke-width="3" stroke-linecap="round"/></g>`;
  const glyph=cinematicText(value,{x,y,width,height,face:'approved',color:face,stretch:true});
  const shape=glyph.replace(/ fill="[^"]*"| data-cinematic-[\w-]+="[^"]*"| aria-label="[^"]*"|<title>[^<]*<\/title>/g,'').replace(/<path /g,'<path vector-effect="non-scaling-stroke" ');
  const shear=italic?` transform="matrix(1 0 -0.19 1 ${(y+height)*.19} 0)"`:'';
  const outlined=paintShape(shape,{depth,stroke:Math.max(1.3,Math.min(4,height*.025)),...(face==='url(#approvedBlue)'?{front:'url(#approvedBlueType)'}:{})});
  return `<g data-approved-letter="true" data-cinematic-face="approved" data-cinematic-text="${xml(value)}" aria-label="${xml(value)}"${shear}><title>${xml(value)}</title>${outlined}</g>`;
 };
 const stat=(s:ShareStat,body:string)=>`<g data-share-stat-key="${xml(s.key)}" data-stat-value="${xml(s.value)}" data-stat-unit="${xml(s.unit)}">${body}</g>`;
 const signature=(y:number)=>o.brand?`<g data-approved-brand="true">${letter('sieste',443,y,194,55,5)}</g>`:'';
 const runner='<circle cx="577" cy="206" r="26"/><path d="M551 257 512 285 490 331" fill="none" stroke-width="32"/><path d="M551 257 596 282 626 248" fill="none" stroke-width="32"/><path d="m551 257-24 70 41 37-35 50" fill="none" stroke-width="39"/><path d="m527 327-45 39-43 10" fill="none" stroke-width="35"/>';
 const bicycle='<circle cx="427" cy="301" r="68" fill="none" stroke-width="16"/><circle cx="646" cy="301" r="68" fill="none" stroke-width="16"/><path d="m427 301 70-115 70 115H427m70-115h96l53 115M567 301l26-115 20-43h40M473 174h55" fill="none" stroke-width="15"/>';
 const icon=(family:string,shape:string)=>`<g data-sport-icon="${family}" data-approved-filled-icon="true"${family==='cycling'?' transform="translate(100 33) scale(.82)"':''}>${paintShape(shape,{depth:8,stroke:3,gloss:false})}</g>`;
 if(!recovery){
  const distance=o.stats.find(s=>s.key==='distance'),duration=o.stats.find(s=>s.key==='duration'),motion=o.stats.find(s=>s.key===(ride?'speed':'pace'));
  parts.push(icon(ride?'cycling':'running',ride?bicycle:runner));
  if(distance){
   const narrow=distance.value.length>6,numberWidth=ride?850:narrow?754:780,numberX=ride?106:48,numberY=ride?394:423,numberH=ride?248:282;
   parts.push(stat(distance,`<g data-approved-hero="true">${letter(distance.value,numberX,numberY,numberWidth,numberH,18)}</g><g data-approved-unit="${ride?'below-right':'inline'}">${letter(distance.unit||'km',ride?662:826,ride?642:577,ride?264:186,ride?122:120,11)}</g>`));
  }else parts.push(letter('—',150,ride?402:445,780,240));
  if(ride&&o.route){
   const path=helpers.route(234,673,286,89,12,10);
   if(path)parts.push(`<g data-share-route="true"><g data-approved-shadow="true" aria-hidden="true" transform="translate(4 5)">${path.replace(/stroke="[^"]*"/g,`stroke="${shadow}"`)}</g>`+guarded(`<g>${path.replace(/stroke="[^"]*"/g,`stroke="${face}"`)}</g>`)+`</g>`);
  }
  const supportY=ride?804:723,supportH=ride?79:93,supports=[duration,motion].filter((s):s is ShareStat=>!!s);
  if(supports.length===2){
   const left=duration!,right=motion!,leftText=clock(left),rightText=right.value+right.unit;
   const totalUnits=leftText.length+rightText.length+.85,w=ride?760:744,leftW=w*leftText.length/totalUnits,rightW=w*rightText.length/totalUnits,dotW=w*.85/totalUnits,x=(1080-w)/2;
   parts.push(stat(left,letter(leftText,x,supportY,leftW,supportH,7)),ride?'':paintShape(`<circle cx="${x+leftW+dotW*.5}" cy="${supportY+supportH*.6}" r="11"/>`,{depth:5,stroke:2,gloss:false}),stat(right,letter(rightText,x+leftW+dotW,supportY,rightW,supportH,7)));
  }else if(supports[0]){
   const s=supports[0],value=s.key==='duration'?clock(s):s.value+(s.unit==='/km'?'/km':s.unit?' '+s.unit:'');parts.push(stat(s,letter(value,250,supportY,580,supportH,7)));
  }
  parts.push(signature(ride?933:847));
 }else{
  const health=o.dayHealth??{},sleep=known(health.sleep)?health.sleep:null,hrv=known(health.hrv)&&health.hrv>0?health.hrv:null,score=known(health.score)&&health.score<=100?health.score:null;
  const sleepMinutes=sleep===null?null:Math.round(sleep/60),sleepValue=sleepMinutes===null?'—':`${Math.floor(sleepMinutes/60)}h${String(sleepMinutes%60).padStart(2,'0')}`;
  const moon='<path d="M579 172c-70 3-119 56-107 110 13 60 77 90 127 66 25-12 37-32 45-57-40 13-72-6-79-30-8-28-2-58 14-89Z"/>';
  const pulse='<path d="M247 623h44l22-31 20 80 20-57 15 24h49" fill="none" stroke-width="21"/>';
  const star='<path d="m751 585 19 39 43 6-31 30 7 43-38-20-38 20 7-43-31-30 43-6Z"/>';
  parts.push(`<g data-health-icon="sleep" data-approved-filled-icon="true" transform="translate(110 26) scale(.8)">${paintShape(moon,{depth:12,stroke:3})}</g>`);
  parts.push(`<g data-approved-health-key="sleep" data-health-value="${sleep??''}">${letter(sleepValue,181,349,724,230,18)}</g>`);
  parts.push(`<g data-health-icon="hrv" data-approved-filled-icon="true">${paintShape(pulse,{depth:7,stroke:3})}</g>`,`<g data-health-icon="score" data-approved-filled-icon="true">${paintShape(star,{depth:7,stroke:3})}</g>`);
  parts.push(`<g data-approved-health-key="hrv" data-health-value="${hrv??''}">${hrv===null?letter('—',106,717,408,98):letter(String(Math.round(hrv)),106,717,hrv>=100?244:210,98,9)+letter('ms',hrv>=100?362:324,745,151,70,6)}</g>`);
  parts.push(`<g data-approved-health-key="score" data-health-value="${score??''}">${letter(score===null?'—':`${Math.round(score)}/100`,570,717,414,98,9)}</g>`);
  const history=(health.history??[]).slice(-7);
  const chart=(key:'hrv'|'score',x:number,w:number)=>{
   const valid=(value:unknown):value is number=>known(value)&&(key==='hrv'?value>0:value<=100),values=history.map(row=>row[key]),recorded=values.filter(valid),low=recorded.length?Math.min(...recorded):0,high=recorded.length?Math.max(...recorded):1,base=878,amplitude=25,step=w/Math.max(1,values.length-1);
   let path='',previous=false,dots='';
   values.forEach((value,index)=>{if(!valid(value)){previous=false;return;}const xx=x+index*step,yy=base-(high===low?.5:(value-low)/(high-low))*amplitude;
    path+=(previous?'L':'M')+xx+' '+yy+' ';previous=true;
    dots+=`<g data-history-value="${value}" data-history-date="${xml(history[index].date)}" data-history-index="${index}">${paintShape(`<circle cx="${xx}" cy="${yy}" r="8"/>`,{depth:3,stroke:1.7})}</g>`;
   });
   const trace=path?paintShape(`<path data-history-segment="true" d="${path.trim()}" fill="none" stroke-width="5"/>`,{depth:2,stroke:2}):'';
   return `<g data-approved-history-key="${key}">${trace}${dots}</g>`;
  };
  parts.push(chart('hrv',104,376),chart('score',578,377),signature(922));
 }
 if(o.demo)parts.push(`<g data-approved-demo="true">${cinematicText('demo',{x:480,y:1020,width:120,height:16,face:'approved',color:face,align:'middle'})}</g>`);
 parts.push('</g>');return parts.join('');
}
