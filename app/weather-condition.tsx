import {Sun,Moon,CloudSun,CloudMoon,Cloud,CloudFog,CloudDrizzle,CloudRain,CloudSnow,CloudLightning,CloudHail,CircleHelp} from 'lucide-react';
const conditions:Record<number,{label:string;Icon:typeof Sun;tone:string}>={
 0:{label:'Clear sky',Icon:Sun,tone:'sun'},1:{label:'Mainly clear',Icon:CloudSun,tone:'sun'},2:{label:'Partly cloudy',Icon:CloudSun,tone:'cloud'},3:{label:'Overcast',Icon:Cloud,tone:'cloud'},
 45:{label:'Fog',Icon:CloudFog,tone:'cloud'},48:{label:'Freezing fog',Icon:CloudFog,tone:'ice'},
 51:{label:'Light drizzle',Icon:CloudDrizzle,tone:'rain'},53:{label:'Drizzle',Icon:CloudDrizzle,tone:'rain'},55:{label:'Dense drizzle',Icon:CloudDrizzle,tone:'rain'},
 56:{label:'Freezing drizzle',Icon:CloudDrizzle,tone:'ice'},57:{label:'Heavy freezing drizzle',Icon:CloudDrizzle,tone:'ice'},
 61:{label:'Light rain',Icon:CloudRain,tone:'rain'},63:{label:'Rain',Icon:CloudRain,tone:'rain'},65:{label:'Heavy rain',Icon:CloudRain,tone:'rain'},
 66:{label:'Freezing rain',Icon:CloudRain,tone:'ice'},67:{label:'Heavy freezing rain',Icon:CloudRain,tone:'ice'},
 71:{label:'Light snow',Icon:CloudSnow,tone:'ice'},73:{label:'Snow',Icon:CloudSnow,tone:'ice'},75:{label:'Heavy snow',Icon:CloudSnow,tone:'ice'},77:{label:'Snow grains',Icon:CloudSnow,tone:'ice'},
 80:{label:'Light rain showers',Icon:CloudRain,tone:'rain'},81:{label:'Rain showers',Icon:CloudRain,tone:'rain'},82:{label:'Heavy rain showers',Icon:CloudRain,tone:'rain'},
 85:{label:'Snow showers',Icon:CloudSnow,tone:'ice'},86:{label:'Heavy snow showers',Icon:CloudSnow,tone:'ice'},
 95:{label:'Thunderstorm',Icon:CloudLightning,tone:'storm'},96:{label:'Thunderstorm with hail',Icon:CloudHail,tone:'storm'},99:{label:'Severe thunderstorm with hail',Icon:CloudHail,tone:'storm'}
};
export default function WeatherCondition({code,daylight}:{code:number|null;daylight:number|null}){
 const condition=code===null?null:conditions[code],night=daylight===0;
 const Icon=!condition?CircleHelp:night&&code===0?Moon:night&&(code===1||code===2)?CloudMoon:condition.Icon;
 const label=condition?`${condition.label}${night?' at night':''}`:'Weather condition unavailable';
 return <span className={`weather-condition weather-condition-${night&&code!==null&&code<=2?'night':condition?.tone??'unknown'}`} title={label}><Icon size={16} strokeWidth={1.8} role="img" aria-label={label}/></span>;
}
