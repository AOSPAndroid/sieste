import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

const source=ts.transpileModule(readFileSync('app/use-scroll-chrome.ts','utf8'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');

function mount({userAgent='Windows',platform='Win32',maxTouchPoints=0,standalone=false,displayStandalone=false}={}){
 let time=2000,nextTimer=0,cleanup;
 const classes=new Set(['sieste-shell']),events=new Map(),docEvents=new Map(),modeEvents=new Map(),timers=new Map();
 const classList={
  add:name=>classes.add(name),
  remove:name=>classes.delete(name),
  toggle(name,force){if(force)classes.add(name);else classes.delete(name);return !!force},
 };
 const win={scrollY:0,addEventListener:(name,handler,options)=>events.set(name,{handler,options}),removeEventListener:name=>events.delete(name)};
 const doc={documentElement:{classList},addEventListener:(name,handler,options)=>docEvents.set(name,{handler,options}),removeEventListener:name=>docEvents.delete(name)};
 const navigator={userAgent,platform,maxTouchPoints,standalone};
 const displayMode={matches:displayStandalone,addEventListener:(name,handler)=>modeEvents.set(name,handler),removeEventListener:name=>modeEvents.delete(name)};
 class Element {constructor(controls=false){this.controls=controls}closest(selector){assert.equal(selector,'.mini-dock,.floating-sync');return this.controls?{}:null}}
 const hook=new Function('useCallback','useEffect','useRef','window','document','performance','setTimeout','clearTimeout','Element','matchMedia','navigator',source+';return useScrollChrome')(
  callback=>callback,effect=>cleanup=effect(),value=>({current:value}),win,doc,{now:()=>time},
  (callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,delay});return id},id=>timers.delete(id),Element,
  query=>{assert.equal(query,'(display-mode: standalone)');return displayMode},navigator,
 );
 const show=hook();
 return {
  classes,events,docEvents,modeEvents,timers,show,
  advance:milliseconds=>time+=milliseconds,
  scroll(y){win.scrollY=y;events.get('scroll').handler()},
  pointer(controls){docEvents.get('pointerdown').handler({target:new Element(controls)})},
  pointerNonElement(){docEvents.get('pointerdown').handler({target:{}})},
  focus(){docEvents.get('focusin').handler()},
  idle(){const pending=[...timers.values()];timers.clear();for(const timer of pending)timer.callback()},
  mode(matches){displayMode.matches=matches;modeEvents.get('change')()},
  cleanup(){cleanup()},
 };
}

// Scrolling hides chrome without React state changes, and tap/focus/navigation reveal it.
const page=mount();
assert.equal(page.events.get('scroll').options.passive,true);
assert.equal(page.docEvents.get('pointerdown').options.passive,true);
page.scroll(4);assert.equal(page.classes.has('chrome-is-scrolling'),false);
page.scroll(20);assert.equal(page.classes.has('chrome-is-scrolling'),true);
assert.equal([...page.timers.values()][0].delay,180);
page.idle();assert.equal(page.classes.has('chrome-is-scrolling'),false);
page.scroll(40);page.pointer(false);page.pointerNonElement();
assert.equal(page.classes.has('chrome-is-scrolling'),true,'Content taps must not suspend scroll behaviour');
page.pointer(true);assert.equal(page.classes.has('chrome-is-scrolling'),false);
assert.equal(page.timers.size,0,'Control taps clear the pending scroll timer');
page.advance(1100);page.scroll(60);assert.equal(page.classes.has('chrome-is-scrolling'),false);
page.advance(101);page.scroll(80);assert.equal(page.classes.has('chrome-is-scrolling'),true);
page.show();assert.equal(page.classes.has('chrome-is-scrolling'),false);
page.advance(650);page.scroll(100);assert.equal(page.classes.has('chrome-is-scrolling'),false);
page.advance(51);page.scroll(120);assert.equal(page.classes.has('chrome-is-scrolling'),true);
page.focus();assert.equal(page.classes.has('chrome-is-scrolling'),false,'Keyboard focus restores controls');
page.scroll(140);assert.equal(page.classes.has('chrome-is-scrolling'),true);
page.cleanup();
assert.equal(page.timers.size,0);assert.equal(page.events.size,0);assert.equal(page.docEvents.size,0);assert.equal(page.modeEvents.size,0);
assert.deepEqual([...page.classes],['sieste-shell'],'Unmount removes scroll/app chrome and keeps unrelated shell classes');

// Installed iOS uses its safe-area treatment; an ordinary browser and other platforms do not.
const devices=[
 {name:'iPhone browser',userAgent:'Mozilla/5.0 (iPhone)',platform:'iPhone',expected:false},
 {name:'iPhone Safari standalone flag',userAgent:'Mozilla/5.0 (iPhone)',platform:'iPhone',standalone:true,expected:true},
 {name:'iPhone display mode',userAgent:'Mozilla/5.0 (iPhone)',platform:'iPhone',displayStandalone:true,expected:true},
 {name:'iPad desktop user agent',userAgent:'Mozilla/5.0 (Macintosh)',platform:'MacIntel',maxTouchPoints:5,displayStandalone:true,expected:true},
 {name:'Mac without touch',userAgent:'Mozilla/5.0 (Macintosh)',platform:'MacIntel',maxTouchPoints:0,displayStandalone:true,expected:false},
 {name:'Android installed app',userAgent:'Mozilla/5.0 (Android)',platform:'Linux armv8l',maxTouchPoints:5,displayStandalone:true,expected:false},
];
for(const device of devices){
 const app=mount(device);
 assert.equal(app.classes.has('sieste-ios-app'),device.expected,device.name);
 app.cleanup();assert.equal(app.classes.has('sieste-ios-app'),false,device.name+' cleans its app mode');
 assert.equal(app.modeEvents.size,0);
}
const iphone=mount({userAgent:'iPhone',platform:'iPhone'});
iphone.mode(true);assert.equal(iphone.classes.has('sieste-ios-app'),true);
iphone.mode(false);assert.equal(iphone.classes.has('sieste-ios-app'),false,'Returning to browser mode removes the installed-app class');
iphone.cleanup();
const safariApp=mount({userAgent:'iPhone',platform:'iPhone',standalone:true});
safariApp.mode(false);assert.equal(safariApp.classes.has('sieste-ios-app'),true,'Safari standalone remains installed when the media query is false');
safariApp.cleanup();

console.log('Scroll chrome: idle reveal, tap/navigation holds, keyboard focus, cleanup and iOS/browser/standalone modes passed.');
