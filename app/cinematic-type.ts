import faces from './share-display-glyphs.json';
type Glyph=[number,number,number,number,number,string];
export type DisplayFace='bold'|'tall'|'serif';
const xml=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');

/** Top-aligned, self-contained outlined letters; no font downloads during export. */
export function cinematicText(value:string,{x,y,width,height,face='bold',color='#fff',outline=false,align='start'}:{x:number;y:number;width:number;height:number;face?:DisplayFace;color?:string;outline?:boolean;align?:'start'|'middle'}){
 const font=faces[face] as unknown as {units:number;glyphs:Record<string,Glyph>};
 const letters=[...value],glyphs=letters.map(character=>font.glyphs[character]);
 if(!value.trim())return '';
 if(glyphs.some(glyph=>!glyph))return `<text x="${x}" y="${y+height}" font-family="Arial,Helvetica,sans-serif" font-size="${height}" textLength="${width}" lengthAdjust="spacingAndGlyphs" fill="${outline?'none':color}"${outline?` stroke="${color}" stroke-width="3"`:''}>${xml(value)}</text>`;
 const drawable=glyphs.filter(glyph=>glyph[5]);
 if(!drawable.length)return '';
 const minY=Math.min(...drawable.map(glyph=>glyph[2])),maxY=Math.max(...drawable.map(glyph=>glyph[4]));
 const advance=glyphs.reduce((sum,glyph)=>sum+glyph[0],0),sy=height/Math.max(1,maxY-minY),sx=Math.min(width/Math.max(1,advance),sy*(face==='tall'?.8:1.25));
 const left=x+(align==='middle'?(width-advance*sx)/2:0);
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
