export function zoneLabel(band:{name?:string;intensity?:number}|null|undefined,index:number,count:number){
 if(typeof band?.name==='string'&&band.name.trim()&&!/^z(?:one)?\s*\d+$/i.test(band.name.trim()))return band.name.trim();
 if(band&&Number.isInteger(band.intensity)&&band.intensity!>=0&&band.intensity!<=2)return ['Low intensity','Moderate intensity','High intensity'][band.intensity!];
 return ({3:['Low','Moderate','High'],5:['Very light','Light','Moderate','Hard','Very hard'],6:['Very light','Light','Moderate','Hard','Very hard','Maximum']} as Record<number,string[]>)[count]?.[index]??`${index===0?'Lowest':index===count-1?'Highest':'Intermediate'} intensity`;
}
