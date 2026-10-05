import {readFileSync} from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
function url(name){let s=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;s=s.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,d)=>`from "${url(d)}"`);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64')}
const {sensorEvidence}=await import(url('tredict-opportunities-data'));
const d={summary:{durationTotal:300},seriesSampled:{sampleSize:5,data:{power:Array(60).fill(210),leftRightBalance:Array(60).fill(48),airPower:Array(60).fill(15),temperature:Array(60).fill(0)}}};
const sensors=sensorEvidence(d);assert.equal(sensors.sensors.temperature.value,0);assert.equal(sensors.powerBands['200'].leftRightBalance.value,48);assert.equal(sensors.sensors.airPower.coverage,1);
const bad=structuredClone(d);bad.seriesSampled.data.leftRightBalance.fill(null);assert.equal(sensorEvidence(bad).sensors.leftRightBalance,undefined);bad.seriesSampled.data.leftRightBalance.fill(150);assert.equal(sensorEvidence(bad).sensors.leftRightBalance,undefined);
const partial=structuredClone(d);partial.seriesSampled.data.airPower=Array(12).fill(20);assert.equal(sensorEvidence(partial).sensors.airPower.coverage,.2);
console.log('Tredict sensor evidence: weighted sensors, missing/zero data, power bands and partial coverage passed.');
