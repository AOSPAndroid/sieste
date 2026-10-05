import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function moduleUrl(name){let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')}
const {efficiencyInsight}=await import(moduleUrl('training-insights-data'));
const now=new Date('2026-09-18T12:00:00Z'),empty={historyStart:'2026-01-01',historyComplete:true,activities:[],sleep:{},hrv:{},extra:{efforts:{trainingEfforts:{}}}};
const activities=[];for(let i=0;i<3;i++){for(const recent of [true,false])activities.push({id:(recent?'r':'p')+i,date:`2026-${recent?'09':'08'}-${String(10+i).padStart(2,'0')}T10:00:00Z`,sportType:'running',summary:{heartrate:130+i*10,duration:3600,distance:recent?11000:10000,temperature:-5,altitude:{ascent:20}}});}
const data={...empty,activities},r=efficiencyInsight(data,now,'running');assert.equal(r.pairs.length,3);assert.ok(Math.abs(r.change-10)<.001);assert.equal(new Set(r.pairs.map(p=>p.prior.id)).size,3);assert.ok(r.pairs.every(p=>p.temperatureMatched&&p.terrainMatched));assert.equal(efficiencyInsight({...data,activities:activities.slice(0,4)},now,'running').change,null);
const cold=structuredClone(data);cold.activities[0].summary.temperature=10;assert.equal(efficiencyInsight(cold,now,'running').pairs.length,2);
const cycling={...data,activities:activities.map(a=>({...a,sportType:'cycling'}))};assert.equal(efficiencyInsight(cycling,now,'cycling').change,null);cycling.activities.forEach(a=>a.summary.power=a.id.startsWith('r')?220:200);assert.ok(Math.abs(efficiencyInsight(cycling,now,'cycling').change-10)<.001);
const far=structuredClone(data);far.activities[0].summary.heartrate=190;assert.equal(efficiencyInsight(far,now,'running').change,null);
console.log('Training efficiency: unique matched pairs, sample minimum, HR/temperature controls and cycling power requirement passed.');
