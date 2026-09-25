import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const src=ts.transpileModule(readFileSync(new URL('../app/calendar-preview.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {calendarRange,lapPreview}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const now=new Date(2026,0,1,12),days=calendarRange(now,3,0);assert.equal(days.length,3);assert.equal(days[0].getFullYear(),2025);assert.equal(days[0].getDate(),30);assert.equal(days[2].getDate(),1);assert.equal(calendarRange(now,7,0)[0].getDay(),1);assert.equal(calendarRange(now,3,-1)[2].getDate(),29);
const laps=lapPreview([{summary:{distance:1000,duration:300,heartrate:140}},{pace:240},{speed:0}],false);assert.equal(laps[0].pace,300);assert.equal(laps[1].value,1000/240);assert.equal(laps[2].value,null);assert.equal(laps[0].hr,140);
console.log('Passed: three-day range, year boundary, week starts, previous period and lap pace calculations.');
