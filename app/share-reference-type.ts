import {shareFont} from './share-assets';

type Glyph=[number,number,number,number,number,string];
type Face={units:number;glyphs:Record<string,Glyph>};
export type ReferenceFace='wide'|'tall'|'serif'|'hand'|'condensed'|'editorial'|'slab';
const names:Record<ReferenceFace,string>={wide:'Archivo Black',tall:'Anton',serif:'Caprasimo',hand:'Kalam Light',condensed:'Bebas Neue',editorial:'DM Serif Display',slab:'Roboto Slab Black'};
const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const referenceFont=(face:ReferenceFace)=>(face==='tall'?shareFont('display','bold'):face==='serif'?shareFont('display','approved'):face==='condensed'?shareFont('display','tall'):face==='editorial'?shareFont('display','serif'):face==='slab'?shareFont('display','slab'):shareFont('reference',face)) as Face;

/** Tight painted dimensions for positioning an adjacent unit or caption. */
export function referenceTextSize(value:string,{width,height,face='wide'}:{width:number;height:number;face?:ReferenceFace}){
 value=value.normalize('NFC');
 if(!value.trim()||![width,height].every(Number.isFinite)||width<=0||height<=0)return {width:0,height:0};
 const font=referenceFont(face),glyphs=[...value].map(character=>font.glyphs[character]);
 if(glyphs.some(glyph=>!glyph)){
  const size=Math.min(height,width/Math.max(1,[...value].length*.62));
  return {width:Math.min(width,[...value].length*.62*size),height:size};
 }
 let cursor=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const glyph of glyphs){
  if(glyph[5]){minX=Math.min(minX,cursor+glyph[1]);maxX=Math.max(maxX,cursor+glyph[3]);minY=Math.min(minY,glyph[2]);maxY=Math.max(maxY,glyph[4]);}
  cursor+=glyph[0];
 }
 if(!Number.isFinite(minX)||maxX<=minX||maxY<=minY)return {width:0,height:0};
 const compression=face==='tall'?.72:1,scale=Math.min(height/(maxY-minY),width/((maxX-minX)*compression));
 return {width:(maxX-minX)*scale*compression,height:(maxY-minY)*scale};
}

/** Self-contained vector lettering. Boxes constrain natural letter proportions;
 * Anton alone has the deliberate narrow proportions of the condensed posters. */
export function referenceText(value:string,{x,y,width,height,face='wide',color='#fff',align='start'}:{x:number;y:number;width:number;height:number;face?:ReferenceFace;color?:string;align?:'start'|'middle'|'end'}){
 value=value.normalize('NFC');
 if(!value.trim()||![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return '';
 const font=referenceFont(face);
 const glyphs=[...value].map(character=>font.glyphs[character]);
 const annotation=`data-reference-face="${face}" data-reference-height="${height}" data-reference-font="${names[face]}" data-reference-text="${escape(value)}"`;
 if(glyphs.some(glyph=>!glyph)){
  const size=Math.min(height,width/Math.max(1,[...value].length*.62)),left=align==='middle'?x+width/2:align==='end'?x+width:x;
  return `<g ${annotation}><text x="${left}" y="${y+(height+size)/2}" text-anchor="${align==='middle'?'middle':align==='end'?'end':'start'}" font-family="Arial,Helvetica,sans-serif" font-weight="${face==='wide'?900:face==='tall'?800:400}" font-size="${size}" fill="${escape(color)}">${escape(value)}</text></g>`;
 }
 let cursor=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const glyph of glyphs){
  if(glyph[5]){minX=Math.min(minX,cursor+glyph[1]);maxX=Math.max(maxX,cursor+glyph[3]);minY=Math.min(minY,glyph[2]);maxY=Math.max(maxY,glyph[4]);}
  cursor+=glyph[0];
 }
 if(!Number.isFinite(minX)||maxX<=minX||maxY<=minY)return '';
 const compression=face==='tall'?.72:1,scale=Math.min(height/(maxY-minY),width/((maxX-minX)*compression)),sx=scale*compression;
 const paintedWidth=(maxX-minX)*sx,paintedHeight=(maxY-minY)*scale;
 const left=x+(align==='middle'?(width-paintedWidth)/2:align==='end'?width-paintedWidth:0),top=y+(height-paintedHeight)/2;
 cursor=0;
 const paths=glyphs.map(glyph=>{const position=cursor;cursor+=glyph[0];return glyph[5]?`<path d="${glyph[5]}" transform="translate(${position} 0)"/>`:'';}).join('');
 return `<g ${annotation} aria-label="${escape(value)}"><title>${escape(value)}</title><g fill="${escape(color)}" transform="translate(${(left-minX*sx).toFixed(3)} ${(top+maxY*scale).toFixed(3)}) scale(${sx.toFixed(6)} ${(-scale).toFixed(6)})">${paths}</g></g>`;
}

/** Replace a baseline-positioned SVG label with export-safe vector lettering.
 * The em size and original baseline stay consistent with its native text slot. */
export function referenceLabelText(value:string,{x,y,size,width,face='wide',color='#fff',anchor='start',weight=600,spacing=0}:{x:number;y:number;size:number;width:number;face?:ReferenceFace;color?:string;anchor?:'start'|'middle'|'end';weight?:number;spacing?:number}){
 value=value.normalize('NFC');
 if(!value.trim()||![x,y,size,width].every(Number.isFinite)||size<=0||width<=0)return '';
 const font=referenceFont(face),glyphs=[...value].map(character=>font.glyphs[character]),compression=face==='tall'?.72:1;
 const left=anchor==='middle'?x-width/2:anchor==='end'?x-width:x;
 if(glyphs.some(glyph=>!glyph))return referenceText(value,{x:left,y:y-size*.8,width,height:size,face,color,align:anchor});
 let cursor=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const glyph of glyphs){
  if(glyph[5]){minX=Math.min(minX,cursor+glyph[1]);maxX=Math.max(maxX,cursor+glyph[3]);minY=Math.min(minY,glyph[2]);maxY=Math.max(maxY,glyph[4]);}
  cursor+=glyph[0];
 }
 if(!Number.isFinite(minX)||maxX<=minX||maxY<=minY)return '';
 const tracking=Number.isFinite(spacing)?Math.max(0,Math.min(spacing,size*.25)):0,gaps=Math.max(0,glyphs.length-1),naturalScale=size/font.units;
 const naturalWidth=(maxX-minX)*compression*naturalScale+gaps*tracking,fit=Math.min(1,width/naturalWidth),scale=naturalScale*fit,sx=scale*compression;
 const paintedWidth=(maxX-minX)*sx+gaps*tracking*fit,start=x-(anchor==='middle'?paintedWidth/2:anchor==='end'?paintedWidth:0);
 cursor=0;
 const paths=glyphs.map((glyph,index)=>{const position=cursor+index*tracking*fit/sx;cursor+=glyph[0];return glyph[5]?`<path d="${glyph[5]}" transform="translate(${position.toFixed(6)} 0)"/>`:'';}).join('');
 const height=(maxY-minY)*scale;
 return `<g data-reference-face="${face}" data-reference-height="${height.toFixed(3)}" data-reference-font="${names[face]}" data-reference-text="${escape(value)}" data-reference-weight="${weight}" aria-label="${escape(value)}"><title>${escape(value)}</title><g fill="${escape(color)}" transform="translate(${(start-minX*sx).toFixed(3)} ${y.toFixed(3)}) scale(${sx.toFixed(6)} ${(-scale).toFixed(6)})">${paths}</g></g>`;
}
