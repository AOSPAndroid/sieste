export type ShareLabelMode='icons'|'short'|'full'|'none';

const shortNames:Record<string,string>={
 distance:'Dist',duration:'Time',pace:'Pace',speed:'Speed',power:'Power',hr:'HR',heartrate:'HR',rhr:'RHR',ascent:'Gain',descent:'Loss',calories:'kcal',cadence:'Cad',sessions:'Sessions',sleep:'Sleep',hrv:'HRV',score:'Score',steps:'Steps',running:'Run',cycling:'Ride',strength_training:'Strength',swimming:'Swim',walking:'Walk',hiking:'Hike',misc:'Activity'
};

export function shareMetricLabel(key:string,fullName:string,mode:ShareLabelMode){
 return mode==='none'||mode==='icons'?'':mode==='short'?shortNames[key]??fullName:fullName;
}

export function shareLabelMode(o:{labelMode?:ShareLabelMode;showLabels?:boolean}):ShareLabelMode{
 return o.labelMode??(o.showLabels===false?'icons':'full');
}
