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
for(const [seconds,expected] of [[59.4,'0:59'],[59.6,'1:00'],[3599.6,'1:00:00'],[3601,'1:00:01']])assert.equal(hero.clock(seconds),expected);
for(const seconds of [undefined,null,'60',0,-1,NaN,Infinity,-Infinity])assert.equal(hero.clock(seconds),null,'Invalid activity time is not formatted as a clock');

for(const [duration,expected] of [[59.4,'0:59'],[59.6,'1:00'],[119.6,'2:00'],[3599.6,'60:00']]){
 const pace=hero.heroMetrics([],'swimming',{duration,distance:100}).primary[0];
 assert.equal(pace.value,expected,'Swim pace carries rounded seconds into the next minute');
 assert.equal(pace.unit,'/100m');
}
for(const summary of [{duration:Infinity,distance:100},{duration:120,distance:Infinity},{duration:NaN,distance:100},{duration:120,distance:NaN},{duration:120,distance:0},{duration:0,distance:100},{duration:120,distance:1e-320}]){
 assert.deepEqual(hero.heroMetrics([],'swimming',summary).primary,[],'Invalid or overflowing swim totals never create a pace');
}
const card=(id,value='1')=>({id,title:id,value,unit:'',note:'',color:'',values:[],group:'Session',explanation:''});
const cards=['effort','calories','normalizedPower','heartrate','speed','power','duration','distance','altitude'].map(id=>card(id));
const ride=hero.heroMetrics(cards,'cycling');
assert.deepEqual(ride.primary.map(m=>m.id),['distance','duration','power'],'Cycling prioritizes distance, activity time and recorded power');
assert.deepEqual(ride.secondary.map(m=>m.id),['speed','heartrate','altitude','normalizedPower']);
assert.deepEqual(hero.heroMetrics([card('distance','—'),card('duration'),card('heartrate')],'running').primary.map(m=>m.id),['duration','heartrate'],'Missing headline values do not displace available metrics');
assert.deepEqual(hero.heroMetrics([card('calories','0'),card('heartrate')],'other').primary.map(m=>m.id),['heartrate','calories'],'Fallback sport order preserves a recorded zero');

const sports=module('app/sports.ts'),native=module('app/coros-native.ts'),power=module('app/cycling-power-data.ts',{'./sports':sports});
const metrics=module('app/activity-metrics.ts',{'./sports':sports,'./coros-native':native,'./cycling-power-data':power});
const imports=Object.fromEntries(['./deferred-panel','./workout-explorer.css','./activity-profile','./recorded-fields','./session-intelligence','./running-technique','./route-map','./activity-zones','./trend-badge','./workout-splits'].map(key=>[key,silentModule]));
const routeCallbacks=[];
Object.assign(imports,{
 // Folded rows render their content here so the tiles inside them can be checked.
 './deferred-panel':{__esModule:true,default:({children})=>React.createElement(React.Fragment,null,typeof children==='function'?children():children)},
 react:{useState:initial=>[initial,()=>{}],useMemo:fn=>fn(),useRef:initial=>({current:initial}),lazy:()=>Silent},
 './workout-insights':{workoutInsights:()=>({insights:[],mode:null})},
 './running-technique-data':{runningTechnique:()=>({rows:[],windows:[]})},
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
console.log('Workout hero: clock/pace boundaries, finite totals, sport priorities, retained details, stable selections and accessible dialog focus passed.');

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
const insights=module('app/workout-insights.ts',{'./effort-profile-data':{},'./activity-terrain-data':{},'./session-intelligence-data':{}});
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
console.log('Workout insights: section view choice, structured laps and effort source passed.');

// Sparse recording intervals must not create a split that never happened.
const pacingInsights=module('app/workout-insights.ts',{
 './effort-profile-data':{effortProfile:()=>({efforts:[],laps:[]})},
 './activity-terrain-data':{activityClimbAnalysis:()=>({climbs:[]})},
 './session-intelligence-data':{classifySession:()=>({label:'Other'}),runningSignals:()=>({})},
});
const pacing=distance=>pacingInsights.workoutInsights({seriesSampled:{sampleSize:30,data:{distance}}},'running').insights.find(i=>i.id==='pacing');
const steadyDistance=Array.from({length:12},(_,i)=>i*100);
assert.equal(pacing(steadyDistance)?.title,'Even pacing','A midpoint between samples preserves a constant-speed run');
assert.equal(pacing([0,100,200,300,400,500,600,800,1000,1200,1400,1600])?.title,'Negative split','Recorded acceleration still produces a negative split');
assert.equal(pacing(steadyDistance.map((d,i)=>i===6?null:d)),undefined,'Missing distance samples cannot establish whole-session pacing');
assert.equal(pacing([0,100,200,300,400,500,600,700,800,0,200,400,600,800,1000,1200]),undefined,'A distance reset cannot produce a pacing comparison');
console.log('Workout pacing: interpolated midpoint, acceleration, missing data and counter resets passed.');
