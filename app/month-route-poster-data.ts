import {routeGeometry} from './route-geometry';
import {shareFinishes,type ShareFinish} from './share-card-design';
import {finishShareLegibility} from './share-legibility';

export type PosterRoute={id:string;date:string;distance:number|null;geometry:NonNullable<ReturnType<typeof routeGeometry>>};
export const MONTH_POSTER_ROUTES_PER_PAGE=12;
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const safeInk=(ink:string)=>/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(ink)?ink.length===4?'#'+[...ink.slice(1)].map(part=>part+part).join(''):ink:'#ffffff';

/** An editorial route collection, with each real route fitted independently.
 * Twelve routes is the maximum: dates and traces must survive a phone preview. */
export function monthRoutePoster(routes:PosterRoute[],title:string,finish:ShareFinish,ink:string,page=1,pages=1){
 const shown=routes.slice(0,MONTH_POSTER_ROUTES_PER_PAGE),solid=safeInk(ink);
 const palette=shareFinishes.find(f=>f.key===finish)?.colors,fill=palette?'url(#finish)':solid;
 const cols=shown.length===1?1:shown.length<=6?2:3,rows=Math.max(1,Math.ceil(shown.length/cols));
 const left=72,gapX=34,gapY=30,top=344,gridHeight=838;
 const cellW=(936-gapX*(cols-1))/cols,cellH=(gridHeight-gapY*(rows-1))/rows;
 const complete=shown.every(r=>typeof r.distance==='number'&&Number.isFinite(r.distance)&&r.distance>=0);
 const total=complete?shown.reduce((n,r)=>n+r.distance!,0)/1000:null;
 const pageCount=Math.max(1,Math.floor(Number.isFinite(pages)?pages:1)),pageNumber=Math.min(pageCount,Math.max(1,Math.floor(Number.isFinite(page)?page:1)));
 const count=shown.length<routes.length?`${shown.length} OF ${routes.length} ROUTES SHOWN`:`${shown.length} ${shown.length===1?'ROUTE':'ROUTES'}${pageCount>1?' · PAGE TOTAL':''}`;
 const titleText=title.trim().toUpperCase()||'MONTHLY ROUTES';
 const titleWidth=936,titleSize=30,titleEstimate=[...titleText].length*titleSize*.6;
 const heading=`<text x="72" y="112" font-size="${titleSize}" font-weight="700" letter-spacing="2"${titleEstimate>titleWidth?` textLength="${titleWidth}" lengthAdjust="spacingAndGlyphs"`:''}>${xml(titleText)}</text>`;
 const headline=total===null?`${shown.length} ${shown.length===1?'ROUTE':'ROUTES'}`:`${total.toFixed(1)} KM`;
 const headlineSize=headline.length>10?100:128;
 let artwork=`<g fill="${solid}" font-family="Arial,Helvetica,sans-serif">${heading}<text x="66" y="248" font-family="Arial Black,Arial,Helvetica,sans-serif" font-size="${headlineSize}" font-weight="900" letter-spacing="-5">${headline}</text><text x="72" y="300" font-size="28" font-weight="700" letter-spacing="1.2">${count}</text><path d="M72 324H1008" fill="none" stroke="${solid}" stroke-width="2" opacity=".55"/></g>`;
 shown.forEach((route,i)=>{
  // Centre a partial final row instead of leaving a single route in a corner.
  const row=Math.floor(i/cols),itemsInRow=Math.min(cols,shown.length-row*cols),rowOffset=(cols-itemsInRow)*(cellW+gapX)/2;
  const x=left+i%cols*(cellW+gapX)+rowOffset,y=top+row*(cellH+gapY),points=route.geometry.points;
  const minX=points.reduce((n,p)=>Math.min(n,p.x),Infinity),maxX=points.reduce((n,p)=>Math.max(n,p.x),-Infinity);
  const minY=points.reduce((n,p)=>Math.min(n,p.y),Infinity),maxY=points.reduce((n,p)=>Math.max(n,p.y),-Infinity);
  const inset=14,routeHeight=cellH-56,w=cellW-inset*2,h=routeHeight-inset*2;
  const scale=Math.min(w/Math.max(1e-9,maxX-minX),h/Math.max(1e-9,maxY-minY));
  const routeStroke=shown.length===1?11:shown.length<=6?8:6.5;
  route.geometry.segments.filter(segment=>segment.length>1).forEach(segment=>{
   const stride=Math.max(1,Math.ceil(segment.length/1600));
   const path=segment.filter((_,j)=>j%stride===0||j===segment.length-1).map((point,j)=>`${j?'L':'M'}${(x+cellW/2+(point.x-(minX+maxX)/2)*scale).toFixed(1)},${(y+routeHeight/2+(point.y-(minY+maxY)/2)*scale).toFixed(1)}`).join(' ');
   artwork+=`<path data-month-route="${xml(route.id)}" d="${path}" stroke="${fill}" stroke-width="${routeStroke}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  const distance=typeof route.distance==='number'&&Number.isFinite(route.distance)&&route.distance>=0?` · ${(route.distance/1000).toFixed(1)} KM`:'';
  const label=route.date.toUpperCase()+distance,labelEstimate=[...label].length*28*.57;
  artwork+=`<text x="${x+cellW/2}" y="${y+cellH-14}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="700" fill="${solid}"${labelEstimate>cellW?` textLength="${cellW}" lengthAdjust="spacingAndGlyphs"`:''}>${xml(label)}</text>`;
 });
 artwork+=`<g fill="${solid}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="700"><path d="M72 1228H1008" fill="none" stroke="${solid}" stroke-width="2" opacity=".55"/><text x="72" y="1284" font-size="30" font-weight="900" letter-spacing="-1">sieste</text><text x="1008" y="1284" text-anchor="end" letter-spacing="2">${pageCount>1?`${String(pageNumber).padStart(2,'0')} / ${String(pageCount).padStart(2,'0')}`:'ROUTES / MONTH'}</text></g>`;
 const gradient=palette?`<linearGradient id="finish" x1="0" y1="0" x2="1" y2="1">${palette.map((colour,i)=>`<stop offset="${i/(palette.length-1)*100}%" stop-color="${colour}"/>`).join('')}</linearGradient>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs>${gradient}</defs>${finishShareLegibility(artwork,{height:1350,mode:'auto',ink:solid})}</svg>`;
}
