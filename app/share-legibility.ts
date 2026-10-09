export type ShareLegibility='auto'|'light'|'dark'|'none';

function darkInk(ink:string){
 if(/^#[\da-f]{3}$/i.test(ink))ink='#'+[...ink.slice(1)].map(character=>character+character).join('');
 const match=/^#([\da-f]{6})$/i.exec(ink);
 if(!match)return false;
 const rgb=[0,2,4].map(i=>parseInt(match[1].slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722<.18;
}

/** Protect the actual exported foreground. No panel, photo or preview backdrop
 * is baked into a transparent PNG; original colours and materials stay intact. */
export function finishShareLegibility(artwork:string,{height,mode='auto',ink='#ffffff'}:{height:number;mode?:ShareLegibility;ink?:string}){
 if(mode==='none')return artwork;
 const light=mode==='light'||mode==='auto'&&darkInk(ink),edge=light?'#fffaf1':'#0a101c';
 const backdrop=artwork.match(/<rect width="1080" height="[^"]+" fill="[^"]+"\/>/)?.[0]??'';
 if(backdrop)artwork=artwork.replace(backdrop,'');
 // Crisp edges on every side protect small readings against both bright and
 // busy footage. Offset alpha keeps this cheap at 2160px without blur kernels.
 const definitions=`<defs><filter id="sharePhotoContrast" filterUnits="userSpaceOnUse" x="0" y="0" width="1080" height="${height}" color-interpolation-filters="sRGB"><feFlood flood-color="${edge}" flood-opacity=".94" result="edgeColour"/><feComposite in="edgeColour" in2="SourceAlpha" operator="in" result="edgeAlpha"/><feOffset in="edgeAlpha" dx="-2" result="edgeLeft"/><feOffset in="edgeAlpha" dx="2" result="edgeRight"/><feOffset in="edgeAlpha" dy="-2" result="edgeTop"/><feOffset in="edgeAlpha" dy="2" result="edgeBottom"/><feMerge><feMergeNode in="edgeLeft"/><feMergeNode in="edgeRight"/><feMergeNode in="edgeTop"/><feMergeNode in="edgeBottom"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
 return definitions+backdrop+`<g data-share-legibility="${mode}" data-share-edge="${light?'light':'dark'}" filter="url(#sharePhotoContrast)">${artwork}</g>`;
}
