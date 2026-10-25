import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

function module(path,imports={}){
 const exports={},source=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 new Function('require','exports','React',source)(key=>{if(!(key in imports))throw new Error(`Unknown test import ${key}`);return imports[key]},exports,React);
 return exports;
}
const Silent=()=>null,silentModule={__esModule:true,default:Silent};
const hero=module('app/workout-hero.tsx',{'lucide-react':{X:Silent}});
for(const [duration,expected] of [[59.4,'0:59'],[59.6,'1:00'],[119.6,'2:00'],[3599.6,'60:00']]){
 const pace=hero.swimPace({duration,distance:100});
 assert.equal(pace.value,expected,'Swim pace carries rounded seconds into the next minute');
 assert.equal(pace.unit,'/100m');
}
for(const summary of [{duration:Infinity,distance:100},{duration:120,distance:Infinity},{duration:NaN,distance:100},{duration:120,distance:NaN},{duration:120,distance:0},{duration:0,distance:100},{duration:120,distance:1e-320}]){
 assert.equal(hero.swimPace(summary),null,'Invalid or overflowing swim totals never create a pace');
}
const sports=module('app/sports.ts'),native=module('app/coros-native.ts'),power=module('app/cycling-power-data.ts',{'./sports':sports});
const metrics=module('app/activity-metrics.ts',{'./sports':sports,'./coros-native':native,'./cycling-power-data':power});
const imports=Object.fromEntries(['./deferred-panel','./workout-explorer.css','./activity-profile','./recorded-fields','./session-intelligence','./running-technique','./route-map','./activity-zones','./trend-badge','./workout-splits'].map(key=>[key,silentModule]));
const routeCallbacks=[];
Object.assign(imports,{
 // Folded rows render their content here so the tiles inside them can be checked.
 './deferred-panel':{__esModule:true,default:({children})=>React.createElement(React.Fragment,null,typeof children==='function'?children():children)},
 react:{useState:initial=>[initial,()=>{}],useMemo:fn=>fn(),useRef:initial=>({current:initial}),lazy:()=>Silent},
 './workout-insights':{intensityLevels:()=>null,intensityColors:[]},
 'lucide-react':{Compass:Silent},
 './workout-context':{...silentModule,StrengthSummary:Silent},
 './workout-hero':hero,'./sports':sports,'./activity-metrics':metrics,
 './activity-profile':{__esModule:true,default:({onSelection})=>{routeCallbacks.push(onSelection);return null}},
 './trend':{sessionTrend:()=>null,vo2Trend:()=>null},
 './expansion':{ExpandButton:Silent},
 './widget-spark':{__esModule:true,default:({values})=>React.createElement('span',{'data-chart-values':JSON.stringify(values)})},
 recharts:Object.fromEntries(['ResponsiveContainer','ComposedChart','Line','Area','CartesianGrid','XAxis','YAxis','Tooltip'].map(key=>[key,Silent])),
});
const summary=module('app/activity-summary.tsx',imports).default;
const hike={id:'hike',sportType:'hiking',summary:{distance:5000,duration:3600,durationTotal:3900,altitude:{descent:300}},seriesSampled:{sampleSize:5,data:{altitude:[500,400,200]}}};
const html=renderToStaticMarkup(React.createElement(summary,{detail:hike,loading:false}));
assert.match(html,/Activity time/,'Activity time remains available as a detail card');
assert.match(html,/1h 5m 0s elapsed/,'The detail card preserves recorded elapsed time alongside the active-time hero');
assert.match(html,/↑ — · ↓ 300/,'A descent-only hike keeps its recorded descent even though the hero displays climbing');
assert.match(html,/data-chart-values="\[500,400,200\]"/,'The elevation detail card retains its sensor chart');
const onRouteSelection=()=>{};
for(let i=0;i<2;i++)renderToStaticMarkup(React.createElement(summary,{detail:hike,loading:false,onRouteSelection}));
assert.deepEqual(routeCallbacks.slice(-2),[onRouteSelection,onRouteSelection],'Profile receives a stable selection callback so its selection effect cannot retrigger a parent render loop');

// Execute the real mount effect against a dialog whose first map button is inert.
const analytics=ts.createSourceFile('analytics.tsx',readFileSync(new URL('../app/analytics.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let focusEffect;
function findFocus(node){if(ts.isCallExpression(node)&&node.expression.getText(analytics)==='useEffect'&&node.arguments[0]?.getText(analytics).includes('const previous=document.activeElement'))focusEffect=node.arguments[0];ts.forEachChild(node,findFocus)}
findFocus(analytics);assert.ok(focusEffect,'Workout dialog has a mount focus effect');
const focusSource=ts.transpileModule('const initializeFocus='+focusEffect.getText(analytics),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let focused=false,restored=false;
const inertMapButton={focus:()=>{}},closeButton={focus:()=>{focused=true}},previous={focus:()=>{restored=true}};
const documentMock={activeElement:previous,body:{style:{overflow:''}},querySelector:()=>({querySelector:selector=>selector==='.workout-hero-close'?closeButton:inertMapButton}),addEventListener:()=>{},removeEventListener:()=>{}};
const initializeFocus=new Function('document','manageScroll','onClose',focusSource+';return initializeFocus;')(documentMock,true,()=>{});
const cleanup=initializeFocus();assert.equal(focused,true,'Opening a cached GPS workout focuses its close button instead of an inert map control');
cleanup();assert.equal(restored,true);assert.equal(documentMock.body.style.overflow,'');
console.log('Workout hero: swim pace boundaries, finite totals, retained details, stable selections and accessible dialog focus passed.');

const dock=module('app/workout-map-dock.tsx',{react:{},'lucide-react':{},'./route-map':silentModule,'./expansion':{ExpandButton:Silent}});
const climb={start:10,end:40,label:'Climb 1',kind:'climb'};
assert.equal(dock.dockState(null,false,false),'none','No selection, no dock');
assert.equal(dock.dockState(climb,true,false),'none','The route map already shows the selection');
assert.equal(dock.dockState(climb,false,false),'open','A selection below the fold pins the map');
assert.equal(dock.dockState(climb,false,true),'collapsed','A folded dock leaves a way back');

// Attach the real dock button refs and run its handlers/layout effects across
// renders. Automatic visibility/selection changes must not move user focus.
const hookValues=[],focusMoves=[];let hookCursor=0,layoutEffects=[],mountedRefs=[];
const dockHooks={
 useState(initial){const i=hookCursor++;if(!(i in hookValues))hookValues[i]=initial;return [hookValues[i],value=>{hookValues[i]=typeof value==='function'?value(hookValues[i]):value}]},
 useRef(initial){const i=hookCursor++;return hookValues[i]??=( {current:initial} )},
 useEffect(){},useLayoutEffect(effect){layoutEffects.push(effect)},
};
const interactiveDock=module('app/workout-map-dock.tsx',{react:dockHooks,'lucide-react':{ChevronUp:Silent,MapPin:Silent},'./route-map':silentModule,'./expansion':{ExpandButton:Silent}}).default;
function renderDock(selection=climb){
 hookCursor=0;layoutEffects=[];for(const ref of mountedRefs)ref.current=null;mountedRefs=[];
 const tree=interactiveDock({detail:{},selection,anchor:null}),buttons=new Map();
 function attach(node){
  if(Array.isArray(node)){node.forEach(attach);return}if(!React.isValidElement(node))return;
  if(typeof node.type==='string'){
   const label=node.props['aria-label']??(node.props.className==='workout-map-dock-pill'?'Show on map':node.type);
   const element=node.type==='button'?{props:node.props,focus:options=>focusMoves.push({label,options})}:{querySelector:()=>null,closest:()=>null};
   if(node.type==='button')buttons.set(label,element);
   if(node.props.ref){node.props.ref.current=element;mountedRefs.push(node.props.ref)}
  }
  attach(node.props.children);
 }
 attach(tree);layoutEffects.forEach(effect=>effect());return buttons;
}
assert.equal(renderDock().size,0,'A visible route map does not need a dock');
hookValues[0]=false; // IntersectionObserver has reported that the route map scrolled away.
let dockButtons=renderDock();assert.equal(focusMoves.length,0,'Automatic dock opening preserves chart focus');
dockButtons.get('Hide map').props.onClick();dockButtons=renderDock();
assert.deepEqual(focusMoves.at(-1),{label:'Show on map',options:{preventScroll:true}},'Hiding the map transfers focus to its replacement show button');
dockButtons.get('Show on map').props.onClick();dockButtons=renderDock();
assert.deepEqual(focusMoves.at(-1),{label:'Hide map',options:{preventScroll:true}},'Showing the map transfers focus to its replacement hide button');
dockButtons.get('Hide map').props.onClick();renderDock();const movesBeforeSelection=focusMoves.length;
assert.ok(renderDock({...climb,revision:1}).has('Hide map'),'A new section reopens a folded map');
assert.equal(focusMoves.length,movesBeforeSelection,'A new chart selection retains focus on the chart control');
console.log('Workout map dock: manual fold/unfold retains keyboard focus; automatic opening preserves chart focus.');

// The section view a workout opens on, and the signals that choose it.
const insights=module('app/workout-insights.ts');
const pick=o=>insights.sectionMode({label:'Easy',efforts:0,climbs:0,gain:0,laps:0,structuredLaps:false,...o});
assert.equal(pick({label:'Intervals',efforts:5,climbs:4,gain:200}),'efforts','Interval work opens on its efforts even on a hilly route');
assert.equal(pick({efforts:4,climbs:4,gain:132}),'climbs','A hilly easy run opens on climbs');
assert.equal(pick({efforts:4,climbs:1,gain:20,laps:6,structuredLaps:true}),'laps','Hand-pressed laps beat incidental efforts');
assert.equal(pick({efforts:4,climbs:1,gain:20,laps:13}),'efforts','Auto laps do not carry the session');
assert.equal(pick({}),null,'Nothing found, nothing to open');
assert.equal(insights.lapsVary([{distance:1000},{distance:1000},{distance:1000},{distance:400}]),false,'Even auto laps (last one partial) are not structure');
assert.equal(insights.lapsVary([{summary:{distance:2000}},{distance:400},{distance:2000},{distance:400},{distance:300}]),true);
const streams=data=>({seriesSampled:{data}});
assert.equal(insights.effortSensor(streams({power:[0,210],speed:[8]}),'cycling'),'power');
assert.equal(insights.effortSensor(streams({heartrate:[0,0],speed:[3]}),'cycling'),'speed','Empty heart-rate samples do not count');
assert.equal(insights.effortSensor(streams({speed:[3.4],power:[220]}),'running'),'speed','Runs are read by pace');
// Intensity: levels from this workout's own spread, stops as gaps, smoothed over 30 s.
const ramp={seriesSampled:{sampleSize:10,data:{speed:[...Array(50)].map((_,i)=>i<5?0:2+i*.05)}}};
const levels=insights.intensityLevels(ramp,'running');
assert.equal(levels.sensor,'speed');
assert.deepEqual(levels.levels.slice(0,5),[null,null,null,null,null],'Stopped samples are gaps, not easy running');
assert.equal(levels.levels.at(-1),4);assert.equal(levels.levels[6],0);
assert.ok(levels.levels.slice(5).every((v,i,a)=>!i||v>=a[i-1]),'A steady build only ever climbs the scale');
assert.equal(insights.intensityLevels({seriesSampled:{sampleSize:10,data:{speed:[3,3,3,3,3,3,3,3,3,3,3,3]}}},'running'),null,'A perfectly even stream has nothing to colour');
const geometry=module('app/route-geometry.ts');
const pt=index=>({lat:0,lon:0,index,x:index,y:0});
const runs=geometry.intensitySegments([[pt(0),pt(1),pt(2),pt(3),pt(4)]],[0,0,1,null,1]);
assert.deepEqual(runs.map(r=>[r.level,r.points.map(p=>p.index)]),[[0,[0,1,2]],[1,[2]]].filter(r=>r[1].length>1),'Runs share their boundary point and break at gaps');
console.log('Workout insights: section view choice, structured laps, effort source, intensity levels and route runs passed.');
