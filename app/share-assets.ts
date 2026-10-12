import {shareAssetPaths} from './share-asset-index';
export type ShareGlyph=[number,number,number,number,number,string];
export type ShareFont={units:number;glyphs:Record<string,ShareGlyph>};
export type ApprovedArt={png:string;faceMask:string;width:number;height:number;originalBBox:number[];frontBBox:number[];source:{kind:string;components:number[]}};
export type ApprovedKind='running'|'cycling'|'recovery';
export type ApprovedAtlas={glyphs:Record<string,ApprovedArt>;groups:Record<string,ApprovedArt>;icons:Record<string,ApprovedArt>};
type AssetReader=(path:string)=>Promise<unknown>;
const assets=new Map<string,unknown>(),pending=new Map<string,Promise<void>>();
let collecting:Set<string>|null=null;
export class ShareAssetRequired extends Error{
 constructor(readonly path:string){super('Share artwork is loading');this.name='ShareAssetRequired';}
}
export function shareFont(family:'display'|'reference',face:string){
 const path=assetPath(`/share-assets/fonts/${family}-${face}.json`),font=assets.get(path);if(!font)throw new ShareAssetRequired(path);return font as ShareFont;
}
export function approvedArt(kind:ApprovedKind){
 const path=assetPath(`/share-assets/art/${kind}.json`),atlas=assets.get(path);if(!atlas)throw new ShareAssetRequired(path);return atlas as ApprovedAtlas;
}
export function shareImage(path:string){
 const image=assets.get(path);if(image)return image as string;
 if(collecting){collecting.add(path);return '';}
 throw new ShareAssetRequired(path);
}
/** Each synchronous render owns its collection, including concurrent galleries. */
export function collectShareAssets<T>(render:()=>T){
 const previous=collecting,requested=new Set<string>();collecting=requested;
 try{return {value:render(),requested:[...requested]};}finally{collecting=previous;}
}
async function browserAsset(path:string):Promise<unknown>{
 const response=await fetch(path,{cache:'force-cache'});if(!response.ok)throw new Error('Could not load share artwork. Try again.');
 if(path.split('?')[0].endsWith('.json'))return response.json();
 const blob=await response.blob(),url=URL.createObjectURL(blob);
 try{
  const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Could not decode share artwork.'));image.src=url;});
  // Embed the selected lossless WebP as PNG. Safari SVG exports and offline
  // re-exports remain self-contained, with the same transparent alpha edges.
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d');if(!context)throw new Error('PNG export is unavailable.');
  context.drawImage(image,0,0);return canvas.toDataURL('image/png');
 }finally{URL.revokeObjectURL(url);}
}
let reader:AssetReader=browserAsset;
const assetPath=(path:string)=>shareAssetPaths[path]??path;
export function loadShareAsset(path:string):Promise<void>{
 path=assetPath(path);
 if(assets.has(path))return Promise.resolve();
 const existing=pending.get(path);if(existing)return existing;
 const request=reader(path).then(value=>{assets.set(path,value);}).finally(()=>{pending.delete(path);});pending.set(path,request);return request;
}
/** File-backed reader for export regression tests; production uses fetch. */
export function setShareAssetReader(next:AssetReader){reader=next;assets.clear();pending.clear();}
