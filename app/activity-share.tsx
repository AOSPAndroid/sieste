"use client";
import {useEffect,useMemo,useState,useRef,useId} from 'react';
import {Share2,Download,Check,ChevronDown} from 'lucide-react';
import {shareWeek} from './share-week';
import {sportFamily,sportName} from './sports';
import {lapPreview} from './calendar-preview';
import {activityShareData} from './activity-share-data';
import {routeGeometry} from './route-geometry';
import {shareCardSvg,routeTemplates,routeStatTemplates,routeStatDesigns,shareFinishes,finishSwatch,shareSolidColours,shareColourContrast,type ShareFinish,type ShareTemplate,type ShareDesign} from './share-card-design';
const templates:{key:ShareTemplate;name:string;description:string}[]=[...routeStatDesigns,{key:'routegiant',name:'Oversized trace',description:'Bold full-canvas route · photo overlay'},{key:'cinemamonolith',name:'Monolith',description:'01 · towering condensed distance'},{key:'cinemaepic',name:'Epic',description:'02 · monumental cinema serif'},{key:'cinemawide',name:'Widescreen',description:'03 · wide geometric lettering'},{key:'cinemamission',name:'Mission',description:'04 · bold slab-serif lettering'},{key:'cinemalens',name:'Lens',description:'05 · curved fisheye lettering'},{key:'cinemawave',name:'Wave',description:'06 · flowing warped distance'},{key:'cinemabig',name:'Big screen',description:'Huge condensed distance · cinematic title'},{key:'cinemaday',name:'Weekday headline',description:'Tall weekday · towering numbers'},{key:'cinematitle',name:'Title poster',description:'Your title in bold display lettering'},{key:'cinematrace',name:'Route poster',description:'Weekday · route · oversized distance'},{key:'cinemaserif',name:'Editorial serif',description:'Sculpted serif distance · minimal pace'},{key:'cinemastack',name:'Stat statement',description:'Six large readings · no small print'},{key:'metro',name:'Métro ticket · FR',description:'French · Paris-inspired paper ticket'},{key:'metroen',name:'Métro ticket · EN',description:'English · Paris-inspired paper ticket'},{key:'sweatreceipt',name:'Sweat receipt · FR',description:'French · Payment in sweat, refund in naps'},{key:'sweatreceipten',name:'Sweat receipt · EN',description:'English · Payment in sweat, refund in naps'},{key:'excuse',name:'Excused absence · FR',description:'French · Officially busy training'},{key:'excuseen',name:'Excused absence · EN',description:'English · Officially busy training'},{key:'croissant',name:'Croissant contract · EN',description:'New · will train for croissants'},{key:'halo',name:'Double halo',description:'New · two fine rings, route and bold distance'},{key:'capsule',name:'Route capsule',description:'New · tall oval badge, all stats inside'},{key:'diamond',name:'Diamond route',description:'New · angular frame, route at its centre'},{key:'seal',name:'Club seal',description:'New · dotted circular seal and route'},{key:'orbit',name:'Open orbit',description:'New · open ring with distance at the base'},{key:'velocity',name:'Velocity',description:'New · slanted headline, fast typography'},{key:'ghost',name:'Ghost',description:'New · oversized type with outline echoes'},{key:'routefile',name:'Route file',description:'New · route crosshairs and heavy stats'},{key:'ticket',name:'Session ticket',description:'New · cut-out ticket, transparent surround'},{key:'monolith',name:'Stat monolith',description:'New · towering numbers, sharp stat rows'},{key:'podium',name:'Podium',description:'New · three bold, labelled stat headlines'},{key:'wide',name:'Bold distance',description:'Wide heavy lettering · three supporting stats'},{key:'bubble',name:'Message',description:'Blue message sticker · activity time'},{key:'weekday',name:'Day & route',description:'Bold weekday · route · distance'},{key:'glass',name:'Soft card',description:'Translucent rounded card · six stats'},{key:'weekbold',name:'Weekly headline',description:'Same-sport totals · activity’s calendar week'},{key:'weekchart',name:'Weekly bars',description:'Daily kilometres · same-sport weekly totals'},{key:'hollow',name:'Outline type',description:'New · hollow numbers, photo shows through'},{key:'scorecard',name:'Scorecard',description:'New · six clearly labelled stats'},{key:'margin',name:'Sideline',description:'New · a slim column of four stats'},{key:'caption',name:'Photo caption',description:'New · lower-edge stats, space for your photo'},{key:'routebadge',name:'Route badge',description:'New · circular route seal and distance'},{key:'panorama',name:'Panorama',description:'New · wide route and three key stats'},{key:'editorial',name:'Heavyweight',description:'Oversized numbers · tight typography'},{key:'signature',name:'Essentials',description:'A quiet, compact stat grid'},{key:'split',name:'Stack',description:'Just the numbers, beautifully set'},{key:'serif',name:'Sunday',description:'Refined editorial lettering'},{key:'route',name:'Route line',description:'Fine route outline · bold distance'},{key:'laps',name:'Lap bars',description:'Recorded laps · longer means faster'},{key:'bib',name:'Club bib',description:'Framed number · race-day typography'},{key:'strip',name:'Stat strip',description:'Three stats · one clean line'},{key:'outline',name:'Trace',description:'Nothing but your route'},{key:'receipt',name:'Session receipt',description:'Monospaced log · up to six stats'},{key:'chrono',name:'Chrono',description:'Your activity time, oversized'}];
const uri=(svg:string)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
export default function ActivityShare({activity,history=[],loading=false,dayActivities,dayHealth,recoveryOnly=false}:{activity:Record<string,any>;history?:Record<string,any>[];recoveryOnly?:boolean;dayActivities?:Record<string,any>[];dayHealth?:{date:string;sleep?:number;hrv?:number;score?:number;hrvRange?:[number,number];history?:{date:string;sleep:number|null;score:number|null;hrv:number|null}[]};loading?:boolean}){
 const studioRef=useRef<HTMLElement>(null),designToggleRef=useRef<HTMLButtonElement>(null),galleryId=useId(),[galleryOpen,setGalleryOpen]=useState(false);
 useEffect(()=>{
  const studio=studioRef.current;if(!studio)return;
  const panel=studio.closest('.workout-modal, .expanded-widget'),header=panel?.querySelector<HTMLElement>(':scope > header, :scope > .activity-sheet-heading'),toolbar=studio.querySelector<HTMLElement>('.share-export-toolbar');
  let scroller=studio.parentElement;
  while(scroller&&!/(auto|scroll)/.test(getComputedStyle(scroller).overflowY))scroller=scroller.parentElement;
  const measure=()=>{
   const sharesScroller=!!header&&!!scroller&&scroller.contains(header)&&getComputedStyle(header).position==='sticky';
   const headerTop=sharesScroller?parseFloat(getComputedStyle(header!).top)||0:0;
   const toolbarTop=Math.max(0,(sharesScroller?header!.getBoundingClientRect().height:0)+headerTop),toolbarHeight=toolbar?.getBoundingClientRect().height??60;
   const viewport=window.visualViewport,viewportTop=viewport?.offsetTop??0,viewportBottom=viewportTop+(viewport?.height??window.innerHeight),bounds=scroller?.getBoundingClientRect();
   const visibleHeight=bounds?Math.max(0,Math.min(bounds.bottom,viewportBottom)-Math.max(bounds.top,viewportTop)):viewportBottom-viewportTop;
   const available=Math.max(0,visibleHeight-toolbarTop-toolbarHeight-44);
   studio.style.setProperty('--share-toolbar-top',toolbarTop+'px');
   studio.style.setProperty('--share-toolbar-height',toolbarHeight+'px');
   studio.style.setProperty('--share-preview-height',Math.max(40,Math.min(680,available-8))+'px');
   studio.style.setProperty('--share-compact-preview-height',Math.max(40,Math.min(200,Math.floor(available*.32)))+'px');
  };
  measure();const observer=new ResizeObserver(measure);
  if(header)observer.observe(header);if(toolbar)observer.observe(toolbar);if(scroller)observer.observe(scroller);
  window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);panel?.addEventListener('animationend',measure);
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);panel?.removeEventListener('animationend',measure)};
 },[]);
 const model=useMemo(()=>{const m=activityShareData(activity);if(dayHealth){m.stats.push({key:'sessions',label:'Activities today',value:String(dayActivities?.length??0),unit:''});if(Number.isFinite(dayHealth.sleep)&&dayHealth.sleep!>=0){const minutes=Math.round(dayHealth.sleep!/60);m.stats.push({key:'sleep',label:'Sleep today',value:`${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`,unit:''})}if(Number.isFinite(dayHealth.hrv)&&dayHealth.hrv!>0)m.stats.push({key:'hrv',label:'Overnight HRV',value:String(Math.round(dayHealth.hrv!)),unit:'ms'})}return m},[activity,dayHealth,dayActivities]),[format,setFormat]=useState('square'),[exportScale,setExportScale]=useState<1|2>(2),[routeStroke,setRouteStroke]=useState(16),[statRouteStroke,setStatRouteStroke]=useState(28),[template,setTemplate]=useState<ShareTemplate>(recoveryOnly?'daytrends':dayActivities?'dayrings':'cinemabig'),[transparent,setTransparent]=useState(true),[ink,setInk]=useState<'white'|'black'>('white'),[accent,setAccent]=useState('#ffffff'),[finish,setFinish]=useState<ShareFinish>('solid'),[title,setTitle]=useState(activity.title||model.sport),[showDate,setShowDate]=useState(false),[brand,setBrand]=useState(false),[showLabels,setShowLabels]=useState(false),[showRoute,setShowRoute]=useState(false),[selected,setSelected]=useState<string[]|null>(null),[featured,setFeatured]=useState(''),[file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[message,setMessage]=useState('');
 const stats=model.stats.filter(s=>(selected??model.stats.slice(0,6).map(s=>s.key)).includes(s.key)).sort((a,b)=>(a.key===featured?-1:0)-(b.key===featured?-1:0)),series=activity.seriesSampled?.data??{},geometry=useMemo(()=>routeGeometry(series.positionLat??[],series.positionLong??[]),[series.positionLat,series.positionLong]),height=format==='story'?1920:format==='portrait'?1350:1080,date=new Date(activity.date);
 const routeOnly=template==='routegiant',routeWithStats=routeStatTemplates.includes(template),hasDrawableRoute=!!geometry?.segments.some(segment=>segment.length>1&&segment.some(point=>point.x!==segment[0].x||point.y!==segment[0].y)),canExport=routeOnly?hasDrawableRoute:stats.length>0&&(!routeWithStats||hasDrawableRoute);
 const laps=model.family==='strength_training'?[]:lapPreview(activity.laps??[],model.family==='cycling');
 const design:ShareDesign={routeStroke:routeWithStats?statRouteStroke:routeStroke,laps,cycling:model.family==='cycling',height,template,transparent,finish,ink,accent,showLabels,title:title||model.sport,sport:model.sport,sportFamily:model.family,date:showDate&&!isNaN(date.getTime())?date.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):'',stats,route:showRoute||routeTemplates.includes(template)?geometry:null,brand,demo:!!activity.demo};
 const week=useMemo(()=>shareWeek(activity,history),[activity,history]);
 const weekly=(t:ShareTemplate)=>t==='weekbold'||t==='weekchart';
 const buildDesign=(t:ShareTemplate):ShareDesign=>({...design,template:t,routeStroke:routeStatTemplates.includes(t)?statRouteStroke:routeStroke,weekday:date.toLocaleDateString('en-GB',{weekday:'long'}),time:date.toLocaleTimeString('en-GB',{hour:'numeric',minute:'2-digit'}),...(weekly(t)?{stats:week.stats,date:week.label,title:model.sport,route:null,weekDays:week.days}:{route:routeTemplates.includes(t)?geometry:design.route})});
 const dayMix=useMemo(()=>{const groups=new Map<string,number>();for(const a of dayActivities??[]){const seconds=a.summary?.duration;if(typeof seconds==='number'&&Number.isFinite(seconds)&&seconds>0){const family=sportFamily(a);groups.set(family,(groups.get(family)??0)+seconds)}}const colors=['#818cf8','#38bdf8','#fb923c','#34d399','#f472b6','#facc15'];return [...groups].map(([family,seconds],i)=>({label:sportName(family),seconds,color:colors[i%colors.length]}))},[dayActivities]);
 const dayCoverage={covered:(dayActivities??[]).filter(a=>typeof a.summary?.duration==='number'&&Number.isFinite(a.summary.duration)&&a.summary.duration>=0).length,total:dayActivities?.length??0};
 const allCardTemplates=dayActivities?[{key:'daytrends' as ShareTemplate,name:'Recovery trends',description:'Three fine-line charts · today’s values'},{key:'daycolumns' as ShareTemplate,name:'Recovery triptych',description:'Three columns · seven-day sparklines'},{key:'daybars' as ShareTemplate,name:'Seven nights',description:'Seven bars per metric · today highlighted'},{key:'daypanels' as ShareTemplate,name:'Recovery panels',description:'Framed readings · lines and score bars'},{key:'dayline' as ShareTemplate,name:'Daily essentials',description:'Minimal · fine rules and clean stats'},{key:'daytype' as ShareTemplate,name:'Type study',description:'Minimal · oversized recovery numbers'},{key:'daytiles' as ShareTemplate,name:'Metric tiles',description:'Minimal · six neatly framed readings'},{key:'dayledger' as ShareTemplate,name:'Recovery ledger',description:'Aligned readings · fine rules and mini charts'},{key:'daybalance' as ShareTemplate,name:'Split recovery',description:'Sleep in focus · score and HRV alongside'},{key:'daypulse' as ShareTemplate,name:'Recovery pulse',description:'Wide sparklines · bold right-aligned values'},{key:'dayrings' as ShareTemplate,name:'Recovery rings',description:'Sleep · score · HRV, then all today’s workouts'},{key:'dayribbon' as ShareTemplate,name:'Recovery ribbons',description:'Three vertical panels · seven nights of bars'},{key:'dayposter' as ShareTemplate,name:'Training time',description:'Oversized editorial type · your day in numbers'},{key:'daymatrix' as ShareTemplate,name:'Recovery matrix',description:'Seven-day readings · subtle intensity cells'},{key:'daystack' as ShareTemplate,name:'Today · training & recovery',description:'Every activity + today’s sleep and HRV'},...templates.filter(t=>!['weekbold','weekchart'].includes(t.key))]:templates;
 const cardTemplates=recoveryOnly?allCardTemplates.filter(t=>['daytrends','daycolumns','daybars','daypanels','dayledger','daybalance','dayribbon','daymatrix','daypulse'].includes(t.key)):allCardTemplates;
 const daysDesign=buildDesign(template);daysDesign.recoveryOnly=recoveryOnly;if(dayActivities)daysDesign.dayCards=dayActivities.map(a=>{const m=activityShareData(a);return {title:a.title||m.sport,sportFamily:m.family,stats:m.stats.slice(0,3)}});
 if(dayHealth){daysDesign.dayCards=[{title:'Sleep & recovery · '+dayHealth.date,stats:[model.stats.find(s=>s.key==='sleep')??{key:'sleep',label:'Sleep today',value:'Unavailable',unit:''},model.stats.find(s=>s.key==='hrv')??{key:'hrv',label:'Overnight HRV',value:'Unavailable',unit:''}]},...(daysDesign.dayCards??[])];}
 daysDesign.dayHealth=dayHealth;daysDesign.dayMix=dayMix;daysDesign.dayCoverage=dayCoverage;
 const svg=shareCardSvg(daysDesign),previewInk=finish!=='solid'?'white':!['#ffffff','#121826'].includes(accent)?shareColourContrast(accent)==='#ffffff'?'black':'white':ink;
 useEffect(()=>{let active=true;setFile(null);setError('');setMessage('');if(!canExport)return;const image=new Image();image.onload=()=>{if(!active)return;try{const canvas=document.createElement('canvas');canvas.width=1080*exportScale;canvas.height=height*exportScale;const ctx=canvas.getContext('2d');if(!ctx)throw Error();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(!active)return;if(!blob){setError('Could not create the PNG. Try another format.');return}setFile(new File([blob],`sieste-${model.family}-${template}-${1080*exportScale}w${transparent?'-transparent':''}.png`,{type:'image/png'}))},'image/png')}catch{setError('Image export is not available in this browser.')}};image.onerror=()=>{if(active)setError('Could not render this design. Try another layout.')};image.src=uri(svg);return()=>{active=false;image.onload=null;image.onerror=null}},[svg,height,exportScale,model.family,template,transparent,canExport]);
 function download(){if(!file)return;const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage(transparent?'Transparent PNG downloaded. Add it as an overlay in your photo or story editor.':'PNG downloaded.')}
 async function share(){if(!file)return;setError('');try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file]});setMessage('Share sheet closed.')}else{download();setMessage('File sharing is unavailable here. The PNG has been downloaded.')}}catch(e){if(e instanceof Error&&e.name==='AbortError')return;setError('Sharing could not open. Use Download PNG instead.')}}
 function toggle(key:string){const keys=selected??model.stats.slice(0,6).map(s=>s.key);setSelected(keys.includes(key)?keys.filter(k=>k!==key):keys.length<6?[...keys,key]:keys)}
 function chooseDesign(key:ShareTemplate){
  setTemplate(key);setGalleryOpen(false);
  const toggle=designToggleRef.current;
  if(toggle&&getComputedStyle(toggle).display!=='none')requestAnimationFrame(()=>{
   toggle.focus({preventScroll:true});toggle.scrollIntoView({block:'start',behavior:'instant'});
  });
 }
 return <section ref={studioRef} className="activity-share share-studio">
  <div className="share-export-toolbar" role="region" aria-label="Export selected design">
  <div className="share-export-label">
  <b>{cardTemplates.find(t=>t.key===template)?.name}</b>
  <small>{file?(transparent?'Transparent PNG':'PNG'):'Preparing PNG…'}</small>
  </div>
  <div className="share-actions">
  <button disabled={!file||!canExport} onClick={download} aria-label={transparent?'Download transparent PNG':'Download PNG'}>
  <Download size={16}/>
  <span>Save PNG</span>
  </button>
  <button disabled={!file||!canExport} onClick={share}>
  <Share2 size={16}/>Share</button>
  </div>{error&&<p role="alert" className="share-error">{error}</p>}{message&&<p role="status">{message}</p>}</div>
  <div className="share-editor">
  <header className="share-studio-heading">
  <span>ACTIVITY OVERLAYS</span>
  <h3>Made for your photos.</h3>
  </header>
  <button ref={designToggleRef} type="button" className="share-design-toggle" aria-expanded={galleryOpen} aria-controls={galleryId} onClick={()=>setGalleryOpen(open=>!open)}>
  <span>
  <small>Change design</small>
  <b>{cardTemplates.find(t=>t.key===template)?.name}</b>
  </span>
  <ChevronDown size={18}/>
  </button>
  <div id={galleryId} className={`share-template-grid${galleryOpen?' is-open':''}`} aria-label="Card designs">{cardTemplates.map(t=>{const unavailable=(weekly(t.key)&&(!week.count||!week.stats.length||(t.key==='weekchart'&&!week.stats.some(s=>s.key==='distance'))))||(routeTemplates.includes(t.key)&&!hasDrawableRoute)||(t.key==='laps'&&!laps.some(l=>l.value!==null));return <button key={t.key} disabled={unavailable} aria-pressed={template===t.key} onClick={()=>chooseDesign(t.key)}>
  <span className={`share-template-art ink-${previewInk}`}>
  <img src={uri(shareCardSvg({...buildDesign(t.key),dayCards:daysDesign.dayCards,dayHealth,dayMix,dayCoverage,recoveryOnly}))} alt=""/>{template===t.key&&<Check size={15}/>}</span>
  <b>{t.name}</b>
  <small>{unavailable?(loading?'Loading activity…':routeTemplates.includes(t.key)?'Needs a recorded route':weekly(t.key)?'Needs weekly history':'Needs recorded laps'):t.description}</small>
  </button>})}</div>{weekly(template)&&<p className="share-hint">{week.count} synced {model.sport.toLowerCase()} sessions · {week.label}. Totals use loaded history; incomplete metrics are omitted.</p>}{(routeOnly||routeWithStats)&&<label>Trace thickness<input aria-label="Trace thickness" type="range" min={routeWithStats?12:4} max={routeWithStats?40:28} step="2" value={routeWithStats?statRouteStroke:routeStroke} onChange={e=>(routeWithStats?setStatRouteStroke:setRouteStroke)(Number(e.target.value))}/>
  </label>}<fieldset className="share-accent-picker">
  <legend>Colour & finish{' · '+(finish==='solid'?(shareSolidColours.find(c=>c.color===accent)?.name??'Monochrome'):shareFinishes.find(f=>f.key===finish)?.name)}</legend>{[...shareSolidColours,{color:ink==='white'?'#ffffff':'#121826',name:'Monochrome'}].map(({color,name})=>
  <button key={name} style={{background:color}} aria-label={name} aria-pressed={finish==='solid'&&accent===color} title={name} onClick={()=>{setAccent(color);setFinish('solid')}}>{finish==='solid'&&accent===color&&<Check size={15} color={shareColourContrast(color)}/>}</button>)}{shareFinishes.map(f=>
  <button key={f.key} aria-label={f.name} title={f.name} aria-pressed={finish===f.key} style={{background:finishSwatch(f.colors)}} onClick={()=>setFinish(f.key)}>{finish===f.key&&<Check size={15} color="#111"/>}</button>)}</fieldset>{!routeOnly&&<>
  <label>Featured stat<select value={stats.some(s=>s.key===featured)?featured:stats[0]?.key??''} onChange={e=>setFeatured(e.target.value)}>{stats.map(s=>
  <option key={s.key} value={s.key}>{s.label}</option>)}</select>
  </label>
  <label>Title<input value={title} maxLength={60} onChange={e=>setTitle(e.target.value)}/>
  </label>
  </>}<div className="share-selects">
  <label>Canvas<select value={format} onChange={e=>setFormat(e.target.value)}>
  <option value="square">Square · 1:1</option>
  <option value="portrait">Portrait · 4:5</option>
  <option value="story">Story · 9:16</option>
  </select>
  </label>
  <label>PNG size<select value={exportScale} onChange={e=>setExportScale(e.target.value==='2'?2:1)}>
  <option value="2">Large · 2160 px wide</option>
  <option value="1">Standard · 1080 px wide</option>
  </select>
  </label>
  <label>{routeOnly?'Base colour':'Lettering'}<select value={ink} onChange={e=>setInk(e.target.value as 'white'|'black')}>
  <option value="white">White · for dark photos</option>
  <option value="black">Black · for light photos</option>
  </select>
  </label>
  </div>{!routeOnly&&<label className="share-check">
  <input type="checkbox" checked={showLabels} onChange={e=>setShowLabels(e.target.checked)}/>Text labels & chart details</label>}<label className="share-check">
  <input type="checkbox" checked={transparent} onChange={e=>setTransparent(e.target.checked)}/>Transparent background <span className="share-alpha-badge">PNG α</span>
  </label>{!recoveryOnly&&!routeOnly&&<fieldset>
  <legend>Stats · choose up to six</legend>{model.stats.map(s=>
  <label key={s.key}>
  <input type="checkbox" checked={stats.some(v=>v.key===s.key)} disabled={stats.length>=6&&!stats.some(v=>v.key===s.key)} onChange={()=>toggle(s.key)}/>{s.label}</label>)}</fieldset>}{!model.stats.length&&!routeOnly&&<p>No shareable stats supplied for this workout.</p>}<div className="share-visibility">{!routeOnly&&<label className="share-check">
  <input type="checkbox" checked={showDate} onChange={e=>setShowDate(e.target.checked)}/>Date</label>}<label className="share-check">
  <input type="checkbox" checked={brand} onChange={e=>setBrand(e.target.checked)}/>sieste signature</label>{!routeOnly&&<label className="share-check">
  <input type="checkbox" checked={showRoute||routeTemplates.includes(template)} disabled={!geometry||routeTemplates.includes(template)} onChange={e=>setShowRoute(e.target.checked)}/>Route outline {!geometry&&<small>({loading?'loading…':'no GPS'})</small>}</label>}</div>{design.route&&hasDrawableRoute&&<p className="share-hint">The full route shape will be visible in the image.</p>}<p className="share-hint">{transparent?'The checkerboard is preview-only. PNG downloads preserve transparency; receiving apps may flatten shared images.':'Exports exactly this card.'} Your private dashboard is never shared.</p>
  </div>
  <div className="share-preview-column">
  <div className={`share-preview ink-${previewInk} ${transparent?'is-transparent':''}`}>
  <img src={uri(svg)} alt={`${cardTemplates.find(t=>t.key===template)?.name} share preview: ${title}. ${routeOnly?'Recorded GPS route':stats.map(s=>s.label+' '+s.value+' '+s.unit).join(', ')}`}/>
  </div>
  <div className="share-preview-caption">
  <b>{cardTemplates.find(t=>t.key===template)?.name}</b>
  <span>{1080*exportScale} × {height*exportScale} · {transparent?'Transparent PNG':'PNG'}</span>
  </div>{!canExport&&<p>{(routeOnly||routeWithStats)&&!hasDrawableRoute?'Choose an activity with a recorded GPS route.':'Select at least one stat to export.'}</p>}</div>
  </section>
}
