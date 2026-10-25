import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=ts.transpileModule(readFileSync(new URL('../app/weather-recon-data.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {ridingOutlook,rainSignal,bestRidingWindow,windBearing,parseWeather,weatherAssessment,ridingWindows,weatherDay,weatherTime,defaultWeatherRules:r}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const start=Date.parse('2026-09-19T08:00:00Z')/1000;
const h={time:start,temperature:18,rainChance:10,rain:0,wind:12,direction:270,gust:22,code:1,daylight:1};
assert.equal(weatherAssessment(h).grade,'good');
assert.equal(weatherAssessment({...h,daylight:0}).grade,'mixed');
assert.equal(weatherAssessment({...h,wind:21}).grade,'mixed');
assert.equal(weatherAssessment({...h,rain:0.2}).grade,'mixed');
assert.equal(weatherAssessment({...h,code:61,rain:0}).grade,'mixed');
assert.equal(weatherAssessment({...h,code:95}).grade,'poor');
assert.equal(weatherAssessment({...h,temperature:-1}).grade,'poor');
assert.equal(weatherAssessment({...h,gust:65}).grade,'poor');
assert.equal(weatherAssessment({...h,rainChance:null}).grade,'unknown');
assert.equal(weatherAssessment({...h,rainChance:null,code:95}).grade,'poor');
assert.equal(weatherAssessment({...h,wind:21},{...r,wind:25}).grade,'good');
const hours=Array.from({length:5},(_,i)=>({...h,time:start+i*3600}));
assert.equal(ridingWindows(hours,2,r,start).length,3);
assert.equal(ridingWindows(hours,2,r,start+1).length,2);
assert.equal(ridingWindows(hours,2,r,start)[0].end,start+7200);
assert.equal(ridingWindows(hours.slice(0,2),2,r,start).length,0,'Need end-of-ride rain sample');
assert.equal(ridingWindows([hours[0],hours[2],hours[3]],2,r,start).length,0,'No crossing missing forecast hours');
assert.equal(ridingWindows(hours.map((h,i)=>i===2?{...h,rainChance:null}:h),2,r,start).length,0);
assert.equal(weatherTime(start,'Europe/Paris'),'10:00');
assert.equal(weatherDay(Date.parse('2026-09-19T23:00:00Z')/1000,'Europe/Paris'),'2026-09-20');
const p=parseWeather({timezone:'Europe/Paris',hourly:{time:[start],temperature_2m:[18],wind_speed_10m:[null]}});
assert.equal(p.hours[0].wind,null);assert.equal(weatherAssessment(p.hours[0]).grade,'unknown');
assert.throws(()=>parseWeather({hourly:{time:[]}}));
console.log('Weather: thresholds, missing data, daylight, contiguous windows and local times passed.');

assert.deepEqual(windBearing(0),{from:'N',towards:180});
assert.deepEqual(windBearing(270),{from:'W',towards:90});
assert.deepEqual(windBearing(360),{from:'N',towards:180});
assert.equal(windBearing(null),null);
assert.equal(weatherAssessment({...h,direction:null}).grade,'good','Missing direction must not hide known conditions');
const breezy=hours.map((h,i)=>({...h,wind:i<2?18:8}));
assert.equal(bestRidingWindow(ridingWindows(breezy,2,r,start)).start,start+7200,'Prefer lighter winds over earliest departure');
assert.equal(bestRidingWindow([]),undefined);
assert.equal(bestRidingWindow(ridingWindows(hours,2,r,start)).start,start,'Earlier time breaks equal-condition ties');
const solar=parseWeather({timezone:'Europe/Paris',hourly:{time:[start]},daily:{time:[Date.parse('2026-09-18T22:00:00Z')/1000],sunrise:[start-7200],sunset:[start+36000]}});
assert.equal(solar.sun[0].date,'2026-09-19');assert.equal(solar.sun[0].sunrise,start-7200);
console.log('Weather: wind arrow convention, solar dates and best-window ranking passed.');

assert.equal(rainSignal(h),null);
assert.equal(rainSignal({...h,rainChance:30}),'possible');
assert.equal(rainSignal({...h,rain:0.2}),'forecast');
assert.equal(rainSignal({...h,code:61}),'forecast');
assert.equal(rainSignal({...h,rain:null,rainChance:null,code:null}),null);
console.log('Rain highlighting distinguishes forecast rain, probability and missing data.');

const longDay=Array.from({length:14},(_,i)=>({...h,time:start+i*3600}));
assert.equal(ridingWindows(longDay,6,r,start)[0].end,start+6*3600);
assert.equal(ridingWindows(longDay,12,r,start)[0].end,start+12*3600);
assert.equal(ridingWindows(longDay.slice(0,12),12,r,start).length,0);
console.log('Extended ride durations use the complete selected window.');

// Regression: viewing tomorrow after sunset must not assess tomorrow at midnight.
const midnight=Date.parse('2026-09-19T22:00:00Z')/1000;
const tomorrow=Array.from({length:24},(_,i)=>({...h,time:midnight+i*3600,daylight:i>=8&&i<=19?1:0,temperature:15+i/2,wind:i>=8&&i<=11?6:12}));
const ride=bestRidingWindow(ridingWindows(tomorrow,3,r,midnight-3600));
const outlook=ridingOutlook(tomorrow,ride,r);
assert.equal(weatherTime(ride.start,'Europe/Paris'),'08:00');
assert.equal(outlook.assessment.grade,'good');assert.equal(outlook.scope,'Ride window');
assert.equal(outlook.start,ride.start);assert.equal(outlook.end,ride.end);
assert.equal(outlook.minTemp,19);assert.equal(outlook.hour.temperature,20.5);
assert.equal(outlook.assessment.reasons.includes('After dark'),false);
const wet=tomorrow.map(v=>v.daylight?{...v,rain:3}:v);
const bad=ridingOutlook(wet,bestRidingWindow(ridingWindows(wet,3,r,midnight-3600)),r);
assert.equal(bad.assessment.grade,'poor');assert.equal(bad.scope,'Daylight outlook');assert.equal(bad.rain,'forecast');
assert.equal(ridingOutlook(tomorrow.slice(8,10),undefined,r).assessment.grade,'mixed','Short daylight cannot imply a complete ride window');
assert.equal(ridingOutlook(tomorrow.slice(20),undefined,r).assessment.reasons.includes('After dark'),true);
assert.equal(ridingOutlook([],undefined,r),null);
const missing=tomorrow.map(v=>({...v,rainChance:null}));
assert.equal(ridingOutlook(missing,undefined,r).assessment.grade,'unknown');
assert.equal(ridingOutlook(missing,undefined,r).hour.rainChance,null);
console.log('Selected-day outlook: tomorrow after sunset, full-window peaks, rainy daylight, missing data and insufficient duration passed.');

// Several models: each is read on its own, then blended hour by hour.
const {parseWeatherSources,modelAgreement}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const t0=Date.parse('2026-09-20T10:00:00Z')/1000,times=[t0,t0+3600];
const field=(name,values)=>Object.fromEntries(Object.entries(values).map(([m,v])=>[`${name}_${m}`,v]));
const multi={timezone:'Europe/Paris',hourly:{time:times,
 ...field('temperature_2m',{ecmwf_ifs025:[10,11],icon_seamless:[12,13],gfs_seamless:[14,15],meteofrance_seamless:[null,null]}),
 ...field('precipitation_probability',{ecmwf_ifs025:[10,80],icon_seamless:[20,70],gfs_seamless:[30,null]}),
 ...field('precipitation',{ecmwf_ifs025:[0,1.2],icon_seamless:[0,0.4],gfs_seamless:[0,0]}),
 ...field('wind_speed_10m',{ecmwf_ifs025:[10,10],icon_seamless:[20,20],gfs_seamless:[30,30]}),
 ...field('wind_direction_10m',{ecmwf_ifs025:[350,350],icon_seamless:[10,10],gfs_seamless:[0,0]}),
 ...field('weather_code',{ecmwf_ifs025:[2,61],icon_seamless:[3,61],gfs_seamless:[3,3]}),
 ...field('is_day',{ecmwf_ifs025:[1,1],icon_seamless:[1,1],gfs_seamless:[1,1]})},
 daily:{time:[t0-36000],...field('sunrise',{ecmwf_ifs025:[t0-10000]}),...field('sunset',{ecmwf_ifs025:[t0+30000]})}};
const blended=parseWeatherSources(multi);
assert.deepEqual(Object.keys(blended.sources).sort(),['ecmwf_ifs025','gfs_seamless','icon_seamless'],'A model with no readings is left out');
assert.equal(blended.hours[0].temperature,12,'Temperature is the median across models');
assert.equal(blended.hours[0].wind,20);
assert.equal(blended.hours[1].rainChance,75,'Rain chance averages the models that report one');
assert.ok(Math.abs(((blended.hours[0].direction+180)%360)-180)<1e-6,'350°, 10° and 0° average to north, not south');
assert.equal(blended.hours[0].code,3,'The most common weather code wins');
assert.deepEqual(blended.hours[1].models,{rainy:2,total:3},'Two of three models expect rain in the second hour');
assert.equal(blended.sun[0].sunrise,t0-10000);
assert.equal(modelAgreement([blended.hours[0]]).kind,'dry');
assert.deepEqual(modelAgreement(blended.hours),{kind:'split',total:3,rainy:2,start:t0+3600,end:t0+7200});
assert.equal(modelAgreement(parseWeather({hourly:{time:[t0],temperature_2m:[10]}}).hours),null,'A single model has nothing to agree with');
assert.throws(()=>parseWeatherSources({hourly:{time:times}}),'No model readings fails clearly');
console.log('Weather sources: per-model split, median/mean blend, circular wind direction, rain agreement passed.');

const noRainFields={hourly:{time:times,...field('temperature_2m',{ecmwf_ifs025:[10,11],icon_seamless:[12,13],gfs_seamless:[14,15]})}};
assert.equal(modelAgreement(parseWeatherSources(noRainFields).hours),null,'Missing rain readings are not agreement on dry weather');
const partialRain=structuredClone(multi);
delete partialRain.hourly.precipitation_gfs_seamless;
delete partialRain.hourly.precipitation_probability_gfs_seamless;
assert.deepEqual(parseWeatherSources(partialRain).hours[1].models,{rainy:2,total:2},'Rain agreement counts only models reporting rain data');
assert.equal(modelAgreement([{...blended.hours[0]},{...blended.hours[1],models:undefined}]),null,'An uncovered hour prevents a claim about the full riding window');
assert.equal(modelAgreement([{...blended.hours[0]},{...blended.hours[1],models:{rainy:1,total:2}}]),null,'Changing model coverage cannot mix a numerator with another hour’s denominator');
console.log('Weather agreement: missing rain and changing model coverage stay unknown.');
// Wind map: projection, grid and per-point wind.
const mapSource=ts.transpileModule(readFileSync(new URL('../app/weather-map-data.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const map=await import('data:text/javascript;base64,'+Buffer.from(mapSource).toString('base64'));
const back=map.unproject(...Object.values(map.project(48.8566,2.3522)));
assert.ok(Math.abs(back.latitude-48.8566)<1e-9&&Math.abs(back.longitude-2.3522)<1e-9,'Projection round-trips');
const frame=map.mapFrame(48.8566,2.3522);
assert.ok(frame.south<48.8566&&48.8566<frame.north&&frame.west<2.3522&&2.3522<frame.east,'The town sits inside the frame');
const pts=map.gridPoints(frame,5,4);assert.equal(pts.length,20);
assert.ok(pts.every(p=>p.latitude>=frame.south-1e-3&&p.latitude<=frame.north+1e-3),'Grid points stay on the map');
assert.throws(()=>map.parseGrid([{hourly:{time:[1]}}],2),'A short multi-location answer is rejected');
const grid=map.parseGrid([{hourly:{time:[100],wind_speed_10m:[10],wind_direction_10m:[270],precipitation_probability:[null]}},{hourly:{time:[100],wind_speed_10m:[30],wind_direction_10m:[270]}}],2);
assert.deepEqual(grid.map(hours=>[hours[0].wind,hours[0].direction]),[[10,270],[30,270]],'One forecast per grid point, in order');
console.log('Wind map: projection, grid and per-point wind passed.');

// Next two hours: 15-minute slots summed up in one sentence.
const {parseNowcast,nowcastSummary}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(new URL('../app/weather-recon-data.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const q0=Date.parse('2026-10-25T12:00:00Z')/1000,slots=(rain,chance=rain.map(()=>0))=>parseNowcast({minutely_15:{time:rain.map((_,i)=>q0+i*900),precipitation:rain,precipitation_probability:chance}});
assert.equal(nowcastSummary(slots([0,0,0,0,0,0,0,0]),'Europe/Paris').text,'Dry for the next 2 hours');
assert.equal(nowcastSummary(slots([0,0,0.4,0.6,0,0,0,0]),'Europe/Paris').text,'Dry until 13:30, then rain for about 30 min');
assert.equal(nowcastSummary(slots([0.5,0.3,0,0,0,0,0,0]),'Europe/Paris').text,'Raining now · drying from 13:30');
assert.equal(nowcastSummary(slots([0,0,0,0,0,0,0.2,0.3]),'Europe/Paris').text,'Dry until 14:30, then rain for the rest of the 2 hours');
assert.equal(nowcastSummary(slots([0,0,0,0,0,0,0,0],[0,0,60,60,0,0,0,0]),'Europe/Paris').kind,'later','A likely shower counts even before any millimetres');
assert.equal(nowcastSummary(parseNowcast({}),'UTC'),null,'No 15-minute data, no strip');
assert.equal(nowcastSummary(slots([0]),'UTC'),null,'One dry interval cannot describe the next two hours');
assert.equal(nowcastSummary(slots([null,0.4,0,0,0,0,0,0],[null,60,0,0,0,0,0,0]),'UTC'),null,'A missing current interval cannot become raining now');
const missingInterval=slots([0,0,0,0,0,0,0,0]);missingInterval[4].time+=900;
assert.equal(nowcastSummary(missingInterval,'UTC'),null,'The complete two-hour forecast needs consecutive intervals');
console.log('Nowcast: dry, shower later, raining now, rain to the end, likely showers and no data passed.');
