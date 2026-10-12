import assert from 'node:assert/strict';
import sharp from 'sharp';
import {loadShareDesignModule,readShareAsset} from './share-design-test-module.mjs';

const faces={wide:'reference-wide',tall:'display-bold',condensed:'display-tall',editorial:'display-serif',slab:'display-slab',hand:'reference-hand'};
const stats=[{key:'distance',label:'Distance',value:'10.01',unit:'km'},{key:'duration',label:'Activity time',value:'51:00',unit:'min:sec'},{key:'pace',label:'Average pace',value:'5:06',unit:'/km'},{key:'hr',label:'Average heart rate',value:'139',unit:'bpm'}];
const history=Array.from({length:7},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,sleep:i===3?null:7+i*.1,score:82+i,hrv:95+i}));
const base={height:1080,transparent:true,ink:'white',accent:'#ffffff',legibility:'none',finish:'solid',title:'Paris Tempo',sport:'Running',sportFamily:'running',date:'7 October 2026',stats,route:null,brand:true,demo:false,labelMode:'short',dayHealth:{sleep:28860,score:85,hrv:104,history},dayCards:[{title:'Recovery',stats:[]},{title:'Paris Tempo',sportFamily:'running',stats:stats.slice(0,3)}]};
const alphaArea=async svg=>{
 const {data,info}=await sharp(Buffer.from(svg)).resize({width:360}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,360);assert.equal(info.channels,4);assert.equal(data[3],0);assert.equal(data.at(-1),0);
 let area=0;for(let i=3;i<data.length;i+=4)if(data[i]>127)area++;
 assert.ok(area>150,'Export contains visible readings on a transparent canvas');return area;
};

for(const [fontFace,asset] of Object.entries(faces)){
 const requests=[];
 const module=await loadShareDesignModule({preload:false,reader:async path=>{requests.push(path);return readShareAsset(path);}});
 const svg=await module.renderShareCardSvg({...base,dayHealth:undefined,dayCards:undefined,template:'refrail',fontFace});
 assert.equal(requests.length,1,fontFace+': selecting a font fetches just one face');
 assert.match(requests[0],new RegExp('/fonts/'+asset+'\\.json\\?v=[\\da-f]+$'));
 assert.ok(svg.includes(`data-reference-face="${fontFace}"`),fontFace+': the selected outlines reach the hero and support readings');
 assert.ok(svg.includes('data-stat-value="10.01"')&&svg.includes('data-stat-value="5:06"'),'Font choice leaves exact source readings unchanged');
 assert.ok(!/<text\b|font-family=|href=|NaN|Infinity|undefined/.test(svg),fontFace+': known labels, titles, dates and numbers are self-contained paths');
 const scales=[...svg.matchAll(/scale\(([\d.]+) (-[\d.]+)\)/g)].map(match=>Number(match[1])/Math.abs(Number(match[2])));
 assert.ok(scales.length>3&&scales.every(ratio=>Math.abs(ratio-(fontFace==='tall'?.72:1))<.002),fontFace+': glyphs keep natural proportions');
 const areas=[];
 for(const textThickness of [-2,0,12]){
  const rendered=await module.renderShareCardSvg({...base,dayHealth:undefined,dayCards:undefined,template:'refrail',fontFace,textThickness});
  areas.push(await alphaArea(rendered));
 }
 assert.ok(areas[0]<areas[1]&&areas[1]<areas[2],fontFace+': actual exported lettering obeys slim/original/bold settings');
 const finished=await module.renderShareCardSvg({...base,dayHealth:undefined,dayCards:undefined,template:'refrail',fontFace,finish:'chrome',textThickness:5,labelMode:'icons'});
 assert.match(finished,/fill="url\(#metal(?:Soft)?\)"/);assert.match(finished,/data-text-thickness="5"/);
 assert.ok(finished.includes('data-sport-icon="running"')&&finished.includes('data-share-cue-key="duration"'),'Typography retains metric and sport cues');
 await alphaArea(finished);
 const daily=await module.renderShareCardSvg({...base,template:'dayline',fontFace,labelMode:'icons',finish:'iridescent'});
 assert.ok(!/<text\b/.test(daily),fontFace+': daily recovery, activity readings and custom sport title use the selected outlines');
 assert.ok(/data-reference-text="(?:01  )?Paris Tempo"/.test(daily)&&daily.includes('data-sport-icon="running"'),'Authored workout title and sport icon both survive');
 assert.ok(daily.includes('data-reference-text="8h 01m"')&&daily.includes('data-reference-text="104 ms"'),'Recovery shares retain selected-day health readings');
 await alphaArea(daily);
 assert.equal(requests.length,1,fontFace+': colours, finishes, weight and daily layouts reuse the same face');
}

const module=await loadShareDesignModule();
for(const template of ['dayline','daycolumns','dayrings','daystack','dayposter'])for(const labelMode of ['none','icons','short','full']){
 const svg=module.shareCardSvg({...base,template,fontFace:'editorial',labelMode});
 assert.ok(!/<text\b/.test(svg),template+'/'+labelMode+': no native label branch escapes selected typography');
 assert.ok(!/NaN|Infinity|undefined/.test(svg));
 if(labelMode==='icons')assert.ok(svg.includes('data-sport-icon="running"'));
}
for(const showLabels of [undefined,true,false]){
 const svg=module.shareCardSvg({...base,template:'dayline',fontFace:'editorial',labelMode:undefined,showLabels});
 assert.ok(!/<text\b/.test(svg),'Legacy label settings also use the selected outlined type');
 assert.ok(svg.includes('data-reference-text="8h 01m"')&&svg.includes('data-reference-text="104 ms"'),'Legacy settings preserve the actual recovery readings');
}
const standard=module.shareCardSvg({...base,template:'refhero',dayCards:undefined});
assert.match(standard,/data-reference-face="wide"/,'No selection keeps original headline type');
assert.ok(/<text\b/.test(standard),'Default metadata keeps its existing native type pairing');
const legacy=module.shareCardSvg({...base,template:'scorecard',fontFace:'editorial',dayCards:undefined});
assert.ok(!legacy.includes('data-reference-face="editorial"'),'Original artwork/cinematic layouts keep their own designed typography');
const missing=module.shareCardSvg({...base,template:'refcard',fontFace:'editorial',title:'東京 <script>'});
assert.ok(missing.includes('&lt;script&gt;')&&!missing.includes('<script>'),'Unsupported scripts remain visible through escaped fallback');
console.log('Share fonts passed: six on-demand faces, self-contained readings/captions, natural proportions, transparent PNG output, all daily label branches and live finish/thickness controls.');
