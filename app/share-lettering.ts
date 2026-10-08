/** Adjust the rendered lettering, including original bitmap artwork and outlined
 * display fonts. Routes, charts, panels and pictograms retain their own strokes. */
export const SHARE_TEXT_THICKNESS_MAX=12;

export function shareTextThickness(value:unknown){
 return typeof value==='number'&&Number.isFinite(value)?Math.max(-2,Math.min(SHARE_TEXT_THICKNESS_MAX,value)):0;
}

export function finishShareLettering(artwork:string,value:unknown){
 const thickness=shareTextThickness(value);
 if(!thickness)return artwork;
 const definitions=new Map<string,string>();
 const filter=(size:number,originalFace=false)=>{
  // Small captions need a lighter touch than the large display readings.
  // Keep existing settings exact; additional native-text weight is gentler so
  // the counters in compact numbers remain open at the new maximum.
  const magnitude=Math.abs(thickness);
  const expansion=(originalFace?magnitude:Math.min(magnitude,4))*.55;
  const radius=(expansion*Math.min(1,Math.max(.18,size/100))).toFixed(3);
  const id='shareWriting'+(thickness<0?'Thin':'Bold')+radius.replace('.','_');
  if(!definitions.has(id))definitions.set(id,`<filter id="${id}" x="-20%" y="-35%" width="140%" height="170%" color-interpolation-filters="sRGB">${thickness<0?`<feMorphology in="SourceAlpha" operator="erode" radius="${radius}" result="writingAlpha"/><feComposite in="SourceGraphic" in2="writingAlpha" operator="in"/>`:`<feMorphology in="SourceGraphic" operator="dilate" radius="${radius}" result="writingEdge"/><feMerge><feMergeNode in="writingEdge"/><feMergeNode in="SourceGraphic"/></feMerge>`}</filter>`);
  return ` filter="url(#${id})" data-text-thickness="${thickness}"`;
 };
 const stack:{lettering:boolean;shadow:boolean}[]=[];
 const result=artwork.replace(/<\/g>|<g\b[^>]*>|<text\b[^>]*>/g,tag=>{
  if(tag==='</g>'){stack.pop();return tag;}
  const inherited=stack.some(item=>item.lettering),shadow=stack.some(item=>item.shadow)||/data-(?:retro|approved)-shadow="true"/.test(tag);
  const lettering=/data-cinematic-face=/.test(tag)&&!shadow;
  if(tag.startsWith('<g')){
   if(!tag.endsWith('/>'))stack.push({lettering:inherited||lettering,shadow});
   return lettering&&!inherited?tag.replace(/>$/,filter(100,true)+'>'):tag;
  }
  if(inherited||shadow)return tag;
  const recordedSize=Number(tag.match(/font-size="([^"]+)"/)?.[1]??24);
  const size=Number.isFinite(recordedSize)?recordedSize:24;
  if(thickness>4){
   // A fractional outline adds weight smoothly instead of jumping a whole
   // morphology pixel, which can close small letter counters in PNG exports.
   const stroke=tag.match(/\bstroke="([^"]+)"/)?.[1];
   const colour=stroke&&stroke!=='none'?stroke:tag.match(/\bfill="([^"]+)"/)?.[1];
   if(colour&&colour!=='none'){
    const existing=Number(tag.match(/\bstroke-width="([^"]+)"/)?.[1]??0);
    const width=((Number.isFinite(existing)?existing:0)+(thickness-4)*.16*Math.min(1,Math.max(.18,size/100))).toFixed(3);
    const attribute=(name:string,value:string)=>{const pattern=new RegExp(`\\b${name}="[^"]*"`);tag=pattern.test(tag)?tag.replace(pattern,`${name}="${value}"`):tag.replace(/>$/,` ${name}="${value}">`)};
    attribute('stroke',colour);attribute('stroke-width',width);
    attribute('stroke-linejoin','round');attribute('paint-order','stroke fill');
   }
  }
  return tag.replace(/>$/,filter(size)+'>');
 });
 return '<defs>'+[...definitions.values()].join('')+'</defs>'+result;
}
