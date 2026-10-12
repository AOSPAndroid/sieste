import type {ReferenceFace} from './share-reference-type';

/** Licensed vector outlines load only when selected, never with the homepage. */
export type ShareFontFace='wide'|'tall'|'condensed'|'editorial'|'slab'|'hand'|'oswald'|'action'|'poster'|'widescreen'|'cinema'|'modern';
export const shareFonts=[
 {key:'auto',name:'Original layout',font:'Original layout typography',description:'The original minimal typography'},
 {key:'modern',name:'Clean sans',font:'Space Grotesk Bold',description:'Simple, clear lettering'},
 {key:'wide',name:'Bold sans',font:'Archivo Black',description:'Strong numbers with clean lines'}
] as const;

// Older exports keep their selected outlines; the editor offers only simple typography.
const supportedFaces=new Set<string>(['wide','tall','condensed','editorial','slab','hand','oswald','action','poster','widescreen','cinema','modern']);

export function resolveShareFont(face:unknown,fallback:ReferenceFace='wide'):ReferenceFace{
 return typeof face==='string'&&supportedFaces.has(face)?face as ShareFontFace:fallback;
}

export function supportsShareFont(template:string){
 return template.startsWith('day')||template.startsWith('ref')&&template!=='refroute';
}
