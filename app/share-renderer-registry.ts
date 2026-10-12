import type {ShareDesign} from './share-design-catalog';
type Helpers={ink:string;route:(x:number,y:number,w:number,h:number,stroke?:number,inset?:number)=>string;sportIcon:(family:string,x:number,y:number,size:number,color:string)=>string;healthIcon:(key:string,x:number,y:number,size:number,color:string)=>string};
type Renderer=(design:ShareDesign,helpers:Helpers)=>string;
type Family='reference'|'approved'|'retro';
const renderers=new Map<Family,Renderer>();
export const registerShareRenderer=(family:Family,render:Renderer)=>{renderers.set(family,render);};
const render=(family:Family,design:ShareDesign,helpers:Helpers)=>{
 const renderer=renderers.get(family);if(!renderer)throw new Error('Share renderer is not ready.');return renderer(design,helpers);
};
export const renderReferenceShare=(design:ShareDesign,helpers:Pick<Helpers,'ink'>)=>render('reference',design,helpers as Helpers);
export const renderApprovedShare=(design:ShareDesign,helpers:Pick<Helpers,'ink'|'route'>)=>render('approved',design,helpers as Helpers);
export const renderRetroShare=(design:ShareDesign,helpers:Helpers)=>render('retro',design,helpers);
