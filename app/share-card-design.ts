import {cinematicText,cinematicTitleLines,type DisplayFace} from './cinematic-type';
import type {routeGeometry} from './route-geometry';
import {retroActivityDesigns,retroRecoveryDesigns,renderRetroShare} from './retro-share';
export {retroActivityDesigns,retroRecoveryDesigns} from './retro-share';
import {approvedActivityDesigns,approvedRecoveryDesigns,renderApprovedShare} from './approved-share';
import {shareMetricLabel,shareLabelMode,type ShareLabelMode} from './share-labels';
import {finishShareLettering} from './share-lettering';
export {approvedActivityDesigns,approvedRecoveryDesigns} from './approved-share';
export const shareSolidColours=[
 {color:'#ef3340',name:'Route red'}, {color:'#990F16',name:'Blood red'},
 {color:'#0B1F5E',name:'Deep blue'}, {color:'#4169E1',name:'Royal blue'},
 {color:'#064E3B',name:'Dark green'}, {color:'#4f46e5',name:'Indigo'},
 {color:'#60a5fa',name:'Electric blue'}, {color:'#b99aff',name:'Lavender'},
 {color:'#fb923c',name:'Tangerine'}, {color:'#f472b6',name:'Pink'},
 {color:'#4A0612',name:'Oxblood'}, {color:'#B64624',name:'Burnt orange'},
 {color:'#241139',name:'Midnight violet'}, {color:'#123E45',name:'Petrol teal'},
 {color:'#C8A45D',name:'Antique gold'}, {color:'#F3E8D0',name:'Warm ivory'},
 {color:'#F4D35E',name:'Film yellow'}, {color:'#B7DDF2',name:'Ice blue'},
 {color:'#ffdf00',name:'Café yellow'}, {color:'#fff4d5',name:'Club ivory'}
] as const;
export function shareColourContrast(colour:string){
 const rgb=[1,3,5].map(i=>parseInt(colour.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#111111':'#ffffff';
}
export const shareFinishes=[
 {key:'chrome',name:'Silver chrome',colors:['#ffffff','#c8d0dc','#faffff','#9099a8','#252b37','#535e70','#e6edf6','#ffffff','#8993a3']},
 {key:'gold',name:'Champagne gold',colors:['#fff9dd','#d8b96e','#fff5c7','#bd8d36','#644317','#9b712a','#f5d995','#fff5d6','#bf9647']},
 {key:'rose',name:'Rose gold',colors:['#fff3ef','#dbb2ac','#ffe8de','#bb7c7a','#623e48','#a46472','#efc5bd','#fff0e9','#c1888a']},
 {key:'copper',name:'Burnished copper',colors:['#ffeede','#cf926d','#ffdbb8','#b66b44','#592f26','#985033','#e9b08a','#ffe6ca','#b97851']},
 {key:'titanium',name:'Titanium violet',colors:['#f4edff','#aca0cd','#eee4ff','#837898','#353148','#645974','#ccc0e6','#faf1ff','#9282ad']},
 {key:'midnight',name:'Midnight blue',colors:['#e2efff','#7b9fc9','#dceaff','#546f9d','#152842','#35547d','#9ab9e2','#eff6ff','#567ca9']},
 {key:'iridescent',name:'Iridescent pearl',colors:['#fff1ff','#a9e4ec','#f2e7ff','#c29bd9','#555889','#629cb5','#e7c4ef','#fff8dc','#9ed3d5']},
 {key:'rainbow',name:'Rainbow spectrum',colors:['#ff638f','#ffab55','#fff09a','#80e2a5','#268eb5','#5795eb','#a0a5ff','#f3bdff','#d775db']}
] as const;
export type ShareFinish='solid'|typeof shareFinishes[number]['key'];
export const finishSwatch=(colors:readonly string[])=>'linear-gradient(165deg,'+colors.map((c,i)=>c+' '+[0,18,39,48,50,61,76,88,100][i]+'%').join(',')+')';
export const routeStatDesigns=[
 {key:'traceposter',name:'Trace poster',description:'Thick route · bold headline · all your stats'},
 {key:'tracesplit',name:'Trace split',description:'Large route beside a cinematic stat column'},
 {key:'traceheadline',name:'Trace headline',description:'Huge headline · thick route · stat grid'},
 {key:'tracefooter',name:'Trace footer',description:'Route and stats below · room for your photo'},
 {key:'tracescorecard',name:'Trace scorecard',description:'Thick route · six equally bold readings'},
 {key:'tracestamp',name:'Trace stamp',description:'Framed route · slab-serif headline · stats'}
] as const;
export type ShareTemplate=typeof approvedActivityDesigns[number]['key']|typeof approvedRecoveryDesigns[number]['key']|typeof retroActivityDesigns[number]['key']|typeof retroRecoveryDesigns[number]['key']|typeof routeStatDesigns[number]['key']|'cinemamonolith'|'cinemaepic'|'cinemawide'|'cinemamission'|'cinemalens'|'cinemawave'|'routegiant'|'cinemabig'|'cinemaday'|'cinematitle'|'cinematrace'|'cinemaserif'|'cinemastack'|'editorial'|'route'|'split'|'signature'|'serif'|'laps'|'bib'|'strip'|'outline'|'receipt'|'chrono'|'hollow'|'scorecard'|'margin'|'caption'|'routebadge'|'panorama'|'bubble'|'wide'|'weekday'|'glass'|'weekbold'|'weekchart'|'daystack'|'daytrends'|'daycolumns'|'daybars'|'daypanels'|'dayline'|'daytype'|'daytiles'|'dayledger'|'daybalance'|'daypulse'|'dayrings'|'dayribbon'|'dayposter'|'daymatrix'|'velocity'|'ghost'|'routefile'|'ticket'|'monolith'|'podium'|'halo'|'capsule'|'diamond'|'seal'|'orbit'|'metro'|'metroen'|'sweatreceipt'|'sweatreceipten'|'excuse'|'excuseen'|'croissant'|'chrome'|'chromebadge'|'chromeoutline'|'chromeheadline';
export const routeStatTemplates:ShareTemplate[]=routeStatDesigns.map(design=>design.key);
export const routeTemplates:ShareTemplate[]=[...routeStatTemplates,'routegiant','cinematrace','route','outline','routebadge','panorama','weekday','routefile','halo','capsule','diamond','seal','orbit','chromebadge'];
export type ShareStat={key:string;label:string;value:string;unit:string};
export type ShareDesign={height:number;template:ShareTemplate;transparent:boolean;showLabels?:boolean;labelMode?:ShareLabelMode;textThickness?:number;routeStroke?:number;finish?:ShareFinish;ink:'white'|'black';accent:string;title:string;sport:string;sportFamily?:string;date:string;stats:ShareStat[];route:ReturnType<typeof routeGeometry>;brand:boolean;demo:boolean;laps?:{index:number;value:number|null;pace:number|null}[];cycling?:boolean;weekday?:string;time?:string;recoveryOnly?:boolean;dayCards?:{title:string;sportFamily?:string;stats:ShareStat[]}[];dayHealth?:{sleep?:number;score?:number;hrv?:number;hrvRange?:[number,number];history?:{date:string;sleep:number|null;score:number|null;hrv:number|null}[]};dayMix?:{label:string;seconds:number;color:string}[];dayCoverage?:{covered:number;total:number};weekDays?:{label:string;value:number|null}[]};
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
// Small vector pictograms remain crisp in PNG exports and need no emoji fonts.
const sportGlyphs:Record<string,string>={
 running:'<circle cx="16" cy="4" r="2"/><path d="m5 9 4-2 4 3 4 2 3-2M13 10l-3 5 5 3-1 4M10 15l-4 5H2"/>',
 cycling:'<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><circle cx="15" cy="3" r="2"/><path d="m12 7-4 5 6 2v7M12 7l4 4h4M5 17l3-5"/>',
 strength_training:'<path d="m7 7 10 10M3 8l5-5M16 21l5-5M2 5l3-3M19 22l3-3M5 10l5-5M14 19l5-5"/>',
 swimming:'<circle cx="17" cy="7" r="2"/><path d="m4 11 5-5 5 5-3 3M2 16q2-2 4 0t4 0t4 0t4 0t4 0M2 21q2-2 4 0t4 0t4 0t4 0t4 0"/>',
 walking:'<circle cx="13" cy="3" r="2"/><path d="m7 11 3-4 4 1 2 5 4 1M12 8l-2 7-4 7M10 15l5 2 1 5"/>',
 hiking:'<circle cx="13" cy="3" r="2"/><path d="m7 11 3-4 4 1 2 5h4M12 8l-2 7-4 7M10 15l5 2 1 5M20 10v12M6 7l-2 6"/>',
 misc:'<path d="M3 12h4l3-8 4 16 3-8h4"/>'
};
const healthGlyphs:Record<string,string>={
 sleep:'<path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/>',
 score:'<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9Z"/>',
 hrv:'<path d="M2 12h4l3-8 4 16 3-8h6"/>',
 heartrate:'<path d="M20 4a5 5 0 0 0-8 2 5 5 0 0 0-8-2c-4 4 0 9 8 16 8-7 12-12 8-16Z"/>',
 calories:'<path d="M12 2c4 6-1 8 3 11l3-5c6 8 2 14-6 14S2 15 7 8c0 5 4 5 5-6Z"/>',
 steps:'<ellipse cx="8" cy="8" rx="3" ry="6"/><circle cx="7" cy="18" r="2"/><ellipse cx="17" cy="12" rx="3" ry="6"/><circle cx="16" cy="22" r="1"/>'
};
const metricGlyphs:Record<string,string>={
 ...healthGlyphs,hr:healthGlyphs.heartrate,rhr:healthGlyphs.heartrate,
 distance:'<path d="M3 19h18M5 19V5h14v14M5 8h4M5 12h6M5 16h4"/>',
 duration:'<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6M12 2v3M18 6l2-2"/>',
 pace:'<path d="M3 18a9 9 0 1 1 18 0M12 13l5-5M4 18h16"/><circle cx="12" cy="13" r="1"/>',
 speed:'<path d="M3 18a9 9 0 1 1 18 0M12 13l5-5M4 18h16"/><circle cx="12" cy="13" r="1"/>',
 power:'<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
 ascent:'<path d="m2 20 7-12 4 7 3-5 6 10ZM9 8l2-4 2 4"/>',
 descent:'<path d="m2 20 7-12 4 7 3-5 6 10ZM16 2v5m-3-3 3 3 3-3"/>',
 cadence:'<path d="M6 21h12L14 3h-4ZM12 17l7-10M7 21v-3h10v3"/>',
 sessions:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18m-12 4 2 2 4-4"/>',
 lap:'<path d="M4 22V3m0 1h15l-3 5 3 5H4"/>',
 training:'<path d="m7 7 10 10M3 8l5-5M16 21l5-5M2 5l3-3M19 22l3-3M5 10l5-5M14 19l5-5"/>'
};
export function shareCardSvg(o:ShareDesign){
 const englishVersions:Partial<Record<ShareTemplate,ShareTemplate>>={metroen:'metro',sweatreceipten:'sweatreceipt',excuseen:'excuse'},english=!!englishVersions[o.template];
 if(english)o={...o,template:englishVersions[o.template]!};
 const copy=(fr:string,en:string)=>english?en:fr;
 const isApproved=[...approvedActivityDesigns,...approvedRecoveryDesigns].some(design=>design.key===o.template);
 const isRetro=[...retroActivityDesigns,...retroRecoveryDesigns].some(design=>design.key===o.template);
 const h=o.height,ink=(!o.finish||o.finish==='solid')&&!['#ffffff','#121826','#111111'].includes(o.accent)?o.accent:o.ink==='white'?'#ffffff':'#111111',parts:string[]=[];
 const compact=(s:ShareStat)=>s.value+(s.unit==='min:sec'||s.unit==='h:mm:ss'?'':s.unit==='/km'?'/km':' '+s.unit);
 const mode=shareLabelMode(o),explicitMode=o.labelMode!==undefined,labelCues=explicitMode?mode!=='none':!!o.showLabels;
 const allStats=[...o.stats,...(o.dayCards??[]).flatMap(card=>card.stats)];
 const metricAliases:Record<string,string>={'sleep':'sleep','sleep today':'sleep','sleep score':'score','overnight hrv':'hrv','hrv':'hrv','resting hr':'rhr','heart rate':'hr','average heart rate':'hr','avg hr':'hr','steps':'steps','calories':'calories','workout calories':'calories','workout kcal':'calories','training time':'duration','time':'duration','duration':'duration','distance':'distance','pace':'pace','avg pace':'pace','average pace':'pace','speed':'speed','avg speed':'speed','average speed':'speed','power':'power','avg power':'power','average power':'power','elevation gain':'ascent','gain':'ascent','ascent':'ascent','cadence':'cadence','sessions':'sessions','activities today':'sessions','lap':'lap'};
 const metricKey=(value:string)=>allStats.find(stat=>stat.label.toLocaleLowerCase()===value.toLocaleLowerCase())?.key??metricAliases[value.toLocaleLowerCase()];
 const sportCue=(value:string)=>{
  const normalized=value.toLocaleLowerCase(),session=o.dayCards?.find(card=>card.sportFamily&&(normalized===card.title.toLocaleLowerCase()||normalized.replace(/^\d+\s*(?:\/\s*)?/,'')===card.title.toLocaleLowerCase()));
  if(session)return session.sportFamily;
  if(!o.dayCards&&!o.recoveryOnly&&o.sportFamily&&[o.sport,o.title].filter(Boolean).some(label=>{const name=label.toLocaleLowerCase();return normalized===name||normalized.startsWith(name+' /')||normalized.startsWith(name+' ·')||['route / ','sieste / ','week totals · ','recorded / '].some(prefix=>normalized===prefix+name)}))return o.sportFamily;
  return undefined;
 };
 const iconCue=(key:string,x:number,y:number,size:number,color:string,anchor='start',sport=false)=>{
  const iconSize=Math.min(sport?44:32,Math.max(24,size*1.2)),left=anchor==='middle'?x-iconSize/2:anchor==='end'?x-iconSize:x;
  const healthKey=key==='hr'||key==='rhr'?'heartrate':key,glyph=sport?sportGlyphs[key]??sportGlyphs.misc:metricGlyphs[key]??sportGlyphs.misc,kind=sport?'sport':healthGlyphs[healthKey]?'health':'metric';
  return `<g data-${kind}-icon="${xml(kind==='health'?healthKey:key)}" data-share-cue-key="${xml(key)}" transform="translate(${left} ${y-iconSize*.85}) scale(${iconSize/24})" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`;
 };
 function text(value:string,x:number,y:number,size=24,weight=400,color=ink,width=936,serif=false,anchor='start'){
 let labelKey:string|undefined,labelKind='';
 if(explicitMode){
  value=({'hours / minutes':'h / m','milliseconds':'ms','out of 100':'/100'} as Record<string,string>)[value.toLocaleLowerCase()]??value;
  labelKey=metricKey(value);
  const family=labelKey?undefined:sportCue(value);
  if(labelKey||family){
   if(mode==='none')return '';
   if(mode==='icons')return iconCue(labelKey??family!,x,y,size,color,anchor,!!family);
   labelKind=family?'sport':'metric';
   if(family){labelKey=family;if(mode==='short')value=({running:'Run',cycling:'Ride',strength_training:'Strength',swimming:'Swim',walking:'Walk',hiking:'Hike'} as Record<string,string>)[family]??value;}
   else value=shareMetricLabel(labelKey!,value,mode);
  }
 }
 if(!explicitMode){
 const statLabel=o.stats.find(s=>s.label.toLowerCase()===value.toLowerCase());
 const healthKey=({'sleep':'sleep','sleep today':'sleep','sleep score':'score','overnight hrv':'hrv','hrv':'hrv','resting hr':'heartrate','heart rate':'heartrate','average heart rate':'heartrate','avg hr':'heartrate','steps':'steps','calories':'calories','workout calories':'calories','workout kcal':'calories'} as Record<string,string>)[value.toLowerCase()]??(statLabel&&healthGlyphs[statLabel.key]?statLabel.key:undefined);
 if(healthKey){
  const iconSize=Math.min(30,Math.max(24,size*1.2)),labelWidth=Math.min(Math.max(1,width-iconSize-8),value.length*size*.58),groupWidth=o.showLabels===false?iconSize:iconSize+8+labelWidth,left=anchor==='middle'?x-groupWidth/2:anchor==='end'?x-groupWidth:x;
  const glyph=`<g data-health-icon="${healthKey}" transform="translate(${left} ${y-iconSize*.85}) scale(${iconSize/24})" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${healthGlyphs[healthKey]}</g>`;
  if(o.showLabels===false)return glyph;
  // Labels remain optional; when enabled reserve room for the same small icon.
  return glyph+`<text x="${left+iconSize+8}" y="${y}" fill="${color}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}" textLength="${Math.min(Math.max(1,width-iconSize-8),value.length*size*.58)}" lengthAdjust="spacingAndGlyphs">${xml(value)}</text>`;
 }
 const metricLabels=['sleep','sleep today','sleep score','overnight hrv','hrv','hours / minutes','milliseconds','out of 100',...o.stats.map(s=>s.label.toLowerCase()),...(o.dayCards??[]).flatMap(c=>c.stats.map(s=>s.label.toLowerCase()))];
 if(o.showLabels===false&&(metricLabels.includes(value.toLowerCase())||value.startsWith('7d range ')||value==='RECOVERY / LAST 7 DAYS'||value.includes('gaps = missing readings')||value.startsWith('HRV ring:')))return '';
 const normalized=value.toLocaleLowerCase(),session=o.dayCards?.find(c=>c.sportFamily&&(normalized===c.title.toLocaleLowerCase()||normalized.replace(/^\d+\s*(?:\/\s*)?/,'')===c.title.toLocaleLowerCase()));
 const single=!o.dayCards&&!o.recoveryOnly&&(normalized===o.sport.toLocaleLowerCase()||normalized===o.title.toLocaleLowerCase()||normalized.startsWith(o.sport.toLocaleLowerCase()+' /')||normalized.startsWith(o.sport.toLocaleLowerCase()+' ·'));
 const family=session?.sportFamily??(single?o.sportFamily:undefined);
 let pictogram='';
 if(family){
  if(o.showLabels===false){
   const iconSize=Math.min(44,Math.max(26,size)),left=anchor==='middle'?x-iconSize/2:anchor==='end'?x-iconSize:x;
   return `<g data-sport-icon="${xml(family)}" transform="translate(${left} ${y-iconSize*.85}) scale(${iconSize/24})" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${sportGlyphs[family]??sportGlyphs.misc}</g>`;
  }
  const iconSize=Math.min(44,Math.max(22,size*1.15)),gap=10,reserved=iconSize+gap,textWidth=Math.min(Math.max(0,width-reserved),[...value].length*size*(serif?.48:.58)),left=anchor==='middle'?x-(textWidth+reserved)/2:anchor==='end'?x-textWidth-reserved:x;
  const paint=(o.finish&&o.finish!=='solid'||o.template.startsWith('chrome'))&&!['ticket','metro','sweatreceipt','glass','daystack','bubble'].includes(o.template)?'url(#metalSoft)':color;
  pictogram=`<g data-sport-icon="${xml(family)}" transform="translate(${left} ${y-size*.8}) scale(${iconSize/24})" fill="none" stroke="${paint}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${sportGlyphs[family]??sportGlyphs.misc}</g>`;
  x=left+reserved;width=Math.max(1,width-reserved);anchor='start';
 }
 const estimate=[...value].length*size*(serif?.48:.58);
 const isStat=o.stats.some(stat=>[compact(stat),compact(stat).toUpperCase(),stat.value].includes(value)||value.toUpperCase().includes(compact(stat).toUpperCase()));
 const isActivity=[o.sport,o.title].some(label=>label.trim()&&value.toLocaleLowerCase().includes(label.toLocaleLowerCase()));
 return pictogram+`<text${isStat?' data-share-stat="true"':''}${isActivity?' data-share-activity="true"':''} x="${x}" y="${y}" fill="${color}" font-family="${serif?'Georgia,Times New Roman,serif':'Arial,Helvetica,sans-serif'}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}"${estimate>width?` textLength="${width}" lengthAdjust="spacingAndGlyphs"`:''}>${xml(value)}</text>`;
 }
 const estimate=[...value].length*size*(serif?.48:.58);
 const isStat=o.stats.some(stat=>[compact(stat),compact(stat).toUpperCase(),stat.value].includes(value)||value.toUpperCase().includes(compact(stat).toUpperCase()));
 const isActivity=[o.sport,o.title].some(label=>label.trim()&&value.toLocaleLowerCase().includes(label.toLocaleLowerCase()));
 return `<text${labelKey?` data-share-label-key="${xml(labelKey)}" data-share-label-mode="${mode}" data-share-label-kind="${labelKind}"`:''}${isStat?' data-share-stat="true"':''}${isActivity?' data-share-activity="true"':''} x="${x}" y="${y}" fill="${color}" font-family="${serif?'Georgia,Times New Roman,serif':'Arial,Helvetica,sans-serif'}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}"${estimate>width?` textLength="${width}" lengthAdjust="spacingAndGlyphs"`:''}>${xml(value)}</text>`;
 }
 const cinematicCue=(value:string,x:number,y:number,width:number,height:number,face:DisplayFace,color:string,center=false)=>{
  if(explicitMode&&(metricKey(value)||sportCue(value)))return text(value,center?x+width/2:x,y+height*.85,Math.min(42,height),700,color,width,false,center?'middle':'start');
  return cinematicText(value,{x,y,width,height,face,color,align:center?'middle':'start'});
 };
 function route(x:number,y:number,w:number,hh:number,stroke=4,inset=15){if(!o.route)return '';const {points,segments,center}=o.route,minX=points.reduce((n,p)=>Math.min(n,p.x),Infinity),maxX=points.reduce((n,p)=>Math.max(n,p.x),-Infinity),minY=points.reduce((n,p)=>Math.min(n,p.y),Infinity),maxY=points.reduce((n,p)=>Math.max(n,p.y),-Infinity),scale=Math.min((w-inset*2)/Math.max(maxX-minX,1e-9),(hh-inset*2)/Math.max(maxY-minY,1e-9));return segments.filter(s=>s.length>1).map(s=>{const stride=Math.max(1,Math.ceil(s.length/3000)),p=s.filter((_,i)=>i%stride===0||i===s.length-1).map((p,i)=>`${i?'L':'M'}${(x+w/2+(p.x-center.x)*scale).toFixed(2)},${(y+hh/2+(p.y-center.y)*scale).toFixed(2)}`).join(' ');return `<path d="${p}" fill="none" stroke="${ink}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`}).join('')}
 const backdrop=o.finish&&o.finish!=='solid'?true:!o.template.startsWith('chrome')?shareColourContrast(ink)==='#111111':o.ink==='white';
 if(!o.transparent)parts.push(`<rect width="1080" height="${h}" fill="${backdrop?'#181818':'#fafafa'}"/>`);
 const first=o.stats[0],others=o.stats.slice(1),cy=h/2;
 // Each design is a standalone overlay; canvas padding stays transparent.
 const heavy=(value:string,x:number,y:number,size:number,width:number,color=ink)=>text(value,x,y,size,900,color,width).replace('Arial,Helvetica,sans-serif','Arial Black,Arial,Helvetica,sans-serif');
 const secondary=(!o.finish||o.finish==='solid')?ink:o.ink==='white'?'#ffffff':'#111111',contrast=shareColourContrast(ink);
 const isChrome=o.template.startsWith('chrome')||!!o.finish&&o.finish!=='solid';
 const palette=shareFinishes.find(f=>f.key===o.finish)??shareFinishes[0],c=palette.colors;
 if(isChrome){
  const gradient=(id:string,colors:readonly string[],offsets:readonly number[])=>`<linearGradient id="${id}" x1="0" y1="0" x2=".12" y2="1">${colors.map((color,i)=>`<stop offset="${offsets[i]}" stop-color="${color}"/>`).join('')}</linearGradient>`;
  parts.push('<defs>'+gradient('metal',c,[0,.18,.39,.48,.5,.61,.76,.88,1])+gradient('metalSoft',[c[0],c[1],c[6],c[7]],[0,.35,.7,1])+gradient('rim',[c[0],c[3],c[7],c[4]],[0,.45,.7,1])+gradient('silverSurface',[c[0],c[1],c[2],c[6],c[7]],[0,.4,.5,.55,1])+'</defs>');
 }
 const metal=(v:string,x:number,y:number,size:number,width:number,outline=false)=>{
  const glyph=heavy(v,x,y,size,width,'url(#metal)');
  return (outline?'':`<g transform="translate(0 5)">${glyph.replace('fill="url(#metal)"','fill="#252b37" stroke="#252b37" stroke-width="3"')}</g>`)+
   glyph.replace('fill="url(#metal)"',`fill="${outline?'none':'url(#metal)'}" stroke="url(#rim)" stroke-width="${outline?3:1.8}" paint-order="stroke fill"`);
 };
 if(isApproved){parts.push(renderApprovedShare(o,{ink:isChrome?'url(#metal)':ink,route}));}
 else if(isRetro){
  const icon=(glyph:string,kind:string,key:string,x:number,y:number,size:number,color:string)=>`<g data-${kind}-icon="${xml(key)}" transform="translate(${x} ${y}) scale(${size/24})" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`;
  parts.push(renderRetroShare(o,{ink:isChrome?'url(#metal)':ink,route,
   sportIcon:(family,x,y,size,color)=>icon(sportGlyphs[family]??sportGlyphs.misc,'sport',family,x,y,size,color),
   healthIcon:(key,x,y,size,color)=>icon(healthGlyphs[key]??healthGlyphs.hrv,'health',key,x,y,size,color)}));
 }else if(routeStatTemplates.includes(o.template)){
  const stroke=typeof o.routeStroke==='number'&&Number.isFinite(o.routeStroke)?Math.max(12,Math.min(40,o.routeStroke)):28;
  const paint=isChrome?'url(#metal)':ink,shown=o.stats.slice(0,6),support=shown.slice(1);
  const bottom=h-(o.brand||o.demo?110:64)-(o.date?44:0),labelSpace=labelCues?30:0;
  const heading=(x:number,y:number,w:number,center=false)=>{
   if(explicitMode&&sportCue(o.title||o.sport)){parts.push(cinematicCue(o.title||o.sport,x,y,w,34,'tall',paint,center));return y+(mode==='none'?0:34);}
   const lines=cinematicTitleLines(o.title||o.sport);
   lines.forEach((line,i)=>parts.push(cinematicText(line,{x,y:y+i*42,width:w,height:34,face:'tall',color:paint,align:center?'middle':'start'})));
   return y+lines.length*42-8;
  };
  const trace=(x:number,y:number,w:number,hh:number)=>{
   const paths=route(x,y,w,hh,stroke,stroke/2+8);
   parts.push(`<g data-share-route="true">${paths||text('NO RECORDED ROUTE',x+w/2,y+hh/2,22,600,secondary,w,false,'middle')}</g>`);
  };
  const metric=(stat:ShareStat|undefined,x:number,y:number,w:number,hh:number,face:DisplayFace='tall',center=false,stretch=false)=>{
   if(!stat)return;
   const value=cinematicText(compact(stat).toUpperCase(),{x,y,width:w,height:hh,face,color:paint,align:center?'middle':'start',stretch});
   const shortLabels:Record<string,string>={distance:'Distance',duration:'Time',pace:'Avg pace',speed:'Avg speed',power:'Avg power',hr:'Avg HR',ascent:'Gain',calories:'Calories',cadence:'Cadence',sessions:'Sessions',sleep:'Sleep',hrv:'HRV'};
   const labelText=o.template==='tracefooter'?shortLabels[stat.key]??stat.label:stat.label;
   const label=labelCues?text(labelText.toUpperCase(),center?x+w/2:x,y+hh+26,17,600,secondary,w,false,center?'middle':'start'):'';
   parts.push(`<g data-share-stat-key="${xml(stat.key)}">${value}${label}</g>`);
  };
  const gridHeight=(count:number,columns:number,cellHeight:number)=>count?Math.ceil(count/columns)*cellHeight+(Math.ceil(count/columns)-1)*18:0;
  const grid=(stats:ShareStat[],x:number,y:number,w:number,columns:number,cellHeight:number,face:DisplayFace='tall',valueHeight=44)=>{
   const columnWidth=(w-(columns-1)*24)/columns;
   stats.forEach((stat,i)=>metric(stat,x+i%columns*(columnWidth+24),y+Math.floor(i/columns)*(cellHeight+18),columnWidth,Math.min(valueHeight,cellHeight-labelSpace),face));
  };
  if(o.template==='tracesplit'){
   const top=heading(72,72,936)+40,available=bottom-top,heroHeight=Math.min(108,available*.18);
   trace(64,top,550,available);
   metric(first,682,top,334,heroHeight,'serif');
   const statTop=top+heroHeight+labelSpace+40,cellHeight=Math.min(112,(bottom-statTop-Math.max(0,support.length-1)*18)/Math.max(1,support.length));
   parts.push(`<path d="M682 ${statTop-20}h334" fill="none" stroke="${ink}" stroke-width="2"/>`);
   grid(support,682,statTop,334,1,cellHeight);
  }else if(o.template==='tracefooter'){
   const cellHeight=labelCues?100:76,statsHeight=gridHeight(shown.length,2,cellHeight),titleHeight=cinematicTitleLines(o.title||o.sport).length*42-8;
   const top=bottom-Math.max(410,titleHeight+36+statsHeight),contentTop=heading(64,top,952)+36;
   trace(64,contentTop,550,bottom-contentTop);
   grid(shown,680,contentTop,336,2,cellHeight,'tall',38);
  }else if(o.template==='tracescorecard'){
   const top=heading(72,72,936)+32,cellHeight=labelCues?114:88,statTop=bottom-gridHeight(shown.length,3,cellHeight);
   trace(64,top,952,statTop-top-52);
   parts.push(`<path d="M72 ${statTop-26}h936" fill="none" stroke="${ink}" stroke-width="2"/>`);
   grid(shown,72,statTop,936,3,cellHeight,'wide',54);
  }else{
   const top=heading(72,72,936,o.template==='tracestamp')+32,cellHeight=labelCues?84:64;
   const statTop=bottom-gridHeight(support.length,3,cellHeight);
   if(o.template==='traceheadline'){
    const heroHeight=170,routeTop=top+heroHeight+labelSpace+38;
    metric(first,64,top,952,heroHeight,'bold',false,true);
    trace(64,routeTop,952,statTop-routeTop-38);
   }else{
    const heroHeight=96,heroTop=statTop-heroHeight-labelSpace-30,routeHeight=heroTop-top-36;
    if(o.template==='tracestamp'){
     const frameWidth=Math.min(860,routeHeight*1.45),x=(1080-frameWidth)/2;
     parts.push(`<rect x="${x}" y="${top}" width="${frameWidth}" height="${routeHeight}" rx="${Math.min(64,routeHeight*.12)}" fill="none" stroke="${ink}" stroke-width="2"/>`);
     trace(x+28,top+28,frameWidth-56,routeHeight-56);
    }else trace(64,top,952,routeHeight);
    metric(first,72,heroTop,936,heroHeight,o.template==='tracestamp'?'slab':'bold',o.template==='tracestamp');
   }
   grid(support,72,statTop,936,3,cellHeight);
  }
  if(o.date)parts.push(text(o.date,72,bottom+34,21,500,secondary,936));
 }else if(o.template==='routegiant'){
  const stroke=typeof o.routeStroke==='number'&&Number.isFinite(o.routeStroke)?Math.max(4,Math.min(28,o.routeStroke)):16;
  parts.push(route(24,24,1032,h-(o.brand||o.demo?108:48),stroke));
 }else if(['cinemamonolith','cinemaepic','cinemawide','cinemamission','cinemalens','cinemawave'].includes(o.template)){
  const paint=isChrome?'url(#metal)':ink,face:DisplayFace=o.template==='cinemaepic'?'serif':o.template==='cinemawide'?'wide':o.template==='cinemamission'?'slab':'bold';
  const shown=others.slice(0,5),columns=Math.min(3,shown.length),rows=Math.ceil(shown.length/3),rowHeight=labelCues?90:70,supportHeight=rows?rows*rowHeight+(rows-1)*16:0;
  const bottom=h-(o.brand||o.demo?90:60)-(o.date?36:0),heroHeight=Math.min(1160,bottom-140-56-supportHeight),top=140+Math.max(0,bottom-140-56-supportHeight-heroHeight)/2;
  const box={x:64,y:top,width:952,height:heroHeight},unit=first?.unit.toUpperCase()??'',value=first?.value.toUpperCase()??'NO STATS';
  const titleLines=cinematicTitleLines((o.title||o.sport).normalize('NFC'));
  if(explicitMode&&sportCue(o.title||o.sport))parts.push(cinematicCue(o.title||o.sport,72,top-94,936,30,o.template==='cinemawide'?'wide':'tall',paint,true));
  else titleLines.forEach((line,i)=>parts.push(cinematicText(line,{x:72,y:top-94+i*36,width:936,height:30,face:o.template==='cinemawide'?'wide':'tall',color:paint,align:'middle'})));
  if(o.template==='cinemawave')parts.push(cinematicText(first?compact(first).toUpperCase():value,{...box,face,color:paint,stretch:true,warp:'wave'}));
  else{
   const wide=o.template==='cinemawide',valueHeight=unit?heroHeight*(wide?.40:.61):heroHeight,unitHeight=heroHeight*(wide?.30:.34),unitTop=top+heroHeight-unitHeight;
   const warp=o.template==='cinemalens'?'lens' as const:undefined;
   parts.push(cinematicText(value,{x:64,y:top+(wide?heroHeight*.04:0),width:952,height:valueHeight,face,color:paint,stretch:true,warp,warpBox:box}));
   if(unit)parts.push(cinematicText(unit,{x:64,y:unitTop-(wide?heroHeight*.08:0),width:952,height:unitHeight,face,color:paint,stretch:true,warp,warpBox:box}));
  }
  const supportTop=top+heroHeight+56,columnWidth=columns?(952-(columns-1)*24)/columns:952;
  shown.forEach((stat,i)=>{
   const x=64+(i%3)*(columnWidth+24),y=supportTop+Math.floor(i/3)*(rowHeight+16);
   parts.push(cinematicText(compact(stat).toUpperCase(),{x,y,width:columnWidth,height:columns<3?54:46,face:o.template==='cinemamission'?'slab':o.template==='cinemawide'?'wide':'tall',color:paint,align:'middle'}));
   if(labelCues)parts.push(text(stat.label.toUpperCase(),x+columnWidth/2,y+78,18,600,ink,columnWidth,false,'middle'));
  });
  if(o.date)parts.push(text(o.date,540,supportTop+supportHeight+24,22,500,ink,936,false,'middle'));
 }else if(o.template.startsWith('cinema')){
  const paint=isChrome?'url(#metal)':ink,primary=first?compact(first):'NO RECORDED STATS',headline=primary.toUpperCase();
  const display=(value:string,x:number,y:number,width:number,height:number,face:'bold'|'tall'|'serif'='bold',center=false)=>cinematicCue(value,x,y,width,height,face,paint,center);
  const supporting=(y:number)=>others.slice(0,3).map((stat,i)=>{const x=72+i*322;return display(compact(stat).toUpperCase(),x,y,292,56,'tall')+(labelCues?text(stat.label.toUpperCase(),x,y+87,18,600,secondary,292):'')}).join('');
  const title=o.title||o.sport,weekday=(o.weekday||o.sport).toUpperCase();
  if(o.template==='cinemabig'){
   parts.push(display(title.toUpperCase(),72,cy-312,936,56,'tall'),display(headline,60,cy-206,960,365),supporting(cy+222));
  }else if(o.template==='cinemaday'){
   parts.push(display(weekday,72,cy-325,936,108,'tall',true),display(headline,60,cy-161,960,335,'tall',true),supporting(cy+244));
  }else if(o.template==='cinematitle'){
   const lines=cinematicTitleLines(title),top=cy-315;
   if(explicitMode&&sportCue(title))parts.push(display(title,72,top,936,92,'bold'));
   else lines.forEach((line,i)=>parts.push(display(line,72,top+i*108,936,92,'bold')));
   parts.push(display(headline,60,cy-315+lines.length*108+50,960,240,'tall'),supporting(cy-315+lines.length*108+350));
  }else if(o.template==='cinematrace'){
   parts.push(display(weekday,72,cy-382,936,75,'bold',true),route(175,cy-263,730,395,7),display(headline,72,cy+206,936,125,'bold',true),supporting(cy+389));
  }else if(o.template==='cinemaserif'){
   parts.push(display(title.toUpperCase(),72,cy-214,936,42,'tall',true),display(primary,60,cy-106,960,175,'serif',true));
   const pace=others.find(stat=>stat.key==='pace'||stat.key==='speed')??others[0];
   if(pace)parts.push(display(compact(pace),72,cy+109,936,48,'tall',true));
   parts.push(text(others.filter(stat=>stat!==pace).slice(0,2).map(compact).join('   /   '),540,cy+237,28,600,secondary,936,false,'middle'));
  }else{
   const rows=o.stats.slice(0,6),rowHeight=rows.length>4?76:100,gap=28,totalHeight=rows.length*(rowHeight+gap)-gap,top=cy-totalHeight/2;
   parts.push(display(title.toUpperCase(),72,top-105,936,56,'tall',true));
   rows.forEach((stat,i)=>parts.push(display(compact(stat).toUpperCase(),72,top+i*(rowHeight+gap),936,rowHeight,'bold',true)));
  }
  if(o.date)parts.push(text(o.date,540,Math.min(h-84,cy+478),22,500,secondary,936,false,'middle'));
 }else if(o.template==='chrome'||o.template==='chromeoutline'){
  parts.push(text(o.title.toUpperCase(),82,cy-150,25,700,secondary,910));
  if(first)parts.push(metal(compact(first).toUpperCase(),70,cy+55,176,935,o.template==='chromeoutline'));
  others.slice(0,3).forEach((v,i)=>{const x=85+i*320;parts.push(text(compact(v),x,cy+140,37,800,secondary,290),text(v.label.toUpperCase(),x,cy+179,17,600,secondary,290))});
 }else if(o.template==='chromebadge'){
  parts.push(`<circle cx="540" cy="${cy-75}" r="290" fill="none" stroke="#303846" stroke-width="11"/><circle cx="540" cy="${cy-78}" r="290" fill="none" stroke="url(#metal)" stroke-width="8"/><circle cx="540" cy="${cy-78}" r="275" fill="none" stroke="url(#rim)" stroke-width="1.5"/>`,text(o.sport.toUpperCase(),540,cy-265,24,800,secondary,450,false,'middle'),route(300,cy-210,480,300,7).replaceAll(`stroke="${ink}"`,'stroke="url(#metal)"'));
  if(first)parts.push(metal(compact(first).toUpperCase(),105,cy+325,137,870));
  parts.push(text(others.slice(0,3).map(compact).join('   /   '),540,cy+387,28,700,secondary,900,false,'middle'));
 }else if(o.template==='chromeheadline'){
  parts.push(metal(o.sport.toUpperCase(),75,cy-80,143,925));
  if(first)parts.push(metal(compact(first).toUpperCase(),75,cy+90,165,925));
  parts.push(text(o.title,82,cy+165,26,600,secondary,910),text(others.slice(0,3).map(compact).join('   /   '),82,cy+228,32,800,secondary,910));
 }else if(o.template==='metro'){
  const top=cy-250,paper='#f0e4c9',print='#263833';
  parts.push(`<g transform="rotate(-5 540 ${cy})"><rect x="85" y="${top}" width="910" height="500" rx="22" fill="${paper}"/><rect x="85" y="${top+366}" width="910" height="56" fill="#65523e"/><path d="M125 ${top+107}H955" stroke="${print}" stroke-width="2"/>`);
  parts.push(text('SIESTE',130,top+72,47,900,print,360),text(copy('PARIS · TICKET SPORT','PARIS · SPORTS TICKET'),950,top+68,23,800,print,480,false,'end'),text(copy('ALLER SIMPLE / RETOUR EN SUEUR','ONE WAY / SWEAT ON THE RETURN'),130,top+151,22,700,print,805));
  if(first)parts.push(heavy(compact(first).toUpperCase(),124,top+253,117,825,print));
  parts.push(text(o.sport.toUpperCase()+' · '+o.title,130,top+299,23,700,print,810),text(others.slice(0,3).map(compact).join('   /   '),130,top+339,25,700,print,810),text(copy('VALIDÉ PAR VOS JAMBES','VALIDATED BY YOUR LEGS'),130,top+462,24,800,print,600),text('S / 01',950,top+462,20,600,print,170,false,'end'),'</g>');
 }else if(o.template==='sweatreceipt'){
  const top=cy-350,black='#242424',mono=(v:string,x:number,y:number,size:number,w=730)=>text(v,x,y,size,600,black,w).replace('Arial,Helvetica,sans-serif','Courier New,monospace');
  parts.push(`<path d="M145 ${top}H935V${top+700}l-25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15H145Z" fill="#faf7ef"/>`);
  parts.push(mono(copy('REÇU DE TRANSPIRATION','SWEAT RECEIPT'),185,top+68,33),mono('SIESTE / '+o.sport.toUpperCase(),185,top+116,23),`<path d="M185 ${top+151}H895" stroke="${black}" stroke-dasharray="7 7"/>`);
  o.stats.slice(0,4).forEach((v,i)=>{const y=top+212+i*74;parts.push(mono(v.label.toUpperCase(),185,y,20,330),text(compact(v),895,y,32,700,black,350,false,'end').replace('Arial,Helvetica,sans-serif','Courier New,monospace'))});
  parts.push(`<path d="M185 ${top+466}H895" stroke="${black}" stroke-dasharray="7 7"/>`,mono(copy('PAIEMENT : EN SUEUR','PAYMENT: SWEAT'),185,top+528,31),mono(copy('REMBOURSEMENT : UNE SIESTE','REFUND: ONE NAP'),185,top+580,23),mono(copy('Merci. Revenez transpirer.','Thank you. Come sweat again.'),185,top+635,21));
 }else if(o.template==='excuse'){
  const top=cy-300;
  parts.push(`<rect x="95" y="${top}" width="890" height="600" rx="20" fill="none" stroke="${ink}" stroke-width="3"/>`,text(copy('ABSENCE JUSTIFIÉE','EXCUSED ABSENCE'),135,top+83,65,900,ink,805),text(copy('J’ÉTAIS À L’ENTRAÎNEMENT.','I WAS TRAINING.'),135,top+143,29,800,ink,805));
  if(first)parts.push(heavy(compact(first),130,top+310,127,805));
  parts.push(text(others.slice(0,3).map(compact).join('   /   '),135,top+382,31,700,ink,805),`<g transform="rotate(-9 740 ${top+495})"><rect x="565" y="${top+438}" width="355" height="91" rx="6" fill="none" stroke="${ink}" stroke-width="5"/>`,text(copy('EXCUSÉ·E','EXCUSED'),743,top+498,48,900,ink,320,false,'middle'),'</g>',text(o.sport.toUpperCase(),135,top+534,24,700,ink,390));
 }else if(o.template==='croissant'){
  parts.push(text('WILL TRAIN',540,cy-205,98,900,ink,910,false,'middle'),text('FOR CROISSANTS.',540,cy-90,99,900,ink,930,false,'middle'),`<path d="M140 ${cy-32}H940" stroke="${ink}" stroke-width="3"/>`);
  if(first)parts.push(heavy(compact(first),145,cy+112,115,810));
  parts.push(text(others.slice(0,3).map(compact).join('   /   '),145,cy+180,30,700,ink,810),text(o.title,145,cy+247,24,500,ink,810));
 }else if(o.template==='velocity'){
  parts.push(text(o.sport.toUpperCase()+' / '+o.title.toUpperCase(),80,cy-235,24,800,secondary,910));
  parts.push(`<g transform="translate(540 ${cy-15}) rotate(-7) translate(-540 ${-cy+15})">`);
  if(first)parts.push(heavy(first.value,75,cy+40,235,910).replace('font-weight="900"','font-weight="900" font-style="italic"'),text(first.unit.toUpperCase(),85,cy+104,35,800));
  parts.push(`<path d="M80 ${cy+135}H995" stroke="${ink}" stroke-width="12"/></g>`);
  others.slice(0,3).forEach((v,i)=>{const x=85+i*320;parts.push(heavy(compact(v),x,cy+265,43,290,secondary),text(v.label.toUpperCase(),x,cy+305,18,600,secondary,290))});
 }else if(o.template==='ghost'){
  parts.push(text(o.title.toUpperCase(),80,cy-300,27,800,secondary));
  if(first){for(const [dy,opacity] of [[-150,.18],[0,1],[150,.18]]){const t=heavy(first.value,65,cy+60+dy,220,945);parts.push(dy?`<g opacity="${opacity}">${t.replace(`fill="${ink}"`,`fill="none" stroke="${ink}" stroke-width="2"`)}</g>`:t)}parts.push(text(first.unit.toUpperCase(),85,cy+277,36,800));}
  parts.push(text(others.slice(0,3).map(compact).join('   /   '),85,cy+335,30,700,secondary,910));
 }else if(o.template==='routefile'){
  parts.push(text('ROUTE / '+o.sport.toUpperCase(),90,cy-370,24,800,secondary),text(o.title.toUpperCase(),90,cy-320,36,800,secondary,890));
  parts.push(`<path d="M85 ${cy-230}v-35h55 M940 ${cy-265}h55v35 M85 ${cy+115}v35h55 M940 ${cy+150}h55v-35" fill="none" stroke="${secondary}" stroke-width="2"/>`,route(125,cy-250,830,380,8));
  if(first)parts.push(heavy(compact(first).toUpperCase(),80,cy+280,128,930));
  others.slice(0,3).forEach((v,i)=>{const x=85+i*320;parts.push(text(compact(v),x,cy+352,34,800,secondary,285),text(v.label.toUpperCase(),x,cy+386,16,600,secondary,285))});
 }else if(o.template==='ticket'){
  const top=cy-290;
  parts.push(`<path d="M85 ${top}H995V${top+245}a30 30 0 0 0 0 60V${top+580}H85V${top+305}a30 30 0 0 0 0-60Z" fill="${ink}"/>`);
  parts.push(text(o.sport.toUpperCase()+' / SESSION',130,top+65,25,800,contrast,820),text(o.title.toUpperCase(),130,top+112,26,700,contrast,820));
  if(first)parts.push(heavy(compact(first).toUpperCase(),125,top+230,122,815,contrast));
  parts.push(`<path d="M135 ${top+275}H945" stroke="${contrast}" stroke-dasharray="8 10" stroke-width="2" opacity=".5"/>`);
  others.slice(0,3).forEach((v,i)=>{const x=130+i*280;parts.push(text(v.label.toUpperCase(),x,top+350,16,700,contrast,245),heavy(compact(v),x,top+405,43,245,contrast))});
  parts.push(text(o.date||'RECORDED / '+o.sport.toUpperCase(),130,top+525,22,700,contrast,790));
 }else if(o.template==='monolith'){
  parts.push(text(o.title.toUpperCase(),85,cy-360,28,800,secondary,910));
  if(first){parts.push(heavy(first.value,72,cy-50,260,935),heavy(first.unit.toUpperCase(),80,cy+115,130,930));}
  parts.push(`<path d="M85 ${cy+160}H995" stroke="${ink}" stroke-width="3"/>`);
  others.slice(0,3).forEach((v,i)=>{const y=cy+230+i*62;parts.push(text(v.label.toUpperCase(),85,y,20,700,secondary,430),text(compact(v),995,y,40,800,secondary,440,false,'end'))});
 }else if(o.template==='podium'){
  parts.push(text(o.title.toUpperCase(),85,cy-330,27,800,secondary,910));
  o.stats.slice(0,3).forEach((v,i)=>{const y=cy-155+i*215;parts.push(text('0'+(i+1),85,y-15,25,800,secondary,65),heavy(compact(v).toUpperCase(),190,y+18,104,800),text(v.label.toUpperCase(),195,y+66,19,700,secondary,775),`<path d="M85 ${y+100}H995" stroke="${ink}" stroke-width="${i===0?6:2}"/>`)});
 }else if(['daytrends','daycolumns','daybars','daypanels','dayledger','daybalance','dayribbon','daymatrix','daypulse'].includes(o.template)){
  const sessions=o.recoveryOnly?[]:(o.dayCards??[]).slice(1),contentHeight=o.recoveryOnly?600:Math.max(740,620+sessions.length*160),scale=Math.min(1,(h-120)/contentHeight),top=0,health=o.dayHealth??{},history=health.history??[],valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0,minutes=valid(health.sleep)?Math.round(health.sleep/60):null;
  const metrics=[{key:'sleep' as const,label:'SLEEP',value:minutes===null?'Unavailable':`${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`,unit:'h'},{key:'score' as const,label:'SLEEP SCORE',value:valid(health.score)&&health.score<=100?Math.round(health.score)+'/100':'Unavailable',unit:'points'},{key:'hrv' as const,label:'OVERNIGHT HRV',value:valid(health.hrv)&&health.hrv>0?Math.round(health.hrv)+' ms':'Unavailable',unit:'ms'}];
  const paint=isChrome?'url(#metalSoft)':ink;
  parts.push(`<g transform="translate(${540*(1-scale)} ${cy-contentHeight*scale/2}) scale(${scale})">`);
  function chart(key:'sleep'|'score'|'hrv',x:number,y:number,w:number,hh:number,bars=false){
   const values=history.map(r=>r[key]),recorded=values.filter(valid);if(!recorded.length){parts.push(text('No recorded history',x,y+hh/2,19,400,secondary,w));return;}
   let min=bars?0:Math.min(...recorded),max=bars&&key==='score'?100:Math.max(...recorded);if(max===min){min=Math.max(0,min-1);max+=1;}
   const xx=(i:number)=>x+(i+.5)*w/Math.max(1,values.length),yy=(v:number)=>y+hh-(v-min)/(max-min)*hh;
   parts.push(`<path d="M${x} ${y+hh}H${x+w}" stroke="${ink}" stroke-opacity=".18"/>`);
   let path='',previous=false;values.forEach((v,i)=>{if(!valid(v)){previous=false;return;}if(bars){const width=w/values.length*.54;parts.push(`<rect x="${xx(i)-width/2}" y="${yy(v)}" width="${width}" height="${Math.max(1,y+hh-yy(v))}" rx="4" fill="${paint}" opacity="${i===values.length-1?1:.5}"/>`)}else{path+=(previous?'L':'M')+xx(i)+' '+yy(v)+' ';previous=true;parts.push(`<circle cx="${xx(i)}" cy="${yy(v)}" r="${i===values.length-1?6:3}" fill="${paint}"/>`)}});
   if(path)parts.push(`<path d="${path}" fill="none" stroke="${paint}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
   const f=(v:number)=>v.toLocaleString('en-GB',{maximumFractionDigits:1});parts.push(text('7d range '+f(Math.min(...recorded))+'–'+f(Math.max(...recorded))+' '+metrics.find(m=>m.key===key)!.unit,x,y+hh+28,16,400,secondary,w));
  }
  parts.push(text(o.title.toUpperCase(),80,top+20,26,600),text('RECOVERY / LAST 7 DAYS',80,top+63,18,600,secondary));
  if(o.template==='dayledger'){
   metrics.forEach((m,i)=>{const y=top+130+i*148;parts.push(text(m.label,80,y,19,700,secondary,280),text(m.value,1000,y+52,54,800,paint,310,false,'end'),`<path d="M80 ${y+98}H1000" stroke="${ink}" stroke-opacity=".2"/>`);chart(m.key,85,y+25,480,45)});
  }else if(o.template==='daybalance'){
   parts.push(text(metrics[0].label,80,top+140,19,700,secondary),text(metrics[0].value,80,top+213,68,800,paint,440),`<path d="M550 ${top+100}V${top+520}" stroke="${ink}" stroke-opacity=".25"/>`);chart('sleep',80,top+305,415,140);
   metrics.slice(1).forEach((m,i)=>{const y=top+130+i*220;parts.push(text(m.label,610,y,19,700,secondary),text(m.value,610,y+62,54,800,paint,390));chart(m.key,610,y+95,390,58)});
  }else if(o.template==='dayribbon'){
   metrics.forEach((m,i)=>{const x=80+i*320;parts.push(`<rect x="${x}" y="${top+110}" width="295" height="410" rx="28" fill="${ink}" fill-opacity=".06"/>`,text(m.label,x+18,top+150,17,700,secondary,260),text(m.value,x+18,top+225,49,800,paint,260));chart(m.key,x+18,top+315,250,120,true)});
  }else if(o.template==='daypulse'){
   metrics.forEach((m,i)=>{const y=top+125+i*145;parts.push(text(m.label,80,y,18,700,secondary,300),text(m.value,1000,y+3,54,800,paint,490,false,'end'));chart(m.key,80,y+35,920,48)});
  }else if(o.template==='daymatrix'){
   const cols=history.slice(-7);metrics.forEach((m,i)=>{const x=80+i*320;parts.push(text(m.label,x,top+140,18,700,secondary,290),text(m.value,x,top+202,49,800,paint,290))});
   cols.forEach((r,i)=>{const x=260+i*104;parts.push(text(r.date.slice(8),x,top+290,17,600,secondary,90,false,'middle'))});
   metrics.forEach((m,j)=>{const y=top+350+j*75,values=cols.map(r=>r[m.key]).filter(valid),lo=Math.min(...values),hi=Math.max(...values);parts.push(text(m.label,80,y,14,600,secondary,120));cols.forEach((r,i)=>{const v=r[m.key],x=260+i*104;parts.push(`<rect x="${x-43}" y="${y-30}" width="86" height="52" rx="10" fill="${ink}" fill-opacity="${valid(v)?(.08+(hi===lo?.5:(v-lo)/(hi-lo))*.15):.03}"/>`,text(valid(v)?v.toLocaleString('en-GB',{maximumFractionDigits:1}):'—',x,y+3,21,700,paint,80,false,'middle'))})});
  }else if(o.template==='daycolumns'){
   metrics.forEach((m,i)=>{const x=80+i*320;parts.push(text(m.label,x,top+155,18,700,secondary,285),text(m.value,x,top+216,49,800,paint,285));chart(m.key,x,top+280,280,145)});
  }else{
   metrics.forEach((m,i)=>{const y=top+115+i*155,framed=o.template==='daypanels';if(framed)parts.push(`<rect x="65" y="${y-25}" width="950" height="145" rx="20" fill="none" stroke="${ink}" stroke-opacity=".3"/>`);parts.push(text(m.label,85,y+5,19,700,secondary,325),text(m.value,85,y+67,54,800,paint,325));chart(m.key,470,y,515,65,o.template==='daybars'||framed&&m.key==='score');});
  }
  const first=history[0]?.date,last=history.at(-1)?.date,dateLabel=(v:string)=>v.slice(8)+'/'+v.slice(5,7);
  parts.push(text(first&&last?dateLabel(first)+' — '+dateLabel(last)+' · gaps = missing readings':'History unavailable',80,top+570,17,400,secondary,920),`<path d="M80 ${top+595}H1000" stroke="${ink}" stroke-opacity=".25"/>`);
  if(!o.recoveryOnly){
   if(!sessions.length)parts.push(text('REST DAY',80,top+660,36,800));
   sessions.forEach((session,i)=>{const y=top+644+i*160;parts.push(text(session.title,80,y,19,700,secondary,920));session.stats.slice(0,3).forEach((stat,j)=>{const x=80+j*320;parts.push(text(compact(stat),x,y+65,o.template==='daycolumns'?49:54,800,paint,295),text(stat.label,x,y+96,17,500,secondary,295));});});
  }
  parts.push('</g>');
 }else if(['dayline','daytype','daytiles'].includes(o.template)){
  const top=cy-430,health=o.dayHealth??{},valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0,minutes=valid(health.sleep)?Math.round(health.sleep/60):null,sessions=(o.dayCards??[]).slice(1);
  const readings=[{label:'SLEEP',value:minutes===null?'Unavailable':`${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`},{label:'SLEEP SCORE',value:valid(health.score)&&health.score<=100?Math.round(health.score)+'/100':'Unavailable'},{label:'OVERNIGHT HRV',value:valid(health.hrv)&&health.hrv>0?Math.round(health.hrv)+' ms':'Unavailable'}];
  const paint=isChrome?'url(#metalSoft)':ink,line=(x:number,y:number,x2:number,y2:number,opacity=.35)=>`<path d="M${x} ${y}L${x2} ${y2}" fill="none" stroke="${ink}" stroke-opacity="${opacity}"/>`;
  function recovery(y:number){readings.forEach((r,i)=>{const x=80+i*320;parts.push(text(r.label,x,y,18,700,secondary,290),text(r.value,x,y+50,43,800,paint,290))})}
  function workouts(y:number,height=220){const step=Math.min(72,height/Math.max(1,sessions.length));if(!sessions.length)parts.push(text('REST DAY',80,y+30,38,800),text('No activities synced today',80,y+65,21,400));sessions.forEach((session,i)=>{const yy=y+i*step;parts.push(text(String(i+1).padStart(2,'0')+'  '+session.title,80,yy,Math.min(24,step*.38),700,ink,900),text(session.stats.slice(0,3).map(compact).join('   /   '),80,yy+step*.44,Math.min(23,step*.36),600,paint,900))})}
  parts.push(text(o.title.toUpperCase(),80,top+20,23,700,ink,920));
  if(o.template==='dayline'){
   parts.push(text('RECOVERY',80,top+115,26,600),line(80,top+155,1000,top+155));recovery(top+225);
   parts.push(line(80,top+330,1000,top+330),text('TRAINING',80,top+400,20,700));workouts(top+460,290);
  }else if(o.template==='daytype'){
   readings.forEach((r,i)=>{const y=top+125+i*145;parts.push(heavy(r.value,80,y,96,650,paint),text(r.label,1000,y-10,20,700,secondary,255,false,'end'),line(80,y+36,1000,y+36))});workouts(top+605,200);
  }else if(o.template==='daytiles'){
   parts.push(text('DAILY SUMMARY',80,top+95,28,600));
   const tiles=[...readings,...['duration','calories'].map(key=>{const stat=o.stats.find(s=>s.key===key);return {label:key==='duration'?'TRAINING TIME':'WORKOUT KCAL',value:stat?compact(stat):'Unavailable'}}),{label:'SESSIONS',value:String(sessions.length)}];
   tiles.forEach((r,i)=>{const x=80+i%3*320,y=top+150+Math.floor(i/3)*165;parts.push(`<rect x="${x}" y="${y}" width="300" height="145" rx="22" fill="none" stroke="${ink}" stroke-opacity=".45"/>`,text(r.label,x+18,y+36,16,700,secondary,265),text(r.value,x+18,y+100,44,800,paint,265))});workouts(top+555,245);
  }

  parts.push(text('Today’s recorded recovery + synced workouts',80,top+850,17,400,secondary,920));
 }else if(o.template==='dayrings'){
  const top=cy-440,health=o.dayHealth??{},sessions=(o.dayCards??[]).slice(1),valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  const minutes=valid(health.sleep)?Math.round(health.sleep/60):null,range=health.hrvRange,rangeValid=range&&valid(range[0])&&valid(range[1])&&range[1]>range[0];
  parts.push(text(o.title.toUpperCase(),80,top+22,28,600),`<path d="M80 ${top+56}H1000" stroke="${ink}" stroke-opacity=".2"/>`);
  const rings=[
   {label:'SLEEP',value:minutes===null?'—':`${Math.floor(minutes/60)}h${String(minutes%60).padStart(2,'0')}`,unit:'hours / minutes',ratio:minutes===null?null:minutes/480,note:'8h reference',color:'#a5a0ff'},
   {label:'SLEEP SCORE',value:valid(health.score)&&health.score<=100?String(Math.round(health.score)):'—',unit:'out of 100',ratio:valid(health.score)&&health.score<=100?health.score/100:null,note:'COROS · today',color:'#59d6c5'},
   {label:'OVERNIGHT HRV',value:valid(health.hrv)&&health.hrv>0?String(Math.round(health.hrv)):'—',unit:'milliseconds',ratio:valid(health.hrv)&&health.hrv>0&&rangeValid?health.hrv/range[1]:null,note:rangeValid?`Usual ${Math.round(range[0])}–${Math.round(range[1])} ms`:'Usual range unavailable',color:'#72bbff'}
  ];
  rings.forEach((ring,i)=>{const x=230+i*310,y=top+225,r=112,circ=2*Math.PI*r,ratio=ring.ratio===null?null:Math.max(0,Math.min(1,ring.ratio)),paint=isChrome?'url(#metalSoft)':ring.color;
   parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${ink}" stroke-opacity=".14" stroke-width="17"/>`);
   if(ratio!==null)parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${paint}" stroke-width="17" stroke-linecap="round" stroke-dasharray="${Math.max(.001,ratio*circ)} ${circ}" transform="rotate(-90 ${x} ${y})"/>`);
   if(i===2&&rangeValid){const angle=(range[0]/range[1]*360-90)*Math.PI/180;parts.push(`<circle cx="${x+Math.cos(angle)*r}" cy="${y+Math.sin(angle)*r}" r="5" fill="${ink}"/>`)}
   parts.push(text(ring.label,x,y-40,18,700,secondary,195,false,'middle'),text(ring.value,x,y+20,57,800,isChrome?'url(#metal)':ink,190,false,'middle'),text(ring.value==='—'?'Not recorded':ring.unit,x,y+51,16,500,secondary,195,false,'middle'),text(ring.note,x,y+150,19,500,secondary,290,false,'middle'));
  });
  parts.push(`<path d="M80 ${top+458}H1000" stroke="${ink}" stroke-opacity=".3"/>`,text('TODAY’S TRAINING',80,top+503,24,800),text(sessions.length+' '+(sessions.length===1?'SESSION':'SESSIONS'),1000,top+503,20,600,secondary,300,false,'end'));
  const step=Math.min(110,260/Math.max(1,sessions.length));sessions.forEach((session,i)=>{const y=top+552+i*step;parts.push(text(String(i+1).padStart(2,'0')+' / '+session.title,80,y,Math.min(27,step*.3),700,ink,910));session.stats.slice(0,3).forEach((stat,j)=>{const x=80+j*320;parts.push(text(compact(stat),x,y+step*.43,Math.min(34,step*.34),800,isChrome?'url(#metalSoft)':ink,290),text(stat.label,x,y+step*.68,Math.min(16,step*.18),500,secondary,290))});});
  if(!sessions.length)parts.push(text('REST DAY',80,top+580,48,800),text('No activities synced for today',80,top+625,25,500));
  parts.push(text('HRV ring: 0 to usual upper bound · dot: usual lower bound',80,top+848,16,400,secondary,920));
 }else if(o.template==='dayposter'){
  const top=cy-440,health=o.dayCards?.[0]?.stats??[],sessions=(o.dayCards??[]).slice(1),sleep=health.find(s=>s.key==='sleep'),hrv=health.find(s=>s.key==='hrv'),duration=o.stats.find(s=>s.key==='duration'),calories=o.stats.find(s=>s.key==='calories');
  const val=(s:ShareStat|undefined)=>s?compact(s):'Unavailable';
  const stat=(label:string,value:string,x:number,y:number,width=420)=>{parts.push(text(label.toUpperCase(),x,y,20,700,secondary,width),heavy(value,x,y+57,55,width));};
  const list=(y:number)=>{const step=Math.min(52,180/Math.max(1,sessions.length));if(!sessions.length)parts.push(text('REST DAY · NO SYNCED ACTIVITIES',80,y+30,22,700));sessions.forEach((session,i)=>{const summary=session.stats.slice(0,3).map(compact).join(' · ');parts.push(text(String(i+1).padStart(2,'0')+'  '+session.title,80,y+i*step,Math.min(22,step*.43),700,ink,440),text(summary,1000,y+i*step,Math.min(21,step*.42),500,ink,450,false,'end'))});};
   parts.push(text(o.title.toUpperCase(),80,top+25,26,700),heavy(val(duration),80,top+220,156,920),text('TRAINING TIME',85,top+270,24,600));
   stat('Workout calories',val(calories),80,top+365);stat('Sessions',String(sessions.length),565,top+365);
   stat('Sleep today',val(sleep),80,top+500);stat('Overnight HRV',val(hrv),565,top+500);
  list(top+665);
 }else if(o.template==='daystack'){
  const cards=o.dayCards??[],step=Math.min(190,(h-230)/Math.max(1,cards.length)),top=cy-cards.length*step/2;
  parts.push(text(o.title.toUpperCase(),100,top-30,32,800));
  cards.forEach((c,i)=>{const y=top+i*step;parts.push(`<rect x="80" y="${y}" width="920" height="${step-14}" rx="30" fill="${o.ink==='white'?'#333333':'#eeeeee'}" fill-opacity=".6"/>`,text(c.title,115,y+step*.23,Math.min(25,step*.16),700,ink,845));c.stats.slice(0,3).forEach((s,j)=>{const x=115+j*290;parts.push(text(compact(s),x,y+step*.55,Math.min(43,step*.23),800,ink,265),text(s.label,x,y+step*.76,Math.min(19,step*.12),400,ink,265))})});
 }else if(o.template==='bubble'){
  const words=o.stats.slice(0,2).map(compact).join(', '),y=cy-85;
  parts.push(`<rect x="120" y="${y}" width="820" height="160" rx="80" fill="#087eff"/><path d="M885 ${y+105}Q920 ${y+168}960 ${y+162}Q906 ${y+190}865 ${y+148}" fill="#087eff"/>`,text(words,530,y+103,65,500,'#ffffff',740,false,'middle'));
  parts.push(text((o.cycling?'Rode':o.sport==='Running'?'Ran':'Trained')+(o.time?' '+o.time:''),935,y+220,30,400,ink,800,false,'end'));
 }else if(o.template==='wide'||o.template==='weekbold'){
  if(o.template==='weekbold')parts.push(text('WEEK TOTALS · '+o.sport.toUpperCase(),540,cy-100,34,900,ink,950,false,'middle'));
  if(first)parts.push(text(compact(first).toUpperCase(),540,cy+40,170,900,ink,950,false,'middle').replace('Arial,Helvetica,sans-serif','Arial Black,Arial,Helvetica,sans-serif').replace(' font-size=', ' stroke="'+ink+'" stroke-width="2" font-size='));
  others.slice(0,3).forEach((s,i)=>parts.push(text(compact(s).toUpperCase(),72+i*320,cy+112,40,900,ink,295)));
  if(o.template==='weekbold')parts.push(text(o.date,540,cy+172,22,400,ink,936,false,'middle'));
 }else if(o.template==='weekday'){
  parts.push(text((o.weekday||o.title).toUpperCase(),540,cy-330,67,900,ink,930,false,'middle'),route(100,cy-255,880,450,7));
  if(first)parts.push(text(compact(first).toUpperCase(),540,cy+305,118,900,ink,940,false,'middle'));
 }else if(o.template==='glass'){
  parts.push(`<rect x="100" y="${cy-220}" width="880" height="440" rx="65" fill="${o.ink==='white'?'#555555':'#eeeeee'}" fill-opacity=".65"/>`,text(o.title,150,cy-138,51,800,ink,775));
  o.stats.slice(0,6).forEach((s,i)=>{const x=150+i%3*265,y=cy-40+Math.floor(i/3)*130;parts.push(text(s.label.toUpperCase(),x,y,18,500,ink,245),text(compact(s),x,y+49,42,800,ink,245))});
 }else if(o.template==='weekchart'){
  parts.push(text(o.sport+' · WEEKLY TOTALS',100,cy-310,35,800));
  o.stats.slice(0,3).forEach((s,i)=>{const x=100+i*300;parts.push(text(s.label,x,cy-235,23,500,ink,275),text(compact(s),x,cy-175,52,800,ink,275))});
  const days=o.weekDays??[],max=Math.max(1,...days.map(d=>d.value??0));
  days.forEach((d,i)=>{const x=120+i*135,y=cy+200,v=d.value;parts.push(text(d.label.toUpperCase(),x+40,y+52,22,700,ink,100,false,'middle'));if(v!==null){const hh=v/max*225;parts.push(`<rect x="${x}" y="${y-hh}" width="80" height="${Math.max(hh,2)}" rx="5" fill="${ink}" opacity=".8"/>`,text(v.toFixed(1),x+40,y-hh-18,26,700,ink,110,false,'middle'))}else parts.push(text('—',x+40,y-20,24,400,ink,100,false,'middle'))});
  parts.push(text('km · '+o.date,100,cy+330,23));
 }else if(o.template==='editorial'){
  parts.push(text(o.title.toUpperCase(),72,cy-150,26,800));
  if(first)parts.push(text(compact(first).toUpperCase(),62,cy+20,174,900,ink,950));
  others.slice(0,3).forEach((s,i)=>parts.push(text(compact(s),72+i*322,cy+90,39,800,ink,300)));
  if(o.date)parts.push(text(o.date,72,cy+142,21));
 }else if(o.template==='signature'){
  const n=o.stats.length,cols=Math.min(n,3),y=cy-(n>3?85:15);
  parts.push(text(o.title,540,y-94,44,800,ink,936,false,'middle'));
  if(o.date)parts.push(text(o.date,540,y-143,22,400,ink,936,false,'middle'));
  o.stats.forEach((s,i)=>{const x=72+(i%cols)*936/cols;const yy=y+Math.floor(i/cols)*130;parts.push(text(s.label,x,yy,22,400,ink,936/cols-22),text(compact(s),x,yy+55,44,800,ink,936/cols-22))});
 }else if(o.template==='split'){
  const shown=o.stats.slice(0,6),top=cy-(shown.length-1)*53;
  shown.forEach((s,i)=>parts.push(text(compact(s),540,top+i*106,82,800,ink,900,false,'middle')));
 }else if(o.template==='serif'){
  if(first)parts.push(text(compact(first)+'.',540,cy,110,400,ink,930,true,'middle'));
  parts.push(text(o.title,540,cy+65,27,400,ink,900,true,'middle'));
  if(others.length)parts.push(text(others.slice(0,2).map(compact).join('   /   '),540,cy+115,28,400,ink,900,false,'middle'));
 }else if(o.template==='route'){
  parts.push(text(o.title,540,cy-380,29,700,ink,930,false,'middle'));
  parts.push(route(150,cy-330,780,510,4));
  if(first)parts.push(text(compact(first).toUpperCase(),540,cy+300,108,900,ink,936,false,'middle'));
  const rest=others.slice(0,3);rest.forEach((s,i)=>parts.push(text(compact(s),72+i*936/rest.length,cy+365,29,700,ink,936/rest.length-20)));
 }else if(o.template==='bib'){
  const top=cy-255,bottom=cy+270;
  parts.push(`<path d="M160 ${top+60}V${top}H240 M840 ${top}h80v60 M160 ${bottom-60}v60h80 M840 ${bottom}h80v-60" fill="none" stroke="${ink}" stroke-width="4"/>`);
  parts.push(text(o.sport.toUpperCase(),540,top+65,26,800,ink,650,false,'middle'));
  if(first)parts.push(text(first.value,540,cy+38,210,900,ink,740,false,'middle'),text(first.unit.toUpperCase(),540,cy+98,35,700,ink,740,false,'middle'));
  parts.push(text(o.title.toUpperCase(),540,cy+170,24,700,ink,720,false,'middle'));
  if(o.date)parts.push(text(o.date,540,cy+218,19,400,ink,720,false,'middle'));
 }else if(o.template==='strip'){
  const shown=o.stats.slice(0,3),width=936/Math.max(1,shown.length);
  shown.forEach((v,i)=>{const x=72+i*width;parts.push(text(v.label.toUpperCase(),x,cy-32,18,600,ink,width-25),text(compact(v),x,cy+35,57,800,ink,width-28));if(i)parts.push(`<path d="M${x-17} ${cy-52}v102" stroke="${ink}" stroke-width="1" opacity=".4"/>`)});
  parts.push(text(o.title,72,cy+103,25,500));
 }else if(o.template==='outline'){
  parts.push(route(150,cy-350,780,700,3));
 }else if(o.template==='receipt'){
  const mono=(v:string,x:number,y:number,size=27,weight=400,width=820)=>text(v,x,y,size,weight,ink,width).replace('Arial,Helvetica,sans-serif','Courier New,monospace');
  const shown=o.stats.slice(0,6),top=cy-(shown.length*68+190)/2;
  parts.push(mono(o.sport.toUpperCase()+' / SESSION',130,top,24,700),mono(o.title,130,top+50,30,700));
  parts.push(`<path d="M130 ${top+83}H950" stroke="${ink}" stroke-dasharray="7 7" stroke-width="2"/>`);
  shown.forEach((v,i)=>{const y=top+142+i*68;parts.push(mono(v.label,130,y,23,400,400),text(compact(v),950,y,30,700,ink,380,false,'end').replace('Arial,Helvetica,sans-serif','Courier New,monospace'))});
  const bottom=top+shown.length*68+125;parts.push(`<path d="M130 ${bottom}H950" stroke="${ink}" stroke-dasharray="7 7" stroke-width="2"/>`);
  if(o.date)parts.push(mono(o.date,130,bottom+45,20));
 }else if(o.template==='hollow'){
  parts.push(text(o.title.toUpperCase(),72,cy-158,27,800));
  if(first){parts.push(text(first.value,64,cy+48,218,900,ink,950).replace(`fill="${ink}"`,`fill="none" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"`));if(explicitMode){parts.push(text(first.label.toUpperCase(),76,cy+109,25,700));if(first.unit)parts.push(text(first.unit,mode==='none'?76:mode==='icons'?120:370,cy+109,25,700,ink,635));}else parts.push(text(first.label.toUpperCase()+' / '+first.unit,76,cy+109,25,700))}
  others.slice(0,3).forEach((s,i)=>{const x=76+i*320;parts.push(text(compact(s),x,cy+200,42,800,ink,292),text(s.label,x,cy+238,20,400,ink,292))});
 }else if(o.template==='scorecard'){
  parts.push(text(o.title.toUpperCase(),72,cy-235,29,800));
  o.stats.slice(0,6).forEach((s,i)=>{const x=72+(i%3)*320,y=cy-125+Math.floor(i/3)*190;parts.push(text(String(i+1).padStart(2,'0'),x,y-30,18,500),text(compact(s),x,y+30,60,800,ink,285),text(s.label.toUpperCase(),x,y+70,18,500,ink,285),`<path d="M${x} ${y+100}h270" stroke="${ink}" stroke-width="1.5" opacity=".6"/>`)});
  if(o.date)parts.push(text(o.date,72,cy+290,21));
 }else if(o.template==='margin'){
  const shown=o.stats.slice(0,4),top=cy-shown.length*75;
  parts.push(`<path d="M78 ${top-65}V${top+shown.length*150-20}" stroke="${ink}" stroke-width="3"/>`,text(o.title.toUpperCase(),110,top-35,24,700,ink,840));
  shown.forEach((s,i)=>{const y=top+70+i*150;parts.push(text(compact(s),110,y,74,800,ink,780),text(s.label.toUpperCase(),113,y+39,20,400,ink,780))});
 }else if(o.template==='caption'){
  const y=h-325;
  parts.push(text(o.title.toUpperCase(),72,y-85,25,800));
  if(first)parts.push(text(compact(first),66,y+35,122,900,ink,948));
  others.slice(0,3).forEach((s,i)=>{const x=72+i*320;parts.push(text(compact(s),x,y+116,38,700,ink,285),text(s.label,x,y+151,20,400,ink,285))});
  if(o.date)parts.push(text(o.date,72,y+206,20));
 }else if(['halo','capsule','diamond','seal','orbit'].includes(o.template)){
  const y=cy-80,headline=first?compact(first):o.sport;
  const footer=(baseline:number)=>{if(others.length)parts.push(text(others.slice(0,3).map(compact).join('  ·  '),540,baseline,28,700,ink,890,false,'middle'));if(o.date)parts.push(text(o.date,540,baseline+40,20,400,ink,860,false,'middle'));};
  if(o.template==='halo'){
   parts.push(`<circle cx="540" cy="${y}" r="285" fill="none" stroke="${ink}" stroke-width="2"/><circle cx="540" cy="${y}" r="305" fill="none" stroke="${ink}" stroke-width="1" opacity=".35"/>`,text(o.sport.toUpperCase(),540,y-220,23,800,ink,500,false,'middle'),route(290,y-180,500,345,5),text(o.title,540,y+215,22,500,ink,440,false,'middle'));
   parts.push(text(headline,540,cy+335,105,900,ink,900,false,'middle'));footer(cy+390);
  }else if(o.template==='capsule'){
   parts.push(`<rect x="215" y="${cy-425}" width="650" height="820" rx="315" fill="none" stroke="${ink}" stroke-width="2"/>`,text(o.sport.toUpperCase(),540,cy-335,24,800,ink,460,false,'middle'),route(290,cy-275,500,370,5),text(headline,540,cy+195,86,900,ink,570,false,'middle'),text(o.title,540,cy+249,23,500,ink,545,false,'middle'));
   if(others.length)parts.push(text(others.slice(0,2).map(compact).join('  ·  '),540,cy+299,26,600,ink,495,false,'middle'));
  }else if(o.template==='diamond'){
   parts.push(`<path d="M540 ${y-305}L875 ${y}L540 ${y+305}L205 ${y}Z" fill="none" stroke="${ink}" stroke-width="2"/>`,route(350,y-150,380,300,5),text(o.sport.toUpperCase(),540,cy-425,25,800,ink,890,false,'middle'),text(headline,540,cy+355,105,900,ink,910,false,'middle'));footer(cy+407);
  }else if(o.template==='seal'){
   parts.push(`<circle cx="540" cy="${y}" r="305" fill="none" stroke="${ink}" stroke-width="3" stroke-dasharray="2 13" stroke-linecap="round"/><circle cx="540" cy="${y}" r="279" fill="none" stroke="${ink}" stroke-width="1" opacity=".6"/>`,text(o.sport.toUpperCase(),540,y-209,28,800,ink,450,false,'middle'),route(310,y-160,460,305,5),text(o.title.toUpperCase(),540,y+210,19,700,ink,440,false,'middle'));
   parts.push(text(headline,540,cy+335,105,900,ink,900,false,'middle'));footer(cy+390);
  }else{
   parts.push(`<path d="M325 ${y+205}A297 297 0 1 1 755 ${y+205}" fill="none" stroke="${ink}" stroke-width="2"/>`,route(305,y-210,470,345,5),text(o.sport.toUpperCase(),540,cy-425,25,800,ink,890,false,'middle'),text(headline,540,y+260,96,900,ink,890,false,'middle'),text(o.title,540,y+315,24,500,ink,890,false,'middle'));footer(y+367);
  }
 }else if(o.template==='routebadge'){
  parts.push(`<circle cx="540" cy="${cy-75}" r="292" fill="none" stroke="${ink}" stroke-width="2" opacity=".7"/>`,route(330,cy-285,420,420,5),text(o.sport.toUpperCase(),540,cy-410,25,800,ink,900,false,'middle'));
  if(first)parts.push(text(compact(first),540,cy+295,100,900,ink,936,false,'middle'));
  parts.push(text(o.title,540,cy+350,27,600,ink,930,false,'middle'));
  if(others.length)parts.push(text(others.slice(0,2).map(compact).join('  ·  '),540,cy+400,26,600,ink,930,false,'middle'));
 }else if(o.template==='panorama'){
  parts.push(text(o.title.toUpperCase(),72,cy-320,26,800),route(65,cy-270,950,380,5));
  const shown=o.stats.slice(0,3),width=936/Math.max(1,shown.length);
  shown.forEach((s,i)=>{const x=72+i*width;parts.push(text(compact(s),x,cy+230,68,800,ink,width-22),text(s.label.toUpperCase(),x,cy+278,20,500,ink,width-22))});
  if(o.date)parts.push(text(o.date,72,cy+350,20));
 }else if(o.template==='chrono'){
  const clock=o.stats.find(s=>s.key==='duration')??first;
  parts.push(text(o.title.toUpperCase(),72,cy-190,26,800));
  if(clock)parts.push(text(clock.value,65,cy+45,205,900,ink,950),text(clock.label.toUpperCase(),76,cy+106,24,500));
  o.stats.filter(s=>s!==clock).slice(0,3).forEach((v,i)=>parts.push(text(compact(v),72+i*322,cy+184,39,800,ink,298)));
 }else{
  const laps=(o.laps??[]).slice(0,16),step=Math.min(44,620/Math.max(1,laps.length)),top=cy-laps.length*step/2,max=Math.max(1,...laps.map(l=>l.value??0));
  parts.push(text('LAP',72,top-35,22,700),text(o.cycling?'KM/H':'PACE',172,top-35,22,700));
  laps.forEach((l,i)=>{const y=top+i*step,p=l.pace===null?null:Math.round(l.pace),v=o.cycling?(l.value===null?'—':(l.value*3.6).toFixed(1)):p===null?'—':`${Math.floor(p/60)}:${String(p%60).padStart(2,'0')}`;parts.push(text(String(l.index).padStart(2,'0'),72,y+25,27,800),text(v,172,y+25,27,800));if(l.value!==null)parts.push(`<rect x="325" y="${y+4}" width="${l.value/max*680}" height="${step-10}" rx="2" fill="${ink}"/>`)});
  if(first)parts.push(text(compact(first),72,top+laps.length*step+66,43,800));
  if((o.laps?.length??0)>16)parts.push(text('FIRST 16 RECORDED LAPS',72,top+laps.length*step+105,19));
 }
 if(!isRetro&&!isApproved&&o.route&&o.template!=='laps'&&!routeTemplates.includes(o.template))parts.push(route(840,100,165,165,3));
 if(o.brand&&!isRetro&&!isApproved)parts.push(text('sieste',72,h-48,23,700));
 if(o.demo&&!isRetro&&!isApproved)parts.push(text('ILLUSTRATIVE DATA',730,h-48,18,600,ink,280));
 // Finish every foreground element, including metadata, chart axes and icons.
 // Stroke gradients use canvas coordinates so horizontal/vertical paths render.
 let artwork=parts.join('');
 if(o.finish&&o.finish!=='solid'){
  const cardSurface=['ticket','metro','sweatreceipt','glass','daystack','bubble'].includes(o.template);
  const stops=c.map((color,i)=>`<stop offset="${i/(c.length-1)}" stop-color="${color}"/>`).join('');
  artwork='<defs><linearGradient id="finishStroke" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1080" y2="'+h+'">'+stops+'</linearGradient><linearGradient id="iconFinish" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="5" y2="24">'+stops+'</linearGradient></defs>'+artwork;
  const shadowGroups:boolean[]=[];
  artwork=artwork.replace(/<\/g>|<(text|path|circle|rect|line|polyline|polygon|ellipse|g)[^>]*>/g,tag=>{
   if(tag==='</g>'){shadowGroups.pop();return tag;}
   if(/^<g\b/.test(tag)&&!tag.endsWith('/>'))shadowGroups.push(tag.includes('data-retro-shadow="true"')||tag.includes('data-approved-shadow="true"'));
   if(shadowGroups.some(Boolean))return tag;
   if(tag.includes('width="1080"'))return tag;
   const isText=tag.startsWith('<text'),size=Number(tag.match(/font-size="([^"]+)"/)?.[1]??0);
   // Filled ticket/card surfaces stay dark to contrast with finished lettering.
   const surface=cardSurface&&/^<(?:path|rect)\b/.test(tag)&&/fill="(?!none|transparent)[^"]+"/.test(tag);
   if(surface)tag=tag.replace(/fill="[^"]*"/,'fill="#151a22"');
   else tag=tag.replace(/fill="(?!none|transparent)[^"]*"/,(isText&&size>=64||(isRetro||isApproved)&&tag.includes('fill="url(#metal)"'))?'fill="url(#metal)"':'fill="url(#metalSoft)"');
   return tag.replace(/stroke="(?!none|transparent)[^"]*"/,/data-(?:health|sport|metric)-icon=/.test(tag)?'stroke="url(#iconFinish)"':'stroke="url(#finishStroke)"');
  });
 }
 artwork=finishShareLettering(artwork,o.textThickness);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}" viewBox="0 0 1080 ${h}">${artwork}</svg>`;
}
