const num=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export const sensorSpecs=[
 ['leftRightBalance','Left power balance','%'],['leftTorqueEffectiveness','Left torque effectiveness','%'],['rightTorqueEffectiveness','Right torque effectiveness','%'],['leftPedalSmoothness','Left pedal smoothness','%'],['rightPedalSmoothness','Right pedal smoothness','%'],['formPower','Form power','W'],['airPower','Air power','W'],['temperature','Temperature','°C']
] as const;
export function sensorEvidence(detail:any){
 const step=detail.seriesSampled?.sampleSize,s=detail.seriesSampled?.data??{},duration=detail.summary?.durationTotal;
 const equipment=Array.isArray(detail.equipment)?detail.equipment.filter((e:any)=>typeof e.id==='string').map((e:any)=>({id:e.id,name:e.name,type:e.type})):[];
 const sensors:Record<string,{value:number;coverage:number;seconds:number}>={},powerBands:Record<string,Record<string,{value:number;seconds:number}>>={};
 if(!num(step)||step<=0||step>30)return {version:1,equipment,sensors,powerBands};
 for(const [key] of sensorSpecs){if(!Array.isArray(s[key]))continue;const values=s[key] as unknown[],cap=num(duration)?Math.max(0,duration):values.length*step;let sum=0,seconds=0;const bands:Record<string,{sum:number;seconds:number}>={};
  values.forEach((v,i)=>{const dt=Math.max(0,Math.min(step,cap-i*step));const percent=/Balance|Effectiveness|Smoothness/.test(key);if(!dt||!num(v)||(key==='temperature'?(v< -60||v>70):(v<0||(percent&&v>100))))return;
   sum+=v*dt;seconds+=dt;const p=s.power?.[i];if(num(p)&&p>=50&&p<1000){const band=String(Math.floor(p/25)*25);bands[band]??={sum:0,seconds:0};bands[band].sum+=v*dt;bands[band].seconds+=dt}
  });if(seconds&&cap>0)sensors[key]={value:sum/seconds,coverage:Math.min(1,seconds/cap),seconds};
  for(const [band,b] of Object.entries(bands))if(b.seconds>=120){powerBands[band]??={};powerBands[band][key]={value:b.sum/b.seconds,seconds:b.seconds}}
 }
 return {version:1,equipment,sensors,powerBands};
}
