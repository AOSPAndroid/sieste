import ts from 'typescript';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const options={compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}};
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const load=(file,replace={})=>{let code=ts.transpileModule(readFileSync(file,'utf8'),options).outputText;for(const [from,to] of Object.entries(replace))code=code.replaceAll(`'${from}'`,`'${to}'`);return url(code)};
const core=load('app/heat-matrix-data.ts'),weatherData=load('app/weather-recon-data.ts');
const {heatMatrix}=await import(core);
const {sleepMatrix,bedtimeLabel}=await import(load('app/sleep-matrix-data.ts',{'./heat-matrix-data':core}));
const {trainingRhythm}=await import(load('app/training-rhythm-data.ts',{'./heat-matrix-data':core}));
const {recoveryMatrix}=await import(load('app/recovery-matrix-data.ts',{'./heat-matrix-data':core}));
const {weatherMatrix}=await import(load('app/weather-matrix-data.ts',{'./heat-matrix-data':core,'./weather-recon-data':weatherData}));
const at=(m,row,column)=>m.cells.find(c=>c.row===row&&c.column===column);

// Core: averages, totals and counts; thin cells stay blank; either end of the scale can be the strong one.
const axis=n=>[...Array(n)].map((_,i)=>({label:String(i)}));
const base=[{row:1,column:0,value:10},{row:1,column:0,value:20},{row:2,column:1,value:40},{row:9,column:0,value:1},{row:1,column:0,value:NaN}];
const mean=heatMatrix(base,axis(4),axis(2));
assert.equal(at(mean,1,0).value,15);assert.equal(at(mean,1,0).count,2);assert.equal(at(mean,2,1).level,1);assert.equal(at(mean,1,0).level,0);assert.equal(mean.count,3,'Out-of-range and non-numeric points are ignored');
assert.equal(at(mean,0,0).value,null);assert.equal(mean.best,at(mean,2,1));
assert.equal(at(heatMatrix(base,axis(4),axis(2),{aggregate:'sum'}),1,0).value,30);assert.equal(at(heatMatrix(base,axis(4),axis(2),{aggregate:'count'}),1,0).value,2);
const strict=heatMatrix(base,axis(4),axis(2),{minimum:2,strong:'low',trimRows:true});
assert.deepEqual(strict.rows.map(r=>r.label),['1'],'Rows trim to the filled range');assert.equal(at(strict,0,0).level,.5,'A single filled cell sits mid-scale');
assert.equal(at(heatMatrix(base,axis(4),axis(2),{strong:'low'}),1,0).level,1);
assert.equal(heatMatrix([],axis(3),axis(2),{trimRows:true}).rows.length,0);

// Sleep: bedtime rows across midnight against hours asleep.
assert.equal(bedtimeLabel(4*60),'10pm');assert.equal(bedtimeLabel(4*60+30),'10:30');assert.equal(bedtimeLabel(6*60),'12am');
const night=(i,bed,hours,rhr)=>({date:`2026-01-${String(i+1).padStart(2,'0')}`,bed,hours,rhr,hrv:null,score:null});
const nights=[...Array(4)].map((_,i)=>night(i,22*60,7.5,50)).concat([...Array(4)].map((_,i)=>night(i+4,60,7.4,54)));
const m=sleepMatrix(nights,'rhr');
assert.equal(m.rowMinutes,60);assert.equal(m.minimum,2);assert.deepEqual(m.rows.map(r=>r.label),['10pm','11pm','12am','1am']);
assert.deepEqual(m.columns.map(c=>c.label),['<6h','6–7','7–8','8–9','≥9h']);
assert.equal(at(m,0,2).value,50);assert.equal(at(m,0,2).level,1,'The lowest resting heart rate is the strong cell');assert.equal(at(m,3,2).level,0);assert.equal(at(m,1,2).value,null);
assert.equal(m.best,at(m,0,2));assert.equal(m.first,'2026-01-01');assert.equal(m.last,'2026-01-08');
assert.equal(sleepMatrix([...nights.slice(0,4),night(9,60,7.4,60)],'rhr').rows.length,1,'One night is not a pattern');
assert.equal(sleepMatrix(nights.map(n=>({...n,hrv:n.bed===60?60:72})),'hrv').cells.find(c=>c.value===72).level,1,'Higher HRV is the strong cell');
assert.equal(sleepMatrix([...nights,night(10,null,8,50),night(11,22*60,null,50),night(12,22*60,7.5,0),night(14,13*60,7.5,40)],'rhr').count,8,'Missing, zero and daytime readings are left out');
const fine=sleepMatrix([...Array(260)].map((_,i)=>night(i%28,22*60+(i%4)*30,6.2+(i%6)*.5,50+(i%4))),'rhr');
assert.equal(fine.rowMinutes,30);assert.deepEqual(fine.rows.map(r=>r.label),['10pm','10:30','11pm','11:30']);assert.equal(fine.columns.length,8);

// Training rhythm: weekday against two-hour start bands, in local time.
const session=(y,mo,d,h,duration,distance)=>({date:new Date(y,mo,d,h,15).toISOString(),summary:{duration,distance}});
const sessions=[session(2026,8,14,7,3600,10000),session(2026,8,14,7,1800,5000),session(2026,8,19,18,5400,40000),{date:'nonsense',summary:{duration:60}},session(2026,8,16,12,0,0)];
const count=trainingRhythm(sessions,'sessions');
assert.deepEqual(count.columns.map(c=>c.label),['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);assert.deepEqual(count.rows.map(r=>r.label),['06–08','08–10','10–12','12–14','14–16','16–18','18–20']);
assert.equal(at(count,0,0).value,2,'Monday 07:15 twice');assert.equal(at(count,6,5).value,1,'Saturday evening');assert.equal(count.count,4,'An unreadable date is skipped');
assert.equal(at(trainingRhythm(sessions,'hours'),0,0).value,1.5);assert.equal(at(trainingRhythm(sessions,'distance'),6,5).value,40);
assert.equal(trainingRhythm(sessions,'hours').count,3,'A session with no duration adds no time');

// Recovery: yesterday's load band against last night's sleep.
const days=[];for(let i=0;i<60;i++){const effort=[0,30,60,90][i%4];days.push({iso:'d'+i,effort,sleep:i%2?7.5:8.5,hrv:null,rhr:null})}
for(let i=1;i<60;i++)days[i].hrv=80-days[i-1].effort/5;
const recovery=recoveryMatrix(days,'hrv');
assert.deepEqual(recovery.rows.map(r=>r.label),['Rest','Light','Moderate','Hard']);assert.deepEqual(recovery.bounds,[60,90]);
assert.equal(recovery.cells.filter(c=>c.row===0&&c.value!==null)[0].value,80,'A rest day before gives the highest HRV here');
assert.equal(recovery.cells.filter(c=>c.row===3&&c.value!==null)[0].value,62);assert.equal(recovery.best.row,0);
assert.equal(recoveryMatrix(days.slice(0,6),'hrv').bounds,null,'Too few training days make no bands');
assert.equal(recoveryMatrix(days.map(d=>({...d,sleep:null})),'hrv').count,0,'No sleep, no cell');

// Weather: hours of the day against forecast days in the forecast's timezone.
const t0=Date.UTC(2026,10,27,4)/1000,hours=[...Array(48)].map((_,i)=>({time:t0+i*3600,temperature:i,rainChance:i%2?80:null,rain:0,wind:10,direction:0,gust:20,code:1,daylight:1}));
const weather=weatherMatrix(hours,'Europe/Paris','temperature');
assert.deepEqual(weather.dates,['2026-11-27','2026-11-28','2026-11-29']);assert.equal(weather.rows.length,16);assert.equal(weather.rows[0].label,'06:00');
assert.deepEqual(weather.columns.slice(0,2),[{label:'Fr',sub:'27'},{label:'Sa',sub:'28'}]);
assert.equal(at(weather,0,0).value,1,'05:00 UTC is 06:00 in Paris');assert.equal(at(weather,0,1).value,25);assert.equal(at(weather,15,0).value,16);
assert.equal(weatherMatrix(hours,'Europe/Paris','rainChance').cells.filter(c=>c.value!==null).every(c=>c.value===80),true,'Missing readings leave blanks');
console.log('Heat matrices: shared core, sleep timing, training rhythm, recovery and forecast tables passed.');
