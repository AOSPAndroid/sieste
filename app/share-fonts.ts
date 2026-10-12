import type {ReferenceFace} from './share-reference-type';

/** Licensed vector outlines load only when selected, never with the homepage. */
export type ShareFontFace='wide'|'tall'|'condensed'|'editorial'|'slab'|'hand'|'oswald'|'action'|'poster'|'widescreen'|'cinema'|'modern';
export const shareFonts=[
 {key:'auto',name:'Design default',font:'Original layout typography',description:'Keep the designer’s type pairing',group:'Default'},
 {key:'poster',name:'Tall poster · Teko',font:'Teko SemiBold',description:'Tall, sculpted numbers with a film-poster feel',group:'Cinematic'},
 {key:'action',name:'Action · Barlow Condensed',font:'Barlow Condensed SemiBold Italic',description:'Forward-leaning lettering for speed and movement',group:'Cinematic'},
 {key:'widescreen',name:'Widescreen · Syncopate',font:'Syncopate Bold',description:'Wide, geometric titles with strong screen presence',group:'Cinematic'},
 {key:'cinema',name:'Cinema serif · Bodoni Moda',font:'Bodoni Moda SemiBold',description:'Sharp, elegant serifs for an understated film-title look',group:'Cinematic'},
 {key:'oswald',name:'Documentary · Oswald',font:'Oswald SemiBold',description:'Confident condensed lettering for clean sports stories',group:'Cinematic'},
 {key:'modern',name:'Modern title · Space Grotesk',font:'Space Grotesk Bold',description:'Precise, contemporary numbers with a quiet cinematic feel',group:'Cinematic'},
 {key:'wide',name:'Archivo Black',font:'Archivo Black',description:'Strong, clean sans serif',group:'Classic'},
 {key:'tall',name:'Anton',font:'Anton',description:'Powerful headlines with natural letter proportions',group:'Classic'},
 {key:'condensed',name:'Bebas Neue',font:'Bebas Neue',description:'Narrow athletic type',group:'Classic'},
 {key:'editorial',name:'DM Serif Display',font:'DM Serif Display',description:'Elegant editorial serif',group:'Classic'}
] as const;

export function resolveShareFont(face:unknown,fallback:ReferenceFace='wide'):ReferenceFace{
 // Keep explicit legacy values working without offering the weaker faces in the picker.
 return face==='hand'||face==='slab'||shareFonts.some(option=>option.key!=='auto'&&option.key===face)?face as ShareFontFace:fallback;
}

export function supportsShareFont(template:string){
 return template.startsWith('day')||template.startsWith('ref')&&template!=='refroute';
}
