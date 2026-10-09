import assert from 'node:assert/strict';
import sharp from 'sharp';
import {loadShareDesignModule} from './share-design-test-module.mjs';

const {shareCardSvg,referenceActivityDesigns,referenceRouteTemplates,referenceStatLimit}=await loadShareDesignModule();
const points=[{x:0,y:0},{x:.5,y:.2},{x:1,y:.8},{x:1,y:1}];
const stats=[{key:'distance',label:'Distance',value:'15.01',unit:'km'},{key:'pace',label:'Average pace',value:'4:56',unit:'/km'},{key:'duration',label:'Activity time',value:'1:14:13',unit:'h:mm:ss'},{key:'ascent',label:'Elevation gain',value:'92',unit:'m'},{key:'calories',label:'Workout calories',value:'927',unit:'kcal'},{key:'hr',label:'Average heart rate',value:'142',unit:'bpm'}];
const base={height:1080,transparent:true,ink:'white',accent:'#ffffff',legibility:'none',finish:'solid',title:'Paris Run',sport:'Running',sportFamily:'running',date:'',weekday:'Friday',time:'19:33',displayDay:'Friday',stats,route:null,routeStroke:4,brand:false,demo:false,labelMode:'short',laps:[{index:1,value:3,pace:323},{index:2,value:3.1,pace:319},{index:3,value:null,pace:null}]};
const route={points,segments:[points.slice(0,2),points.slice(2)],center:{x:.5,y:.5},zoom:1};
assert.equal(referenceActivityDesigns.length,24);
for(const {key} of referenceActivityDesigns){
 const o={...base,template:key,stats:stats.slice(0,referenceStatLimit(key)),route:referenceRouteTemplates.includes(key)?route:null};
 const svg=shareCardSvg(o);
 assert.ok(svg.includes('data-reference-share="'+key+'"'));
 assert.ok(!/NaN|Infinity|undefined|lengthAdjust|data-share-brand|sharePhotoContrast/.test(svg),key+': clean reference markup');
 if(referenceRouteTemplates.includes(key))assert.equal((svg.match(/stroke-linecap="round" stroke-linejoin="round"/g)??[]).length,2,key+': disconnected GPS segments stay disconnected');
 for(const shown of svg.matchAll(/data-stat-key="([^"]*)" data-stat-value="([^"]*)" data-stat-unit="([^"]*)"/g)){
  const source=o.stats.find(stat=>stat.key===shown[1]);assert.ok(source);assert.equal(shown[2],source.value);assert.equal(shown[3],source.unit);
 }
 assert.ok(!svg.includes('ILLUSTRATIVE DATA'),key+': real activities are not marked as demonstration');
}
const exact=shareCardSvg({...base,template:'refstack',stats:stats.slice(0,3)});
assert.match(exact,/data-reference-text="1:14:13"/,'Three-line card keeps recorded seconds');
assert.match(exact,/data-reference-text="15.01"/);assert.match(exact,/data-share-raised-unit="km"/,'Stack matches raised small unit without rounding the recorded distance');
assert.match(exact,/data-reference-text="4&apos;56&quot;"/,'Pace punctuation retains the outlined reference face');
const paceBlock=exact.match(/<g data-reference-face="wide"[^>]*data-reference-text="4&apos;56&quot;"[^>]*>([\s\S]*?)<\/g>/)?.[1];
assert.ok(paceBlock?.includes('<path')&&!paceBlock.includes('<text'),'Stack pace uses matched outlined typography rather than a native font fallback');
assert.match(shareCardSvg({...base,template:'reftall',stats:stats.slice(0,3)}),/data-reference-text="15.0KM"/,'Tall headline uses the reference one-decimal presentation');
assert.match(shareCardSvg({...base,template:'refhero',stats:stats.slice(0,4)}),/data-reference-text="15.01KM"/,'Compact broad headline retains the precise distance');
const selected=shareCardSvg({...base,template:'refhero',stats:[stats[0],stats[5],{key:'power',label:'Power',value:'234',unit:'W'}]});
assert.match(selected,/data-stat-key="hr" data-stat-value="142"/);assert.match(selected,/data-stat-key="power" data-stat-value="234"/,'Custom support stats are actually rendered');
assert.ok(!selected.includes('data-stat-key="ascent"'),'Unselected elevation is never invented');
const laps=shareCardSvg({...base,template:'reflaps',stats:[]});assert.match(laps,/data-share-lap="1" data-lap-pace="323"/);assert.match(laps,/data-share-lap="3" data-lap-pace="missing"/,'Missing pace retains its recorded lap position');
const rideLaps=shareCardSvg({...base,template:'reflaps',stats:[],cycling:true,laps:[{index:7,value:7.5,pace:null},{index:8,value:null,pace:null}]});assert.match(rideLaps,/data-lap-speed="27"/);assert.ok(rideLaps.includes('27.0'));assert.match(rideLaps,/data-share-lap="8" data-lap-speed="missing"/);
assert.ok(shareCardSvg({...base,template:'reflaps',stats:[],laps:Array.from({length:42},(_,i)=>({index:i+1,value:3,pace:300}))}).includes('FIRST 20 OF 42 RECORDED LAPS'));
const escaped=shareCardSvg({...base,template:'refcard',title:'Paris <script> & "me"'});assert.ok(escaped.includes('&lt;script&gt; &amp; &quot;me&quot;'));assert.ok(!escaped.includes('<script>'));
const historical=shareCardSvg({...base,template:'reftoday'});assert.ok(historical.includes('Friday'));assert.ok(!historical.includes('>today<'),'Historical activity is not labelled today');
const demo=shareCardSvg({...base,template:'refhero',demo:true});assert.ok(demo.includes('ILLUSTRATIVE DATA'));
const bubble=shareCardSvg({...base,template:'refbubble',stats:stats.slice(0,2),time:'7:33 PM'});assert.ok(bubble.includes('15.0 km, 4:56/km'));assert.ok(bubble.includes('Ran 7:33 PM'));assert.ok(!bubble.includes('Share Aura'));
const rideBubble=shareCardSvg({...base,template:'refbubble',sportFamily:'cycling',stats:[stats[0],{key:'speed',label:'Average speed',value:'27.9',unit:'km/h'}],time:'10:31 AM'});assert.ok(rideBubble.includes('15.0 km, 27.9 km/h'));assert.ok(rideBubble.includes('Rode 10:31 AM'));
assert.ok(bubble.includes('fill="#007aff"'),'Uncustomized message keeps the reference blue');
const invalidBubble=shareCardSvg({...base,template:'refbubble',stats:stats.slice(0,2),bubbleColor:'#fff" onload="bad'});assert.ok(invalidBubble.includes('fill="#007aff"'));assert.ok(!invalidBubble.includes('onload='),'Invalid bubble colours fall back safely');
for(const [bubbleColor,bodyColor] of [['#990F16','#ffffff'],['#ffffff','#111111'],['#064E3B','#ffffff']]){
 const svg=shareCardSvg({...base,template:'refbubble',stats:stats.slice(0,2),bubbleColor});
 assert.ok(svg.includes('fill="'+bubbleColor+'"'));
 assert.ok(svg.includes('fill="'+bodyColor+'" font-family='));
 assert.ok(svg.includes('data-stat-value="15.01"')&&svg.includes('data-stat-value="4:56"'),'Pill colour never changes source readings');
 const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const rgb=[1,3,5].map(i=>parseInt(bubbleColor.slice(i,i+2),16)),ink=[1,3,5].map(i=>parseInt(bodyColor.slice(i,i+2),16));let background=0,lettering=0;
 for(let y=430;y<620;y++)for(let x=170;x<930;x++){const p=(y*info.width+x)*4;if(data[p+3]>200){if(rgb.every((v,i)=>data[p+i]===v))background++;if(ink.every((v,i)=>data[p+i]===v))lettering++;}}
 assert.ok(background>50000,'Actual PNG pill uses chosen '+bubbleColor);assert.ok(lettering>1000,'Actual PNG body remains readable on '+bubbleColor);
}
const summary=shareCardSvg({...base,template:'refsummary',stats:stats.slice(0,2)});assert.ok(summary.includes('15.0 kilometre run at'));assert.ok(summary.includes('4:56/km pace'));assert.ok(!summary.includes('Paris')&&!summary.includes('Share Aura'),'Activity sentence never invents location or another app identity');
assert.ok(!shareCardSvg({...base,template:'refsummary',stats:[stats[0],stats[5]]}).includes('4:56'),'Summary only states selected source readings');
for(const height of [1080,1350,1920]){
 const svg=shareCardSvg({...base,template:'refdayroute',stats:[stats[0]],route,height});
 const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,1080);assert.equal(info.height,height);assert.equal(data[3],0);assert.equal(data.at(-1),0);
 let visible=0;for(let i=3;i<data.length;i+=4)if(data[i]>200)visible++;assert.ok(visible>1000);
}
for(const template of ['refbubble','refpairroute','refsummary'])for(const height of [1080,1350,1920]){
 const svg=shareCardSvg({...base,template,stats:stats.slice(0,2),route:template==='refpairroute'?route:null,height});
 const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,1080);assert.equal(info.height,height);assert.equal(data[3],0);assert.equal(data.at(-1),0);
 let visible=0;for(let i=3;i<data.length;i+=4)if(data[i]>200)visible++;assert.ok(visible>1000,template+': meaningful actual overlay');
}
const inkAreas=[];
for(const textThickness of [-2,0,4,12]){
 const svg=shareCardSvg({...base,template:'refhero',stats:stats.slice(0,4),textThickness});
 const {data}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let area=0;for(let i=3;i<data.length;i+=4)if(data[i]>127)area++;
 inkAreas.push(area);
}
assert.ok(inkAreas.every((area,i)=>i===0||area>inkAreas[i-1]),'Actual PNG lettering gets finer and heavier at -2/0/4/12');
const tracePaths=svg=>[...svg.matchAll(/<path d="([^"]*)" fill="none" stroke="[^"]*" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"\/>/g)].map(match=>match[0]);
const lapBars=svg=>[...svg.matchAll(/<rect x="522"[^>]*\/>/g)].map(match=>match[0]);
assert.deepEqual(tracePaths(shareCardSvg({...base,template:'refroutehero',route,textThickness:0})),tracePaths(shareCardSvg({...base,template:'refroutehero',route,textThickness:12})),'Lettering weight never changes real GPS paths');
assert.deepEqual(lapBars(shareCardSvg({...base,template:'reflaps',textThickness:0})),lapBars(shareCardSvg({...base,template:'reflaps',textThickness:12})),'Lettering weight never changes lap data bars');
console.log('Reference collection: 24 styles, exact selected-source readings, real clocks/laps, disconnected GPS, safe captions, historical dates and transparent three-format exports passed.');
