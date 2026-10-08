import originalArt from './original-share-art.json';
import type {ShareDesign,ShareStat} from './share-card-design';
import {shareMetricLabel} from './share-labels';

export const approvedActivityDesigns=[
 {key:'approvedrun',name:'Café run · original',description:'The original yellow running sticker',color:'#ffdf00'},
 {key:'approvedride',name:'Club ride · original',description:'The original ivory cycling sticker',color:'#fff4d5'}
] as const;
export const approvedRecoveryDesigns=[
 {key:'approvedrecovery',name:'Blue recovery · original',description:'The original glossy blue recovery sticker',color:'#b7ddf2'}
] as const;
type Helpers={ink:string;route:(x:number,y:number,w:number,h:number,stroke?:number,inset?:number)=>string};
type Kind='running'|'cycling'|'recovery';
type Art={png:string;faceMask:string;width:number;height:number;originalBBox:number[];frontBBox:number[];source:{kind:string;components:number[]}};
const atlas=originalArt as unknown as {glyphs:Record<Kind,Record<string,Art>>;groups:Record<Kind,Record<string,Art>>;icons:Record<Kind,Record<string,Art>>};
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const known=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const clock=(stat:ShareStat)=>{const n=stat.value.split(':').map(Number);return n.length===3&&n.every(Number.isFinite)?`${n[0]}h${String(n[1]).padStart(2,'0')}`:stat.value;};

/** Original painted artwork supplies the lettering and materials; readings remain live. */
export function renderApprovedShare(o:ShareDesign,helpers:Helpers){
 const recovery=o.template==='approvedrecovery',ride=o.template==='approvedride',kind:Kind=recovery?'recovery':ride?'cycling':'running';
 const original=(!o.finish||o.finish==='solid')&&o.accent.toLowerCase()===(recovery?'#b7ddf2':ride?'#fff4d5':'#ffdf00');
 const parts:string[]=[],groups=atlas.groups[kind],icons=atlas.icons[kind];let sequence=0;
 const shadow=recovery?'#0647ec':ride?'#080655':'#d70000';
 parts.push('<defs><linearGradient id="originalSignal"><stop stop-color="#ddffff"/><stop offset=".5" stop-color="#63ccfa"/><stop offset="1" stop-color="#b9f5ff"/></linearGradient></defs>');
 // The drafts were 1280px. Keeping their source positions preserves their composition.
 parts.push(`<g data-approved-design="${o.template}" transform="translate(0 ${(o.height-1080)/2}) scale(.84375)">`);
 const art=(item:Art,x=item.originalBBox[0],y=item.originalBBox[1],w=item.width,h=item.height,attributes='')=>{
  const sx=w/item.width,sy=h/item.height,b=item.frontBBox,id='originalFace'+sequence++;
  const picture=`<image href="${item.png}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;
  const content=original?picture:`<g data-approved-shadow="true" fill="${shadow}">${picture}</g><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" style="mask-type:alpha"><image href="${item.faceMask}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/></mask></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" mask="url(#${id})" fill="${helpers.ink}"/>`;
  return `<g data-original-art="true"${original?' data-approved-material="true"':''} data-original-kind="${kind}" data-original-source="${xml(item.source.kind+':'+item.source.components.join(','))}" data-original-bounds="${x+b[0]*sx} ${y+b[1]*sy} ${b[2]*sx} ${b[3]*sy}" ${attributes}>${content}</g>`;
 };
 const front=(item:Art)=>[item.originalBBox[0]+item.frontBBox[0],item.originalBBox[1]+item.frontBBox[1],item.frontBBox[2],item.frontBBox[3]];
 const lettering=(value:string,reference:string)=>{
  const ref=groups[reference],box=front(ref);let body='';
  if(groups[value])body=art(groups[value],undefined,undefined,undefined,undefined,`data-original-group="${xml(value)}"`);
  else if(value==='—')body=`<path d="M${box[0]+box[2]/2-25} ${box[1]+box[3]/2}h50" fill="none" stroke="${original?o.accent:helpers.ink}" stroke-width="5" stroke-linecap="round"/>`;
  else{
   const glyphs=[...value].map(character=>({character,item:atlas.glyphs[kind][character]}));
   const height=box[3],gap=-height*.025;
   const layout=glyphs.map(({character,item})=>{const factor=character==='.'?.25:character===':'?.65:character==='m'||character==='s'?.72:1;const gh=height*factor;return {character,item,gh,gw:item?item.frontBBox[2]/item.frontBBox[3]*gh:height*.3};});
   const natural=layout.reduce((sum,g)=>sum+g.gw,0)+gap*Math.max(0,layout.length-1),sx=Math.min(1,box[2]/Math.max(1,natural));let cursor=box[0]+(box[2]-natural*sx)/2;
   for(const glyph of layout){const {item,gw,gh,character}=glyph;if(item){const scaleY=gh/item.frontBBox[3],scaleX=scaleY*sx;body+=art(item,cursor-item.frontBBox[0]*scaleX,box[1]+height-gh-item.frontBBox[1]*scaleY,item.width*scaleX,item.height*scaleY,`data-original-char="${xml(character)}"`);}cursor+=(gw+gap)*sx;}
  }
  return `<g data-cinematic-face="approved" data-cinematic-text="${xml(value)}" data-original-reading="${xml(value)}" aria-label="${xml(value)}"><title>${xml(value)}</title>${body}</g>`;
 };
 const icon=(name:string,key:string,health=false)=>{
  const mode=o.labelMode??'icons';
  if(mode==='none')return '';
  if(mode==='icons')return `<g ${health?'data-health-icon':'data-sport-icon'}="${key}" data-approved-filled-icon="true">${art(icons[name],undefined,undefined,undefined,undefined,`data-original-icon="${name}"`)}</g>`;
  const fullName=({running:'Running',cycling:'Cycling',sleep:'Sleep duration',hrv:'Heart rate variability',score:'Sleep score'} as Record<string,string>)[key]??key;
  const label=shareMetricLabel(key,fullName,mode),box=front(icons[name]),width=Math.max(box[2],health?390:420),size=mode==='full'?48:40,cx=box[0]+box[2]/2,cy=box[1]+box[3]/2;
  // Two lines keep the long HRV name legible at phone-preview size.
  const lines=mode==='full'&&key==='hrv'?['Heart rate','variability']:[label],lineHeight=size*1.15;
  const letters=lines.map((line,index)=>`<tspan x="${cx}" y="${cy+(index-(lines.length-1)/2)*lineHeight}"${line.length*size*.58>width?` textLength="${width}" lengthAdjust="spacingAndGlyphs"`:''}>${xml(line)}</tspan>`).join('');
  return `<g data-share-label-key="${xml(key)}" data-share-label-mode="${mode}"><text aria-label="${xml(label)}" x="${cx}" y="${cy}" fill="${original?o.accent:helpers.ink}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="700" text-anchor="middle" dominant-baseline="central">${letters}</text></g>`;
 };
 const stat=(s:ShareStat,body:string)=>`<g data-share-stat-key="${xml(s.key)}" data-stat-value="${xml(s.value)}" data-stat-unit="${xml(s.unit)}">${body}</g>`;
 const signature=()=>o.brand?`<g data-approved-brand="true" data-cinematic-face="approved" data-cinematic-text="sieste" data-original-reading="sieste"><title>sieste</title>${art(icons.signature,undefined,undefined,undefined,undefined,'data-original-icon="signature"')}</g>`:'';
 if(!recovery){
  const distance=o.stats.find(s=>s.key==='distance'),duration=o.stats.find(s=>s.key==='duration'),motion=o.stats.find(s=>s.key===(ride?'speed':'pace'));
  parts.push(icon(ride?'bicycle':'runner',ride?'cycling':'running'));
  parts.push(distance?stat(distance,`<g data-approved-hero="true">${lettering(distance.value,ride?'77.53':'10.01')}</g><g data-approved-unit="${ride?'below-right':'inline'}">${lettering(distance.unit||'km','km')}</g>`):lettering('—',ride?'77.53':'10.01'));
  // This is the original decorative flourish, rather than a claim about GPS data.
  if(ride)parts.push(`<g data-approved-ornament="true">${art(icons.route,undefined,undefined,undefined,undefined,'data-original-icon="route"')}</g>`);
  if(duration)parts.push(stat(duration,lettering(clock(duration),ride?'3h22':'51:00')));
  if(motion)parts.push(stat(motion,lettering(motion.value+motion.unit,ride?'23km/h':'5:06/km')));
  if(!ride&&duration&&motion)parts.push(`<g data-approved-shadow="true" fill="${shadow}"><circle cx="577" cy="917" r="15"/></g><circle cx="566" cy="904" r="12" fill="${original?o.accent:helpers.ink}"/>`);
 }else{
  const health=o.dayHealth??{},sleep=known(health.sleep)?health.sleep:null,hrv=known(health.hrv)&&health.hrv>0?health.hrv:null,score=known(health.score)&&health.score<=100?health.score:null;
  const mins=sleep===null?null:Math.round(sleep/60),sleepValue=mins===null?'—':`${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')}`;
  parts.push(icon('moon','sleep',true),icon('pulse','hrv',true),icon('star','score',true));
  for(const [key,value,reading,ref] of [['sleep',sleep,sleepValue,'8h01'],['hrv',hrv,hrv===null?'—':Math.round(hrv)+'ms','104ms'],['score',score,score===null?'—':Math.round(score)+'/100','85/100']] as const)parts.push(`<g data-approved-health-key="${key}" data-health-value="${value??''}">${lettering(reading,ref)}</g>`);
  const history=(health.history??[]).slice(-7);
  for(const key of ['hrv','score'] as const){
   const values=history.map(row=>row[key]),valid=(v:unknown):v is number=>known(v)&&(key==='hrv'?v>0:v<=100),recorded=values.filter(valid),low=recorded.length?Math.min(...recorded):0,high=recorded.length?Math.max(...recorded):1,x=key==='hrv'?215:730,w=key==='hrv'?310:322,base=994,amplitude=25,step=w/Math.max(1,values.length-1);let path='',previous=false,dots='';
   values.forEach((value,index)=>{if(!valid(value)){previous=false;return;}const xx=x+index*step,yy=base-(high===low?.5:(value-low)/(high-low))*amplitude;path+=(previous?'L':'M')+xx+' '+yy+' ';previous=true;
    const dot=icons.dot;const painted=dot?art(dot,xx-dot.width/2,yy-dot.height/2,dot.width,dot.height,'data-original-icon="dot"'):`<circle cx="${xx}" cy="${yy}" r="11" fill="${original?'url(#originalSignal)':helpers.ink}" stroke="${original?'#278ae7':helpers.ink}" stroke-width="3"/>`;
    dots+=`<g data-history-value="${value}" data-history-date="${xml(history[index].date)}" data-history-index="${index}">${painted}</g>`;
   });
   const trace=path?`<g data-approved-shadow="true" transform="translate(3 5)"><path d="${path.trim()}" fill="none" stroke="${shadow}" stroke-width="7"/></g><path data-history-segment="true" d="${path.trim()}" fill="none" stroke="${original?'url(#originalSignal)':helpers.ink}" stroke-width="5" stroke-linejoin="round"/>`:'';
   parts.push(`<g data-approved-history-key="${key}">${trace}${dots}</g>`);
  }
 }
 parts.push(signature());
 if(o.demo)parts.push(`<text data-approved-demo="true" x="640" y="1210" text-anchor="middle" fill="${original?o.accent:helpers.ink}" font-family="Arial,sans-serif" font-size="16">demo</text>`);
 parts.push('</g>');return parts.join('');
}
