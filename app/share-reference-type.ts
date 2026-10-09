import originals from './share-display-glyphs.json';
import referenceFaces from './share-reference-glyphs.json';

type Glyph=[number,number,number,number,number,string];
type Face={units:number;glyphs:Record<string,Glyph>};
export type ReferenceFace='wide'|'tall'|'serif'|'hand';
const names:Record<ReferenceFace,string>={wide:'Archivo Black',tall:'Anton',serif:'Caprasimo',hand:'Kalam Light'};
const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const referenceFont=(face:ReferenceFace)=>(face==='tall'?originals.bold:face==='serif'?originals.approved:referenceFaces[face]) as unknown as Face;

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
