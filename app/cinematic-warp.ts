type Point={x:number;y:number};
type Segment={kind:'M'|'L'|'Q'|'C'|'Z';points:Point[]};
export type CinemaWarp='lens'|'wave';
const paths=new Map<string,Segment[]>();

// Font outlines contain straight, quadratic and cubic segments. Resolve their
// coordinates once; nonlinear warps must bend the edges as well as the curves.
function segments(path:string){
 const cached=paths.get(path);if(cached)return cached;
 const tokens=path.match(/[a-zA-Z]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g)??[],out:Segment[]=[];
 let i=0,command='',previous='',point:Point={x:0,y:0},start=point,control:Point|null=null;
 while(i<tokens.length){
  if(/^[a-zA-Z]$/.test(tokens[i]))command=tokens[i++];
  const kind=command.toUpperCase(),relative=command!==kind;
  const number=()=>Number(tokens[i++]);
  const next=()=>({x:number()+(relative?point.x:0),y:number()+(relative?point.y:0)});
  if(kind==='Z'){out.push({kind:'Z',points:[point,start]});point=start;control=null;previous=kind;command='';continue;}
  if(kind==='M'){point=next();start=point;out.push({kind:'M',points:[point]});command=relative?'l':'L';control=null;}
  else if(kind==='L'||kind==='H'||kind==='V'){
   const end=kind==='H'?{x:number()+(relative?point.x:0),y:point.y}:kind==='V'?{x:point.x,y:number()+(relative?point.y:0)}:next();
   out.push({kind:'L',points:[point,end]});point=end;control=null;
  }else if(kind==='Q'||kind==='T'){
   const reflected:Point=control&&['Q','T'].includes(previous)?{x:2*point.x-control.x,y:2*point.y-control.y}:point;
   const middle:Point=kind==='Q'?next():reflected,end=next();out.push({kind:'Q',points:[point,middle,end]});point=end;control=middle;
  }else if(kind==='C'||kind==='S'){
   const reflected:Point=control&&['C','S'].includes(previous)?{x:2*point.x-control.x,y:2*point.y-control.y}:point;
   const first:Point=kind==='C'?next():reflected,second=next(),end=next();out.push({kind:'C',points:[point,first,second,end]});point=end;control=second;
  }else throw new Error('Unsupported font outline command: '+kind);
  previous=kind;
 }
 paths.set(path,out);return out;
}

/** Sample in canvas space before warping, keeping outlines independent of fonts. */
export function warpedGlyph(path:string,project:(point:Point)=>Point,warp:(point:Point)=>Point){
 const coordinate=(point:Point)=>`${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
 return segments(path).map(segment=>{
  const points=segment.points.map(project);
  if(segment.kind==='M')return 'M'+coordinate(warp(points[0]));
  const length=points.slice(1).reduce((sum,point,i)=>sum+Math.hypot(point.x-points[i].x,point.y-points[i].y),0),steps=Math.max(1,Math.ceil(length/6));
  let line='';
  for(let step=1;step<=steps;step++){
   const t=step/steps,u=1-t;
   const point=points.length===2?{x:u*points[0].x+t*points[1].x,y:u*points[0].y+t*points[1].y}:points.length===3?{x:u*u*points[0].x+2*u*t*points[1].x+t*t*points[2].x,y:u*u*points[0].y+2*u*t*points[1].y+t*t*points[2].y}:{x:u**3*points[0].x+3*u*u*t*points[1].x+3*u*t*t*points[2].x+t**3*points[3].x,y:u**3*points[0].y+3*u*u*t*points[1].y+3*u*t*t*points[2].y+t**3*points[3].y};
   line+='L'+coordinate(warp(point));
  }
  return line+(segment.kind==='Z'?'Z':'');
 }).join('');
}

// Both maps stay inside their allocated rectangle. The entire word shares the
// same map, so neighbouring glyphs and their counters bend continuously.
export function cinemaWarp(kind:CinemaWarp,x:number,y:number,width:number,height:number){
 return (point:Point)=>{
  const u=Math.max(0,Math.min(1,(point.x-x)/width)),v=(point.y-y)/height;
  if(kind==='wave')return {x:point.x,y:y+height*(.2+.6*v+.18*Math.sin(2*Math.PI*(u+.12)))};
  const bend=Math.sin(Math.PI*u),horizontal=(Math.sin((u-.5)*Math.PI*.88)/Math.sin(Math.PI*.44)+1)/2;
  return {x:x+width*horizontal,y:y+height*(.5+(v-.5)*(.55+.45*bend))};
 };
}
