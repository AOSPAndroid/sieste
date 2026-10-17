import ts from 'typescript';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const code=ts.transpileModule(readFileSync('app/segment-share.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll('export ','');const {segmentShare,readableTime}=new Function(code+';return {segmentShare,readableTime}')();
assert.equal(readableTime(105),'1h 45 min');assert.equal(readableTime(1.8),'1 min 48s');
const base={title:'',sport:'cycling',mode:'climbs',segments:[{label:'Climb 1',start:105,end:110,power:201,hr:169,distance:390,cadence:78,gain:50,grade:4}]};const text=segmentShare(base);assert.ok(text.startsWith('*🚴 Climb notes*\nCycling'));assert.ok(text.includes('*1 · 390 m · 4.0%*'));assert.ok(text.includes('⏱️ 5:00'));assert.ok(text.includes('⚡ 201 W · ❤️ 169 · 🔄 78'));assert.ok(text.includes('❤️ bpm · 🔄 rpm'));assert.ok(text.includes('⛰️ +50 m'));assert.ok(!text.includes('105:00'));assert.ok(segmentShare({...base,timing:true}).includes('Starts 1h 45 min'));
const run=segmentShare({title:'Track run',sport:'running',mode:'efforts',segments:[{label:'Effort 1',start:0,end:1,speed:4,hr:null,gain:null}]});assert.ok(run.includes('4:10 /km pace'));assert.ok(!run.includes('null'));assert.ok(!run.includes('W avg'));
const many=Array.from({length:8},(_,i)=>({label:'Effort '+(i+1),start:i*2,end:i*2+1}));const short=segmentShare({...base,mode:'efforts',segments:many,short:true});assert.ok(short.includes('Highlights · 3 of 8'));assert.equal((short.match(/Effort \d ·/g)||[]).length,3);console.log('Share text: readable units, hours, fallback title, running pace and explicit highlight count passed.');console.log(text);

const fast=segmentShare({title:'Ride',sport:'cycling',mode:'sections',source:'speed',segments:[{label:'Section 1',start:0,end:1,speed:10,badges:['Highest avg']}]});assert.match(fast,/detected fast section/);assert.match(fast,/Fastest average speed/);assert.ok(!fast.includes('Highest average power'));assert.ok(!fast.includes('detected effort'));

const recorded=segmentShare({title:'Watch laps',sport:'running',mode:'laps',segments:[{label:'Lap 1',start:0,end:5,durationSeconds:350}]});assert.match(recorded,/5 min 50s in laps/);assert.match(recorded,/Lap 1 · 5 min 50s/);

const example={title:'Paris Road Cycling',sport:'cycling',date:'10 Oct 2026',mode:'climbs',segments:[
 {label:'Climb 11',start:0,end:1.2,distance:390,gain:17,grade:4.4,power:213,hr:150,cadence:78},
 {label:'Climb 12',start:2,end:2+64/60,distance:326,gain:13,grade:4.1,power:194,hr:158,cadence:76},
 {label:'Climb 13',start:4,end:5.6,distance:487,gain:24,grade:4.9,power:217,hr:154,cadence:63},
]};
assert.equal(segmentShare(example),[
 '*🚴 Climb notes*','Paris Road Cycling · 10 Oct 2026','',
 '*11 · 390 m · 4.4%*','⏱️ 1:12 · ⛰️ +17 m','⚡ 213 W · ❤️ 150 · 🔄 78','',
 '*12 · 326 m · 4.1%*','⏱️ 1:04 · ⛰️ +13 m','⚡ 194 W · ❤️ 158 · 🔄 76','',
 '*13 · 487 m · 4.9%*','⏱️ 1:36 · ⛰️ +24 m','⚡ 217 W · ❤️ 154 · 🔄 63','',
 '❤️ bpm · 🔄 rpm','sieste',
].join('\n'),'Matches the approved compact WhatsApp message with actual units and original climb numbers');
const compact=(segment,extra={})=>segmentShare({...example,...extra,segments:[{label:'Climb 11',start:0,end:1,...segment}]});
const zero=compact({power:0});assert.ok(zero.includes('⚡ 0 W'));assert.ok(!/bpm|rpm|undefined|null/.test(zero));
const unknown=compact({power:NaN,hr:Infinity,cadence:null,distance:null,gain:undefined,grade:NaN});assert.ok(!/NaN|Infinity|undefined|null|bpm|rpm|🔄|⚡/.test(unknown));assert.ok(!unknown.includes(' · \n'));
assert.ok(compact({power:-10,hr:0,cadence:-1}).endsWith('⏱️ 1:00\n\nsieste'));
assert.ok(compact({hr:150}).endsWith('❤️ bpm\nsieste'));assert.ok(!compact({hr:150}).includes('rpm'));
assert.ok(compact({cadence:78}).endsWith('🔄 rpm\nsieste'));assert.ok(!compact({cadence:78}).includes('bpm'));
const footClimb=compact({speed:4,cadence:180,hr:150},{sport:'running'});assert.ok(footClimb.startsWith('*🏃 Climb notes*'));assert.ok(footClimb.includes('🏃 4:10 /km'));assert.ok(footClimb.includes('🔄 steps/min'));assert.ok(!footClimb.includes('🚴'));
assert.ok(compact({distance:1523,end:65}).includes('*11 · 1.52 km*'));assert.ok(compact({end:65}).includes('⏱️ 1:05:00'));assert.ok(compact({end:59.999/60}).includes('⏱️ 1:00'));
const climbs=Array.from({length:5},(_,i)=>({label:`Climb ${11+i}`,start:i*10,end:i*10+i+1,power:200,...(i===0?{hr:150}:{}),...(i===1?{badges:['Highest avg']}:{} )}));
const highlights=segmentShare({...example,segments:climbs,short:true});assert.ok(highlights.includes('Highlights · 3 of 5'));assert.ok(highlights.includes('*12*'));assert.ok(highlights.includes('*14*'));assert.ok(highlights.includes('*15*'));assert.ok(!highlights.includes('*11*'));assert.ok(!highlights.includes('bpm'));assert.ok(highlights.indexOf('*12*')<highlights.indexOf('*14*'));
console.log('Compact climbs: approved WhatsApp text, real distances/cadence, original numbering, zero/missing sensors, conditional legend, clocks, highlights and running units passed.');
