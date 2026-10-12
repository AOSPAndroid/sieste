import type {ReferenceFace} from './share-reference-type';

/** These use existing, licensed outlines. Font data loads only when selected. */
export type ShareFontFace='wide'|'tall'|'condensed'|'editorial'|'slab'|'hand';
export const shareFonts=[
 {key:'auto',name:'Design default',font:'Original layout typography',description:'Keep the designer’s type pairing'},
 {key:'wide',name:'Archivo Black',font:'Archivo Black',description:'Strong, clean sans serif'},
 {key:'tall',name:'Anton',font:'Anton',description:'Compact, powerful headlines'},
 {key:'condensed',name:'Bebas Neue',font:'Bebas Neue',description:'Light, narrow athletic type'},
 {key:'editorial',name:'DM Serif Display',font:'DM Serif Display',description:'Elegant editorial serif'},
 {key:'slab',name:'Roboto Slab',font:'Roboto Slab Black',description:'A structured, confident serif'},
 {key:'hand',name:'Kalam',font:'Kalam Light',description:'Loose handwritten notes'}
] as const;

export function resolveShareFont(face:unknown,fallback:ReferenceFace='wide'):ReferenceFace{
 return shareFonts.some(option=>option.key!=='auto'&&option.key===face)?face as ShareFontFace:fallback;
}

export function supportsShareFont(template:string){
 return template.startsWith('day')||template.startsWith('ref')&&template!=='refroute';
}
