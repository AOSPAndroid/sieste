import faces from './share-display-glyphs.json';
import {cinemaWarp,warpedGlyph,type CinemaWarp} from './cinematic-warp';
type Glyph=[number,number,number,number,number,string];
export type DisplayFace='bold'|'tall'|'serif'|'wide'|'slab'|'retro';
const xml=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');

/** Top-aligned, self-contained outlined letters; no font downloads during export. */
export function cinematicText(value:string,{x,y,width,height,face='bold',color='#fff',outline=false,align='start',stretch=false,warp,warpBox}:{x:number;y:number;width:number;height:number;face?:DisplayFace;color?:string;outline?:boolean;align?:'start'|'middle';stretch?:boolean;warp?:CinemaWarp;warpBox?:{x:number;y:number;width:number;height:number}}){
 value=value.normalize('NFC');
 const font=faces[face] as unknown as {units:number;glyphs:Record<string,Glyph>};
 const letters=[...value],glyphs=letters.map(character=>font.glyphs[character]);
 if(!value.trim())return '';
 if(glyphs.some(glyph=>!glyph))return `<text x="${align==='middle'?x+width/2:x}" y="${y+height}"${align==='middle'?' text-anchor="middle"':''} font-family="Arial,Helvetica,sans-serif" font-size="${height}" textLength="${width}" lengthAdjust="spacingAndGlyphs" fill="${outline?'none':color}"${outline?` stroke="${color}" stroke-width="3"`:''}>${xml(value)}</text>`;
 const drawable=glyphs.filter(glyph=>glyph[5]);
 if(!drawable.length)return '';
 const minY=Math.min(...drawable.map(glyph=>glyph[2])),maxY=Math.max(...drawable.map(glyph=>glyph[4]));
 let advance=0,minX=Infinity,maxX=-Infinity;
 for(const glyph of glyphs){if(glyph[5]){minX=Math.min(minX,advance+glyph[1]);maxX=Math.max(maxX,advance+glyph[3]);}advance+=glyph[0];}
 const span=stretch?maxX-minX:Math.max(advance,maxX)-Math.min(0,minX),sy=height/Math.max(1,maxY-minY),sx=stretch?width/Math.max(1,span):Math.min(width/Math.max(1,span),sy*(face==='tall'?.8:1.25));
 const left=x+(align==='middle'?(width-advance*sx)/2:0);
 if(stretch){
  let cursor=0;
  const box=warpBox??{x,y,width,height},map=warp?cinemaWarp(warp,box.x,box.y,box.width,box.height):(point:{x:number;y:number})=>point;
  const paths=glyphs.map(glyph=>{const offset=cursor;cursor+=glyph[0];if(!glyph[5])return '';const project=(point:{x:number;y:number})=>({x:x+(offset+point.x-minX)*sx,y:y+(maxY-point.y)*sy});
   return warp?`<path d="${warpedGlyph(glyph[5],project,map)}"/>`:`<path d="${glyph[5]}" transform="translate(${(x+(offset-minX)*sx).toFixed(3)} ${(y+maxY*sy).toFixed(3)}) scale(${sx.toFixed(6)} ${(-sy).toFixed(6)})"/>`;
  }).join('');
  return `<g data-cinematic-face="${face}" data-cinematic-text="${xml(value)}"${warp?` data-cinematic-warp="${warp}"`:''} aria-label="${xml(value)}" fill="${outline?'none':color}"><title>${xml(value)}</title>${paths}</g>`;
 }
 let cursor=0;
 const paths=glyphs.map(glyph=>{const offset=cursor;cursor+=glyph[0];return glyph[5]?`<path d="${glyph[5]}" transform="translate(${offset} 0)"/>`:''}).join('');
 return `<g data-cinematic-face="${face}" data-cinematic-text="${xml(value)}" aria-label="${xml(value)}"><title>${xml(value)}</title><g transform="translate(${left.toFixed(3)} ${(y+maxY*sy).toFixed(3)}) scale(${sx.toFixed(6)} ${(-sy).toFixed(6)})" fill="${outline?'none':color}"${outline?` stroke="${color}" stroke-width="3" vector-effect="non-scaling-stroke"`:''}>${paths}</g></g>`;
}

export function cinematicTitleLines(title:string){
 const characters=[...title.trim().toUpperCase()];
 if(characters.length<=26)return [characters.join('')];
 const middle=Math.floor(characters.length/2),spaces=characters.map((letter,index)=>letter===' '?index:-1).filter(index=>index>0);
 const split=spaces.length?spaces.reduce((best,index)=>Math.abs(index-middle)<Math.abs(best-middle)?index:best):middle;
 return [characters.slice(0,split).join('').trim(),characters.slice(split).join('').trim()];
}
