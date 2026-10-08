/** Adjust the rendered lettering, including original bitmap artwork and outlined
 * display fonts. Routes, charts, panels and pictograms retain their own strokes. */
export function shareTextThickness(value:unknown){
 return typeof value==='number'&&Number.isFinite(value)?Math.max(-2,Math.min(4,value)):0;
}

export function finishShareLettering(artwork:string,value:unknown){
 const thickness=shareTextThickness(value);
 if(!thickness)return artwork;
 const definitions=new Map<string,string>();
 const filter=(size:number)=>{
  // Small captions need a lighter touch than the large display readings.
  const radius=(Math.abs(thickness)*.55*Math.min(1,Math.max(.18,size/100))).toFixed(3);
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
   return lettering&&!inherited?tag.replace(/>$/,filter(100)+'>'):tag;
  }
  if(inherited||shadow)return tag;
  const size=Number(tag.match(/font-size="([^"]+)"/)?.[1]??24);
  return tag.replace(/>$/,filter(Number.isFinite(size)?size:24)+'>');
 });
 return '<defs>'+[...definitions.values()].join('')+'</defs>'+result;
}
