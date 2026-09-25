const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const median=(a:number[])=>{const b=[...a].sort((a,b)=>a-b);return b[Math.floor(b.length/2)]};
// Valley-to-peak detection: aggregate noisy samples, then tolerate small flats/dips.
// Boundaries remain elapsed seconds so the profile and map select the same section.
export function activityClimbs(detail:any,family=detail.sportType){
 const s=detail.seriesSampled?.data??{},step=detail.seriesSampled?.sampleSize;
 if(!finite(step)||step<=0||step>30)return [];
 const running=['running','walking','hiking','trail_running'].includes(family),minGain=running?12:20,minTime=running?45:120,minGrade=running?1:2;
 const n=Math.min(s.altitude?.length??0,s.distance?.length??0),cap=finite(detail.summary?.durationTotal)?detail.summary.durationTotal:Infinity;
 const width=Math.max(1,Math.round(5/step)),nodes:({t:number;a:number;d:number}|null)[]=[];
 for(let i=0;i<n&&i*step<=cap;i+=width){const indices=Array.from({length:Math.min(width,n-i)},(_,k)=>i+k).filter(j=>j*step<=cap),valid=indices.filter(j=>finite(s.altitude[j])&&finite(s.distance[j]));
  nodes.push(valid.length>=Math.ceil(indices.length*.6)&&valid.length?{t:median(valid)*step,a:median(valid.map(j=>s.altitude[j])),d:median(valid.map(j=>s.distance[j]))}:null);
 }
 // Three-bin median rejects isolated barometer/GPS spikes without bridging missing data.
 const smoothed=nodes.map((v,i)=>v&&nodes[i-1]&&nodes[i+1]?{...v,a:median([nodes[i-1]!.a,v.a,nodes[i+1]!.a])}:v);
 const climbs:{start:number;end:number;gain:number;distance:number;grade:number}[]=[];
 type Point=NonNullable<typeof nodes[number]>;
 let valley:Point|null=null,peak:Point|null=null,previous:Point|null=null;
 const finish=()=>{if(valley&&peak){const gain=peak.a-valley.a,distance=peak.d-valley.d,grade=distance>0?100*gain/distance:0;if(peak.t-valley.t>=minTime&&gain>=minGain&&distance>=80&&grade>=minGrade)climbs.push({start:valley.t,end:peak.t,gain,distance,grade})}valley=null;peak=null};
 for(const point of smoothed){if(!point){finish();previous=null;continue}if(previous&&(point.d<previous.d||point.t-previous.t>Math.max(10,step*1.5))){finish()}
  if(!valley){valley=point;peak=point}else if(point.a<valley.a){finish();valley=point;peak=point}else if(!peak||point.a>peak.a){peak=point}else if(peak.a-point.a>=3||point.t-peak.t>90){finish();valley=point;peak=point}
  previous=point;
 }finish();return climbs;
}
export function paceFromSpeed(speed:unknown,metres=1000){if(!finite(speed)||speed<=0)return '—';const s=Math.round(metres/speed);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
