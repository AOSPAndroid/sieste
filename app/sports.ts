export type SportRecord={sportType?:string;subSportType?:string};
const normalized=(s?:string)=>(s??'').trim().replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase().replace(/[ -]+/g,'_');
const strength=new Set(['strength','strength_training','weight_training','weightlifting','weight_lifting','resistance_training']);
export function sportFamily(a:SportRecord){
 const main=normalized(a.sportType),sub=normalized(a.subSportType);
 if(strength.has(sub)||strength.has(main))return 'strength_training';
 if(sub==='walking'||sub==='hiking'||main==='walking'||main==='hiking')return sub==='hiking'||main==='hiking'?'hiking':'walking';
 if(['cycling','biking','bike','ride'].includes(main))return 'cycling';
 if(['running','run'].includes(main))return 'running';
 if(['swimming','swim'].includes(main))return 'swimming';
 return sub&&!['generic','unknown'].includes(sub)?sub:main||'misc';
}
export function sportName(key:string){return ({strength_training:'Strength training',cycling:'Cycling',running:'Running',swimming:'Swimming',misc:'Other',walking:'Walking',hiking:'Hiking'} as Record<string,string>)[key]??key.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
export function sportDescription(a:SportRecord){const family=sportFamily(a),sub=normalized(a.subSportType);if(family==='strength_training')return sportName(family);if(!sub||['generic','unknown',family].includes(sub))return sportName(family);return `${sportName(family)} · ${sub.replaceAll('_',' ')}`}
export function cadenceUnit(family:string){return family==='cycling'?'rpm':family==='running'||family==='walking'||family==='hiking'?'steps/min':family==='swimming'?'strokes/min':'sensor units'}
export function runningPace(seconds:unknown){if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<=0)return '—';const rounded=Math.round(seconds);return `${Math.floor(rounded/60)}:${String(rounded%60).padStart(2,'0')} /km`}
export function workoutSpeed(a:{summary?:Record<string,any>}){const s=a.summary??{};if(typeof s.speed==='number'&&Number.isFinite(s.speed)&&s.speed>=0)return s.speed*3.6;if(s.distance>=0&&s.duration>0)return s.distance/s.duration*3.6;return null}
