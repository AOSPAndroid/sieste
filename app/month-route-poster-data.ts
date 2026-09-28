import {routeGeometry} from './route-geometry';
import {shareFinishes,type ShareFinish} from './share-card-design';
export type PosterRoute={id:string;date:string;distance:number|null;geometry:NonNullable<ReturnType<typeof routeGeometry>>};
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function monthRoutePoster(routes:PosterRoute[],title:string,finish:ShareFinish,ink:string,page=1,pages=1){
 const palette=shareFinishes.find(f=>f.key===finish)?.colors;
 const fill=palette?'url(#finish)':ink,cols=routes.length<=6?2:3,rows=Math.max(1,Math.ceil(routes.length/cols)),cellW=936/cols,cellH=Math.min(285,1030/rows),top=260;
 const total=routes.every(r=>r.distance!==null)?routes.reduce((n,r)=>n+r.distance!,0)/1000:null;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs><linearGradient id="finish" x1="0" y1="0" x2="1" y2="1">${(palette??[]).map((c,i)=>`<stop offset="${i/(palette!.length-1)*100}%" stop-color="${c}"/>`).join('')}</linearGradient></defs><g fill="${fill}" font-family="Arial,Helvetica,sans-serif"><text x="72" y="100" font-size="30" font-weight="700">${xml(title.toUpperCase())}</text><text x="72" y="175" font-size="56" font-weight="900">${total===null?`${routes.length} ROUTES`:`${total.toFixed(1)} KM`}</text><text x="72" y="214" font-size="23">${routes.length} routes shown${pages>1?` · page ${page}/${pages} · page totals`:''}</text></g>`;
 routes.forEach((r,i)=>{const x=72+i%cols*cellW,y=top+Math.floor(i/cols)*cellH,points=r.geometry.points;const minX=points.reduce((n,p)=>Math.min(n,p.x),Infinity),maxX=points.reduce((n,p)=>Math.max(n,p.x),-Infinity),minY=points.reduce((n,p)=>Math.min(n,p.y),Infinity),maxY=points.reduce((n,p)=>Math.max(n,p.y),-Infinity),w=cellW-38,h=cellH-55,scale=Math.min(w/Math.max(1e-9,maxX-minX),h/Math.max(1e-9,maxY-minY));
 r.geometry.segments.filter(s=>s.length>1).forEach(s=>{const stride=Math.max(1,Math.ceil(s.length/800));svg+=`<path d="${s.filter((_,j)=>j%stride===0||j===s.length-1).map((p,j)=>`${j?'L':'M'}${(x+cellW/2+(p.x-(minX+maxX)/2)*scale).toFixed(1)},${(y+h/2+(p.y-(minY+maxY)/2)*scale).toFixed(1)}`).join(' ')}" stroke="${fill}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`});
 svg+=`<text x="${x+cellW/2}" y="${y+cellH-13}" text-anchor="middle" font-family="Arial" font-size="20" fill="${fill}">${xml(r.date)}${r.distance!==null?` · ${(r.distance/1000).toFixed(1)} km`:''}</text>`;
 });return svg+'</svg>';
}
