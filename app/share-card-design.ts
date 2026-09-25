import type {routeGeometry} from './route-geometry';
export type ShareTemplate='editorial'|'route'|'split'|'signature'|'serif'|'laps'|'bib'|'strip'|'outline'|'receipt'|'chrono'|'hollow'|'scorecard'|'margin'|'caption'|'routebadge'|'panorama';
export const routeTemplates:ShareTemplate[]=['route','outline','routebadge','panorama'];
export type ShareStat={key:string;label:string;value:string;unit:string};
export type ShareDesign={height:number;template:ShareTemplate;transparent:boolean;ink:'white'|'black';accent:string;title:string;sport:string;date:string;stats:ShareStat[];route:ReturnType<typeof routeGeometry>;brand:boolean;demo:boolean;laps?:{index:number;value:number|null;pace:number|null}[];cycling?:boolean};
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export function shareCardSvg(o:ShareDesign){
 const h=o.height,ink=!['#ffffff','#121826','#111111'].includes(o.accent)?o.accent:o.ink==='white'?'#ffffff':'#111111',parts:string[]=[];
 const compact=(s:ShareStat)=>s.value+(s.unit==='min:sec'||s.unit==='h:mm:ss'?'':s.unit==='/km'?'/km':' '+s.unit);
 function text(value:string,x:number,y:number,size=24,weight=400,color=ink,width=936,serif=false,anchor='start'){
 const estimate=[...value].length*size*(serif?.48:.58);
 return `<text x="${x}" y="${y}" fill="${color}" font-family="${serif?'Georgia,Times New Roman,serif':'Arial,Helvetica,sans-serif'}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}"${estimate>width?` textLength="${width}" lengthAdjust="spacingAndGlyphs"`:''}>${xml(value)}</text>`;
 }
 function route(x:number,y:number,w:number,hh:number,stroke=4){if(!o.route)return '';const {points,segments,center}=o.route,minX=points.reduce((n,p)=>Math.min(n,p.x),Infinity),maxX=points.reduce((n,p)=>Math.max(n,p.x),-Infinity),minY=points.reduce((n,p)=>Math.min(n,p.y),Infinity),maxY=points.reduce((n,p)=>Math.max(n,p.y),-Infinity),scale=Math.min((w-30)/Math.max(maxX-minX,1e-9),(hh-30)/Math.max(maxY-minY,1e-9));return segments.filter(s=>s.length>1).map(s=>{const stride=Math.max(1,Math.ceil(s.length/3000)),p=s.filter((_,i)=>i%stride===0||i===s.length-1).map((p,i)=>`${i?'L':'M'}${(x+w/2+(p.x-center.x)*scale).toFixed(2)},${(y+hh/2+(p.y-center.y)*scale).toFixed(2)}`).join(' ');return `<path d="${p}" fill="none" stroke="${ink}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`}).join('')}
 if(!o.transparent)parts.push(`<rect width="1080" height="${h}" fill="${o.ink==='white'?'#181818':'#fafafa'}"/>`);
 const first=o.stats[0],others=o.stats.slice(1),cy=h/2;
 // Each design is a standalone overlay; canvas padding stays transparent.
 if(o.template==='editorial'){
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
  if(first){parts.push(text(first.value,64,cy+48,218,900,ink,950).replace(`fill="${ink}"`,`fill="none" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"`));parts.push(text(first.label.toUpperCase()+' / '+first.unit,76,cy+109,25,700))}
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
 if(o.route&&o.template!=='laps'&&!routeTemplates.includes(o.template))parts.push(route(840,100,165,165,3));
 if(o.brand)parts.push(text('sieste',72,h-48,23,700));
 if(o.demo)parts.push(text('ILLUSTRATIVE DATA',730,h-48,18,600,ink,280));
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}" viewBox="0 0 1080 ${h}">${parts.join('')}</svg>`;
}
