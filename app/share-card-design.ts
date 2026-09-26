import type {routeGeometry} from './route-geometry';
export type ShareTemplate='editorial'|'route'|'split'|'signature'|'serif'|'laps'|'bib'|'strip'|'outline'|'receipt'|'chrono'|'hollow'|'scorecard'|'margin'|'caption'|'routebadge'|'panorama'|'bubble'|'wide'|'weekday'|'glass'|'weekbold'|'weekchart'|'daystack'|'velocity'|'ghost'|'routefile'|'ticket'|'monolith'|'podium'|'halo'|'capsule'|'diamond'|'seal'|'orbit'|'metro'|'sweatreceipt'|'excuse'|'croissant'|'chrome'|'chromebadge'|'chromeoutline'|'chromeheadline';
export const routeTemplates:ShareTemplate[]=['route','outline','routebadge','panorama','weekday','routefile','halo','capsule','diamond','seal','orbit','chromebadge'];
export type ShareStat={key:string;label:string;value:string;unit:string};
export type ShareDesign={height:number;template:ShareTemplate;transparent:boolean;finish?:'solid'|'chrome';ink:'white'|'black';accent:string;title:string;sport:string;date:string;stats:ShareStat[];route:ReturnType<typeof routeGeometry>;brand:boolean;demo:boolean;laps?:{index:number;value:number|null;pace:number|null}[];cycling?:boolean;weekday?:string;time?:string;dayCards?:{title:string;stats:ShareStat[]}[];weekDays?:{label:string;value:number|null}[]};
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
 const heavy=(value:string,x:number,y:number,size:number,width:number,color=ink)=>text(value,x,y,size,900,color,width).replace('Arial,Helvetica,sans-serif','Arial Black,Arial,Helvetica,sans-serif');
 const secondary=o.ink==='white'?'#ffffff':'#111111',rgb=[1,3,5].map(i=>parseInt(ink.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),contrast=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#111111':'#ffffff';
 const isChrome=o.template.startsWith('chrome')||o.finish==='chrome';
 if(isChrome)parts.push(`<defs><linearGradient id="metal" x1="0" y1="0" x2=".12" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".18" stop-color="#c8d0dc"/><stop offset=".39" stop-color="#faffff"/><stop offset=".48" stop-color="#9099a8"/><stop offset=".5" stop-color="#252b37"/><stop offset=".61" stop-color="#535e70"/><stop offset=".76" stop-color="#e6edf6"/><stop offset=".88" stop-color="#ffffff"/><stop offset="1" stop-color="#8993a3"/></linearGradient><linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffffff"/><stop offset=".45" stop-color="#7b8698"/><stop offset=".7" stop-color="#ffffff"/><stop offset="1" stop-color="#363e4b"/></linearGradient><linearGradient id="silverSurface" x1="0" y1="0" x2=".2" y2="1"><stop stop-color="#fafcff"/><stop offset=".4" stop-color="#bcc6d4"/><stop offset=".5" stop-color="#f7faff"/><stop offset=".55" stop-color="#a0adbf"/><stop offset="1" stop-color="#edf2f9"/></linearGradient></defs>`);
 const metal=(v:string,x:number,y:number,size:number,width:number,outline=false)=>{
  const glyph=heavy(v,x,y,size,width,'url(#metal)');
  return (outline?'':`<g transform="translate(0 5)">${glyph.replace('fill="url(#metal)"','fill="#252b37" stroke="#252b37" stroke-width="3"')}</g>`)+
   glyph.replace('fill="url(#metal)"',`fill="${outline?'none':'url(#metal)'}" stroke="url(#rim)" stroke-width="${outline?3:1.8}" paint-order="stroke fill"`);
 };
 if(o.template==='chrome'||o.template==='chromeoutline'){
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
  parts.push(text('SIESTE',130,top+72,47,900,print,360),text('PARIS · TICKET SPORT',950,top+68,23,800,print,480,false,'end'),text('ALLER SIMPLE / RETOUR EN SUEUR',130,top+151,22,700,print,805));
  if(first)parts.push(heavy(compact(first).toUpperCase(),124,top+253,117,825,print));
  parts.push(text(o.sport.toUpperCase()+' · '+o.title,130,top+299,23,700,print,810),text(others.slice(0,3).map(compact).join('   /   '),130,top+339,25,700,print,810),text('VALIDÉ PAR VOS JAMBES',130,top+462,24,800,print,600),text('S / 01',950,top+462,20,600,print,170,false,'end'),'</g>');
 }else if(o.template==='sweatreceipt'){
  const top=cy-350,black='#242424',mono=(v:string,x:number,y:number,size:number,w=730)=>text(v,x,y,size,600,black,w).replace('Arial,Helvetica,sans-serif','Courier New,monospace');
  parts.push(`<path d="M145 ${top}H935V${top+700}l-25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15 -25 -15 -25 15H145Z" fill="#faf7ef"/>`);
  parts.push(mono('REÇU DE TRANSPIRATION',185,top+68,33),mono('SIESTE / '+o.sport.toUpperCase(),185,top+116,23),`<path d="M185 ${top+151}H895" stroke="${black}" stroke-dasharray="7 7"/>`);
  o.stats.slice(0,4).forEach((v,i)=>{const y=top+212+i*74;parts.push(mono(v.label.toUpperCase(),185,y,20,330),text(compact(v),895,y,32,700,black,350,false,'end').replace('Arial,Helvetica,sans-serif','Courier New,monospace'))});
  parts.push(`<path d="M185 ${top+466}H895" stroke="${black}" stroke-dasharray="7 7"/>`,mono('PAIEMENT : EN SUEUR',185,top+528,31),mono('REMBOURSEMENT : UNE SIESTE',185,top+580,23),mono('Merci. Revenez transpirer.',185,top+635,21));
 }else if(o.template==='excuse'){
  const top=cy-300;
  parts.push(`<rect x="95" y="${top}" width="890" height="600" rx="20" fill="none" stroke="${ink}" stroke-width="3"/>`,text('ABSENCE JUSTIFIÉE',135,top+83,65,900,ink,805),text('J’ÉTAIS À L’ENTRAÎNEMENT.',135,top+143,29,800,ink,805));
  if(first)parts.push(heavy(compact(first),130,top+310,127,805));
  parts.push(text(others.slice(0,3).map(compact).join('   /   '),135,top+382,31,700,ink,805),`<g transform="rotate(-9 740 ${top+495})"><rect x="565" y="${top+438}" width="355" height="91" rx="6" fill="none" stroke="${ink}" stroke-width="5"/>`,text('EXCUSÉ·E',743,top+498,48,900,ink,320,false,'middle'),'</g>',text(o.sport.toUpperCase(),135,top+534,24,700,ink,390));
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
 if(o.route&&o.template!=='laps'&&!routeTemplates.includes(o.template))parts.push(route(840,100,165,165,3));
 if(o.brand)parts.push(text('sieste',72,h-48,23,700));
 if(o.demo)parts.push(text('ILLUSTRATIVE DATA',730,h-48,18,600,ink,280));
 // Apply the finish after layout so hollow lettering stays hollow and every
 // existing template keeps its geometry. Small labels stay flat for readability.
 let artwork=parts.join('');
 if(o.finish==='chrome'){
  const cardSurface=['ticket','metro','sweatreceipt','glass','daystack','bubble'].includes(o.template);
  artwork=artwork.replace(/<(text|path|circle|rect)[^>]*>/g,tag=>{
   if(tag.startsWith('<text')){
    const size=Number(tag.match(/font-size="([^"]+)"/)?.[1]??0);
    if(size<64||cardSurface)return tag;
    return tag.replace(/fill="(?!none|url\()[^"]*"/,'fill="url(#metal)"')
      .replace(/stroke="(?!none|url\()[^"]*"/,'stroke="url(#rim)"');
   }
   if(tag.includes('width="1080"'))return tag;
   return tag.replaceAll('fill="'+ink+'"','fill="url(#metal)"')
    .replaceAll('stroke="'+ink+'"','stroke="url(#metal)"')
    .replaceAll('fill="#087eff"','fill="url(#metal)"');
  });
  // Paper/card designs use a silver surface and contrasting flat print.
  if(cardSurface)artwork=artwork.replace(/(<(?:path|rect)[^>]*fill=")url\(#metal\)"/g,'$1url(#silverSurface)"').replaceAll('fill="#f0e4c9"','fill="url(#silverSurface)"').replaceAll('fill="#faf7ef"','fill="url(#silverSurface)"')
   .replaceAll('fill="#555555"','fill="url(#metal)"').replaceAll('fill="#eeeeee"','fill="url(#metal)"').replaceAll('fill="#333333"','fill="url(#metal)"')
   .replace(/(<text[^>]*fill=")[^"]*"/g,'$1#151a22"');
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}" viewBox="0 0 1080 ${h}">${artwork}</svg>`;
}
