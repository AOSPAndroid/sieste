export * from './share-design-catalog';
import type {ShareDesign} from './share-design-catalog';
import {collectShareAssets,loadShareAsset,ShareAssetRequired} from './share-assets';
import {registerShareRenderer} from './share-renderer-registry';
let renderer:typeof import('./share-card-renderer')|undefined;
const families=new Map<string,Promise<void>>();
async function prepareRenderer(template:string){
 const family=template.startsWith('ref')?'reference':template.startsWith('approved')?'approved':template.startsWith('retro')?'retro':null;
 if(family&&!families.has(family)){
  const request=(family==='reference'?import('./reference-share').then(module=>registerShareRenderer('reference',module.renderReferenceShare)):
   family==='approved'?import('./approved-share').then(module=>registerShareRenderer('approved',module.renderApprovedShare)):
   import('./retro-share').then(module=>registerShareRenderer('retro',module.renderRetroShare))).catch(error=>{families.delete(family);throw error;});
  families.set(family,request);
 }
 await Promise.all([renderer?Promise.resolve():import('./share-card-renderer').then(module=>{renderer=module;}),family?families.get(family):Promise.resolve()]);
}
/** Renderer code and font/art data are loaded only for the requested design. */
export async function renderShareCardSvg(design:ShareDesign):Promise<string>{
 await prepareRenderer(design.template);
 for(let attempt=0;attempt<16;attempt++){
  try{
   const {value,requested}=collectShareAssets(()=>renderer!.shareCardSvg(design));
   if(!requested.length)return value;
   await Promise.all(requested.map(loadShareAsset));
  }catch(error){if(error instanceof ShareAssetRequired)await loadShareAsset(error.path);else throw error;}
 }
 throw new Error('Could not prepare this design. Try another layout.');
}
/** Synchronous render for prepared data and the existing export regression suite. */
export function shareCardSvg(design:ShareDesign){
 if(!renderer)throw new Error('Use renderShareCardSvg before a synchronous render.');return renderer.shareCardSvg(design);
}
