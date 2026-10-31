import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';

// Run the real component handlers and effects with a small retained hook host.
// Sensor/route calculations are real; charts, icons and the modal are inert.
let active;
const Silent=()=>null,charts=new Map(),modules=new Map();
const hooks=Object.fromEntries(['useState','useRef','useMemo','useEffect','useSyncExternalStore'].map(key=>[key,(...args)=>active[key](...args)]));
const stubs={
 react:hooks,
 'lucide-react':new Proxy({},{get:()=>Silent}),
 recharts:new Proxy({},{get:(_,key)=>{if(!charts.has(key))charts.set(key,()=>null);return charts.get(key)}}),
 './expansion':{ExpandButton:Silent},
 './section-analysis':{__esModule:true,default:Silent},
 './cycling-advanced-data':{cyclingReference:()=>({ftp:null,weight:null}),effortBadges:()=>[]},
};
function load(path){
 if(modules.has(path))return modules.get(path);
 const exports={};modules.set(path,exports);
 const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 new Function('require','exports','React',source)(key=>{
  if(key in stubs)return stubs[key];if(key.endsWith('.css'))return {};
  const base='app/'+key.slice(2),resolved=[base+'.ts',base+'.tsx'].find(existsSync);
  if(!resolved)throw new Error(`Unknown import ${key} from ${path}`);return load(resolved);
 },exports,React);
 return exports;
}
function host(){
 const slots=[];let cursor=0,pending=[];
 const api={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},
  useRef(initial){const i=cursor++;return slots[i]??=({current:initial})},
  useMemo(fn){return fn()},
  useSyncExternalStore(_subscribe,snapshot){return snapshot()},
  useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||!deps||deps.some((value,index)=>!Object.is(value,old[index]))){slots[i]=deps;pending.push(fn)}},
  render(Component,props){active=api;cursor=0;pending=[];const tree=Component(props);for(const effect of pending)effect();return tree},
 };
 return api;
}
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):React.isValidElement(tree)?[tree,...nodes(tree.props.children)]:[]}
function text(tree){return Array.isArray(tree)?tree.map(text).join(''):React.isValidElement(tree)?text(tree.props.children):tree==null||typeof tree==='boolean'?'':String(tree)}
function button(tree,label){const result=nodes(tree).find(node=>node.type==='button'&&(node.props['aria-label']===label||text(node)===label));assert.ok(result,`Button exists: ${label}`);return result}
function card(tree,number){const group=nodes(tree).find(node=>node.props['aria-label']==='Select laps');return nodes(group).find(node=>node.type==='button'&&text(node).startsWith(`Lap ${number}`))}

const Profile=load('app/activity-profile.tsx').default,Laps=load('app/activity-laps.tsx').default,Mosaic=load('app/workout-lap-mosaic.tsx').default;
const {effortProfile}=load('app/effort-profile-data.ts'),{lapMosaic}=load('app/workout-lap-mosaic-data.ts');
const {routeGeometry,selectedRouteSegments,fitRouteSegments,contextualSelectionFit}=load('app/route-geometry.ts');
const detail={id:'synthetic-laps',sportType:'running',summary:{duration:600,durationTotal:720,distance:2100},seriesSampled:{sampleSize:5,data:{speed:Array(120).fill(3.5),heartrate:Array(120).fill(140),altitude:Array(120).fill(50),distance:Array.from({length:120},(_,i)=>(i+1)*17.5),positionLat:Array.from({length:120},(_,i)=>48+i*.0001),positionLong:Array.from({length:120},(_,i)=>2+i*.0001)}},laps:[{duration:180.5,distance:630,heartrate:130},{summary:{duration:119.8,distance:420,heartrate:155}},{duration:300.2,distance:1050,heartrate:140},{duration:110,heartrate:135}]};
const snapshot=JSON.stringify(detail),mapped=effortProfile(detail,'speed','running'),profileHost=host(),emitted=[];
const props={detail,compact:true,modeRequest:{mode:'laps',nonce:1},onSelection:selection=>emitted.push(selection)};
profileHost.render(Profile,props);let tree=profileHost.render(Profile,props);
assert.ok(card(tree,1));assert.ok(card(tree,2));assert.ok(card(tree,3));assert.equal(card(tree,4),undefined,'Unmatched laps never get a fabricated selectable card');
card(tree,2).props.onClick();tree=profileHost.render(Profile,props);
const selection=emitted.at(-1);
assert.equal(selection.label,'Lap 2');assert.equal(selection.kind,'lap');
assert.equal(selection.start,mapped.laps[1].start);assert.equal(selection.end,mapped.laps[1].end);
assert.equal(card(tree,2).props['aria-pressed'],true);
const highlight=nodes(tree).find(node=>node.type===charts.get('ReferenceArea')&&node.props.fill==='#6366f1');
assert.equal(highlight.props.x1,selection.start);assert.equal(highlight.props.x2,selection.end,'Chart shading uses the emitted route interval');
const geometry=routeGeometry(detail.seriesSampled.data.positionLat,detail.seriesSampled.data.positionLong),route=selectedRouteSegments(geometry.segments,5,selection);
assert.ok(route.flat().length>1);assert.ok(route.flat().every(point=>point.index*5/60>=selection.start&&point.index*5/60<selection.end));
assert.deepEqual(contextualSelectionFit(fitRouteSegments(route),'lap'),contextualSelectionFit(fitRouteSegments(route),'climb'),'Lap selection requests the same map framing as a climb');
card(tree,2).props.onClick();tree=profileHost.render(Profile,props);
assert.ok(emitted.at(-1).revision>selection.revision,'Tapping the same lap again requests recentering');
assert.match(text(tree),/155/,'Selected lap retains its recorded nested-summary HR');

button(tree,'Table of all laps').props.onClick();tree=profileHost.render(Profile,props);
let tableElement=nodes(tree).find(node=>node.type===Laps);
assert.ok(tableElement,'A partial match retains the full recorded-lap table');
assert.equal(tableElement.props.detail.laps.length,4);
const tableHost=host();let table=tableHost.render(Laps,tableElement.props);
assert.equal(nodes(table).filter(node=>node.type==='tr'&&node.props.onClick).length,3);
const lastRow=nodes(table).filter(node=>node.type==='tr').at(-1);
assert.match(text(lastRow),/4No route/);assert.match(text(lastRow),/135/);assert.equal(lastRow.props.onClick,undefined);
assert.equal(nodes(lastRow).some(node=>node.type==='button'),false,'Unavailable laps are readable without an inert map control');
button(table,'Select Lap 3').props.onClick({stopPropagation(){}});tree=profileHost.render(Profile,props);
assert.equal(emitted.at(-1).label,'Lap 3','The recorded-lap table selects the same chart/map state as a card');
assert.equal(card(tree,3).props['aria-pressed'],true);
button(table,'More stats').props.onClick();table=tableHost.render(Laps,tableElement.props);
assert.match(text(nodes(table).filter(node=>node.type==='tr').at(-1)),/1:50/,'Unmatched lap duration remains available');
button(tree,'Whole activity').props.onClick();tree=profileHost.render(Profile,props);assert.equal(emitted.at(-1),null,'Clearing a lap clears the shared chart/map selection');

const complete={...detail,laps:detail.laps.slice(0,3)},completeHost=host(),completeProps={...props,detail:complete};
completeHost.render(Profile,completeProps);let completeTree=completeHost.render(Profile,completeProps);
button(completeTree,'Table of all laps').props.onClick();completeTree=completeHost.render(Profile,completeProps);
assert.equal(nodes(completeTree).some(node=>node.type===Laps),false,'Complete recordings keep the full section-comparison table');
button(completeTree,'Select Lap 1').props.onClick({stopPropagation(){}});completeTree=completeHost.render(Profile,completeProps);assert.equal(card(completeTree,1).props['aria-pressed'],true);

// The dedicated Laps view keeps every recorded lap and uses the same bounds.
const mosaicData=lapMosaic(detail);assert.equal(mosaicData.laps.length,4);assert.equal(mosaicData.laps[3].start,null);assert.equal(mosaicData.laps[3].duration,110);
const mosaicHost=host(),mosaicSelections=[],mosaicProps={detail,storageScope:'',onSelection:selection=>mosaicSelections.push(selection)};
mosaicHost.render(Mosaic,mosaicProps);let mosaic=mosaicHost.render(Mosaic,mosaicProps);
const mosaicLap=(view,number)=>nodes(view).find(node=>node.type==='button'&&node.props['aria-label']?.startsWith(`Lap ${number},`));
mosaicLap(mosaic,1).props.onClick();mosaic=mosaicHost.render(Mosaic,mosaicProps);const first=mosaicSelections.at(-1);
assert.equal(first.start,mapped.laps[0].start);assert.equal(first.end,mapped.laps[0].end);assert.equal(first.kind,'lap');
mosaicLap(mosaic,1).props.onClick();mosaic=mosaicHost.render(Mosaic,mosaicProps);assert.ok(mosaicSelections.at(-1).revision>first.revision);
const select=nodes(mosaic).find(node=>node.props['aria-label']==='Select a lap');select.props.onChange({target:{value:'2'}});mosaic=mosaicHost.render(Mosaic,mosaicProps);assert.equal(mosaicSelections.at(-1).label,'Lap 3');
mosaicLap(mosaic,4).props.onClick();mosaic=mosaicHost.render(Mosaic,mosaicProps);assert.equal(mosaicSelections.at(-1),null);assert.match(text(mosaic),/lap timing cannot be placed reliably on the route/);
assert.equal(JSON.stringify(detail),snapshot,'Interactions preserve all original recording data');
console.log('Lap interactions: cards, chart shading, map bounds/framing, repeat selection, recorded table, missing-route stats, clear selection and mosaic dropdown passed.');

// Compact climb settings stay reachable even when the current cutoff finds no
// climbs. Changing bounds recomputes actual sections and clears stale selection.
const cyclingDistance=Array.from({length:57},(_,i)=>i*25);
const ride={id:'synthetic-climb-controls',sportType:'cycling',summary:{duration:285,durationTotal:285},seriesSampled:{sampleSize:5,data:{distance:cyclingDistance,altitude:cyclingDistance.map(d=>100+Math.min(400,Math.max(0,d-100))*.05+Math.min(400,Math.max(0,d-600))*.05),speed:cyclingDistance.map(()=>5),power:cyclingDistance.map(()=>180)}}};
const cyclingHost=host(),cyclingSelections=[],cyclingProps={detail:ride,compact:true,modeRequest:{mode:'climbs',nonce:1},onSelection:value=>cyclingSelections.push(value)};
cyclingHost.render(Profile,cyclingProps);let cyclingTree=cyclingHost.render(Profile,cyclingProps);
const climbCards=view=>nodes(nodes(view).find(node=>node.props['aria-label']==='Select climbs')).filter(node=>node.type==='button');
const menu=(view,label)=>{const node=nodes(view).find(node=>node.type==='select'&&node.props['aria-label']===label);assert.ok(node,`Control exists: ${label}`);return node};
assert.equal(climbCards(cyclingTree).length,2,'Steep mode separates ramps with a brief easing');
assert.equal(menu(cyclingTree,'Cycling climb bounds').props.value,'steep');
assert.equal(menu(cyclingTree,'Minimum cycling climb gradient').props.value,3);
climbCards(cyclingTree)[0].props.onClick();cyclingTree=cyclingHost.render(Profile,cyclingProps);assert.equal(cyclingSelections.at(-1).kind,'climb');
menu(cyclingTree,'Cycling climb bounds').props.onChange({target:{value:'whole'}});cyclingTree=cyclingHost.render(Profile,cyclingProps);
assert.equal(climbCards(cyclingTree).length,1,'Whole climb mode groups ramps on the same hill');
assert.equal(cyclingSelections.at(-1),null,'Changing bounds clears chart/map selection from the old detector');
assert.equal(nodes(cyclingTree).some(node=>node.props['aria-label']==='Minimum cycling climb gradient'),false);
menu(cyclingTree,'Cycling climb bounds').props.onChange({target:{value:'steep'}});cyclingTree=cyclingHost.render(Profile,cyclingProps);
menu(cyclingTree,'Minimum cycling climb gradient').props.onChange({target:{value:'6'}});cyclingTree=cyclingHost.render(Profile,cyclingProps);
assert.equal(climbCards(cyclingTree).length,0);assert.ok(button(cyclingTree,'Climbs 0'));
assert.equal(menu(cyclingTree,'Minimum cycling climb gradient').props.value,6,'Cutoff remains editable when no climbs qualify');
assert.equal(nodes(cyclingTree).some(node=>node.type==='button'&&text(node)==='Table of all climbs'),false,'Empty climb comparisons stay hidden');
menu(cyclingTree,'Minimum cycling climb gradient').props.onChange({target:{value:'3'}});cyclingTree=cyclingHost.render(Profile,cyclingProps);assert.equal(climbCards(cyclingTree).length,2);
const flatRide={...ride,seriesSampled:{...ride.seriesSampled,data:{...ride.seriesSampled.data,altitude:cyclingDistance.map(()=>100)}}},flatHost=host(),flatProps={detail:flatRide,compact:true};
let flatTree=flatHost.render(Profile,flatProps);button(flatTree,'Climbs 0').props.onClick();flatTree=flatHost.render(Profile,flatProps);assert.ok(menu(flatTree,'Cycling climb bounds'),'A ride with no detected climbs still exposes bounds');
const hiddenSelectors=[...readFileSync('app/workout-sheet.css','utf8').matchAll(/:where\(([^)]+)\)\{display:none!important\}/g)].flatMap(match=>match[1].split(',').map(selector=>selector.trim()));
assert.ok(!hiddenSelectors.includes('.effort-analysis-toolbar'),'Compact CSS must not hide the detection controls');

const unalignedHost=host(),unalignedProps={...props,detail:{...detail,laps:[{duration:100,distance:100,heartrate:135}]}};
unalignedHost.render(Profile,unalignedProps);let unalignedTree=unalignedHost.render(Profile,unalignedProps);
button(unalignedTree,'Table of all laps').props.onClick();unalignedTree=unalignedHost.render(Profile,unalignedProps);
assert.ok(nodes(unalignedTree).some(node=>node.type===Laps),'Recorded laps remain accessible when none can be aligned');
console.log('Compact profile controls: steep/whole regrouping, cutoff edits at zero climbs, stale selection clearing, visible toolbar and unaligned lap statistics passed.');
