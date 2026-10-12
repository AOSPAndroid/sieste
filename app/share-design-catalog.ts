import type {routeGeometry} from './route-geometry';
import type {ShareLabelMode} from './share-labels';
import type {ShareLegibility} from './share-legibility';
import type {ShareFontFace} from './share-fonts';
export const referenceActivityDesigns=[
 {key:'refrail',name:'Fine line',description:'Sport icon · strong distance · a quiet stat rule'},
 {key:'refduet',name:'Duet',description:'Two generous readings · a single fine divider'},
 {key:'refledger',name:'Stat ledger',description:'Three aligned readings · small metric cues'},
 {key:'refcompactroute',name:'Route & type',description:'Fine route beside a compact reading column'},
 {key:'refsplitline',name:'Split line',description:'Distance · recorded lap bars · two readings'},
 {key:'refcorner',name:'Photo corner',description:'A small sport icon and stats along the lower edge'},
 {key:'refhero',name:'Headline',description:'Bold distance · three small readings'},
 {key:'refstack',name:'Three lines',description:'Distance, pace and exact time'},
 {key:'refweekday',name:'Day headline',description:'Weekday · compact bold distance'},
 {key:'refroute',name:'Route',description:'Just a fine trace of your route'},
 {key:'refdayroute',name:'Day & route',description:'Weekday · red trace · distance'},
 {key:'refroutehero',name:'Route headline',description:'Fine route above a compact stat footer'},
 {key:'reftall',name:'Tall distance',description:'Condensed distance · pace and time'},
 {key:'reftallday',name:'Tall day',description:'Two strong lines · weekday and distance'},
 {key:'refivory',name:'Ivory stack',description:'Six readings in a quiet centred column'},
 {key:'reftoday',name:'Today',description:'A day and a single activity line'},
 {key:'refserif',name:'Serif',description:'Distance in serif type · fine pace'},
 {key:'refschedule',name:'Date & stats',description:'Day and start time beside your readings'},
 {key:'refcard',name:'Activity card',description:'Soft grey card · title and six readings'},
 {key:'refsportcard',name:'Sport card',description:'Sport icon · distance · pace and time'},
 {key:'refcaption',name:'Title & distance',description:'A simple caption with handwritten distance'},
 {key:'refsingle',name:'One reading',description:'A small caption above one stat'},
 {key:'refpair',name:'Two readings',description:'Two aligned readings and quiet captions'},
 {key:'refpairroute',name:'Readings & route',description:'Two quiet readings beside a fine route'},
 {key:'reftriple',name:'Three readings',description:'Distance, pace and time on one line'},
 {key:'refquad',name:'Four readings',description:'A balanced two by two grid'},
 {key:'refsix',name:'Six readings',description:'Three columns · two rows'},
 {key:'reflaps',name:'Splits',description:'Recorded lap paces · simple bars'},
 {key:'refbubble',name:'Message',description:'Blue activity message · recorded start time'},
 {key:'refsummary',name:'Activity sentence',description:'A quiet gold header above your activity'}
] as const;
export const referenceMinimalTemplates=['refrail','refduet','refledger','refcompactroute','refsplitline','refcorner'] as const;
export const referenceMinimalDesigns=referenceActivityDesigns.filter(design=>referenceMinimalTemplates.some(key=>key===design.key));
export const referenceRecoveryDesigns=[
 {key:'refrecoveryline',name:'Recovery line',description:'Three readings · fine seven-night charts'},
 {key:'refrecoverystack',name:'Morning stack',description:'Sleep in focus · HRV and score · quiet charts'}
] as const;
/** Homepage health and full-day shares use the same design collection. */
const homeDescriptions:Record<string,string>={refrail:'Strong sleep reading · two quiet recovery stats',refduet:'Two generous readings · sleep score below',refledger:'Three aligned recovery readings · small metric cues',refcompactroute:'Seven-night charts beside a compact reading column',refsplitline:'Three seven-night bar strips · today’s readings',refcorner:'Recovery readings along the lower edge'};
export const referenceHomeDesigns=[...referenceMinimalDesigns.map(design=>({...design,description:homeDescriptions[design.key]})),...referenceRecoveryDesigns];
export const isHomeShareTemplate=(template:string)=>referenceHomeDesigns.some(design=>design.key===template);
export type ReferenceTemplate=typeof referenceActivityDesigns[number]['key']|typeof referenceRecoveryDesigns[number]['key'];
export const referenceRouteTemplates:ReferenceTemplate[]=['refroute','refdayroute','refroutehero','refpairroute','refcompactroute'];
const statLimits:Record<ReferenceTemplate,number>={refrail:4,refduet:2,refledger:3,refcompactroute:3,refsplitline:3,refcorner:3,refrecoveryline:3,refrecoverystack:3,refsingle:1,refpair:2,reftriple:3,refquad:4,refsix:6,refhero:4,refstack:3,refweekday:1,refroute:0,refdayroute:1,refroutehero:4,reftall:3,reftallday:1,refivory:6,reftoday:1,refserif:2,refschedule:3,refcard:6,refsportcard:3,refcaption:1,reflaps:0,refpairroute:2,refbubble:2,refsummary:2};
export function referenceStatLimit(template:string){return statLimits[template as ReferenceTemplate]??6;}
export const retroActivityDesigns=[
 {key:'retrohero',name:'Golden hour',description:'Café lettering · giant reading · red shadow',color:'#f4d35e'},
 {key:'retroride',name:'Sunday club',description:'Ivory lettering · indigo shadow · sweeping route',color:'#f3e8d0'},
 {key:'retroswoop',name:'Slow curve',description:'Flowing serif numbers · curved underline · real stats',color:'#f4d35e'},
 {key:'retrostack',name:'The stat stack',description:'Six bold readings · tiny icons · hard shadows',color:'#f3e8d0'},
 {key:'retrolaps',name:'Lap café',description:'Big headline · recorded splits · compact readings',color:'#f4d35e'},
 {key:'retroseal',name:'Club stamp',description:'Scalloped seal · chunky serif · your route',color:'#f3e8d0'}
] as const;
export const retroRecoveryDesigns=[
 {key:'retrorecovery',name:'Blue morning',description:'Ice blue sleep · cobalt shadow · recovery history',color:'#b7ddf2'},
 {key:'retrotriptych',name:'Recovery club',description:'Three serif readings · history with gaps · day workouts',color:'#b7ddf2'}
] as const;

export const approvedActivityDesigns=[
 {key:'approvedrun',name:'Café run · original',description:'The original yellow running sticker',color:'#ffdf00'},
 {key:'approvedride',name:'Club ride · original',description:'The original ivory cycling sticker',color:'#fff4d5'}
] as const;
export const approvedRecoveryDesigns=[
 {key:'approvedrecovery',name:'Blue recovery · original',description:'The original glossy blue recovery sticker',color:'#b7ddf2'}
] as const;
export const shareSolidColours=[
 {color:'#ef3340',name:'Route red'}, {color:'#990F16',name:'Blood red'},
 {color:'#0B1F5E',name:'Deep blue'}, {color:'#4169E1',name:'Royal blue'},
 {color:'#064E3B',name:'Dark green'}, {color:'#4f46e5',name:'Indigo'},
 {color:'#60a5fa',name:'Electric blue'}, {color:'#b99aff',name:'Lavender'},
 {color:'#fb923c',name:'Tangerine'}, {color:'#f472b6',name:'Pink'},
 {color:'#4A0612',name:'Oxblood'}, {color:'#B64624',name:'Burnt orange'},
 {color:'#241139',name:'Midnight violet'}, {color:'#123E45',name:'Petrol teal'},
 {color:'#C8A45D',name:'Antique gold'}, {color:'#F3E8D0',name:'Warm ivory'},
 {color:'#F4D35E',name:'Film yellow'}, {color:'#B7DDF2',name:'Ice blue'},
 {color:'#ffdf00',name:'Café yellow'}, {color:'#fff4d5',name:'Club ivory'}
] as const;
export function shareColourContrast(colour:string){
 const rgb=[1,3,5].map(i=>parseInt(colour.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#111111':'#ffffff';
}
export const shareFinishes=[
 {key:'chrome',name:'Silver chrome',colors:['#ffffff','#c8d0dc','#faffff','#9099a8','#252b37','#535e70','#e6edf6','#ffffff','#8993a3']},
 {key:'gold',name:'Champagne gold',colors:['#fff9dd','#d8b96e','#fff5c7','#bd8d36','#644317','#9b712a','#f5d995','#fff5d6','#bf9647']},
 {key:'rose',name:'Rose gold',colors:['#fff3ef','#dbb2ac','#ffe8de','#bb7c7a','#623e48','#a46472','#efc5bd','#fff0e9','#c1888a']},
 {key:'copper',name:'Burnished copper',colors:['#ffeede','#cf926d','#ffdbb8','#b66b44','#592f26','#985033','#e9b08a','#ffe6ca','#b97851']},
 {key:'titanium',name:'Titanium violet',colors:['#f4edff','#aca0cd','#eee4ff','#837898','#353148','#645974','#ccc0e6','#faf1ff','#9282ad']},
 {key:'midnight',name:'Midnight blue',colors:['#e2efff','#7b9fc9','#dceaff','#546f9d','#152842','#35547d','#9ab9e2','#eff6ff','#567ca9']},
 {key:'iridescent',name:'Iridescent pearl',colors:['#fff1ff','#a9e4ec','#f2e7ff','#c29bd9','#555889','#629cb5','#e7c4ef','#fff8dc','#9ed3d5']},
 {key:'rainbow',name:'Rainbow spectrum',colors:['#ff638f','#ffab55','#fff09a','#80e2a5','#268eb5','#5795eb','#a0a5ff','#f3bdff','#d775db']}
] as const;
export type ShareFinish='solid'|typeof shareFinishes[number]['key'];
export const finishSwatch=(colors:readonly string[])=>'linear-gradient(165deg,'+colors.map((c,i)=>c+' '+[0,18,39,48,50,61,76,88,100][i]+'%').join(',')+')';
export const routeStatDesigns=[
 {key:'traceposter',name:'Trace poster',description:'Thick route · bold headline · all your stats'},
 {key:'tracesplit',name:'Trace split',description:'Large route beside a cinematic stat column'},
 {key:'traceheadline',name:'Trace headline',description:'Huge headline · thick route · stat grid'},
 {key:'tracefooter',name:'Trace footer',description:'Route and stats below · room for your photo'},
 {key:'tracescorecard',name:'Trace scorecard',description:'Thick route · six equally bold readings'},
 {key:'tracestamp',name:'Trace stamp',description:'Framed route · slab-serif headline · stats'}
] as const;
export type ShareTemplate=ReferenceTemplate|typeof approvedActivityDesigns[number]['key']|typeof approvedRecoveryDesigns[number]['key']|typeof retroActivityDesigns[number]['key']|typeof retroRecoveryDesigns[number]['key']|typeof routeStatDesigns[number]['key']|'cinemamonolith'|'cinemaepic'|'cinemawide'|'cinemamission'|'cinemalens'|'cinemawave'|'routegiant'|'cinemabig'|'cinemaday'|'cinematitle'|'cinematrace'|'cinemaserif'|'cinemastack'|'editorial'|'route'|'split'|'signature'|'serif'|'laps'|'bib'|'strip'|'outline'|'receipt'|'chrono'|'hollow'|'scorecard'|'margin'|'caption'|'routebadge'|'panorama'|'bubble'|'wide'|'weekday'|'glass'|'weekbold'|'weekchart'|'daystack'|'daytrends'|'daycolumns'|'daybars'|'daypanels'|'dayline'|'daytype'|'daytiles'|'dayledger'|'daybalance'|'daypulse'|'dayrings'|'dayribbon'|'dayposter'|'daymatrix'|'velocity'|'ghost'|'routefile'|'ticket'|'monolith'|'podium'|'halo'|'capsule'|'diamond'|'seal'|'orbit'|'metro'|'metroen'|'sweatreceipt'|'sweatreceipten'|'excuse'|'excuseen'|'croissant'|'chrome'|'chromebadge'|'chromeoutline'|'chromeheadline';
export const routeStatTemplates:ShareTemplate[]=routeStatDesigns.map(design=>design.key);
export const routeTemplates:ShareTemplate[]=[...referenceRouteTemplates,...routeStatTemplates,'routegiant','cinematrace','route','outline','routebadge','panorama','weekday','routefile','halo','capsule','diamond','seal','orbit','chromebadge'];
export type ShareStat={key:string;label:string;value:string;unit:string};
// dayHealth.sleep uses seconds; history.sleep uses hours from dailyShareHistory.
export type ShareDesign={height:number;template:ShareTemplate;transparent:boolean;fontFace?:ShareFontFace;legibility?:ShareLegibility;showLabels?:boolean;labelMode?:ShareLabelMode;textThickness?:number;routeStroke?:number;finish?:ShareFinish;ink:'white'|'black';accent:string;bubbleColor?:string;title:string;sport:string;sportFamily?:string;date:string;stats:ShareStat[];route:ReturnType<typeof routeGeometry>;brand:boolean;demo:boolean;laps?:{index:number;value:number|null;pace:number|null}[];cycling?:boolean;weekday?:string;time?:string;displayDay?:string;recoveryOnly?:boolean;dayCards?:{title:string;sportFamily?:string;stats:ShareStat[]}[];dayHealth?:{sleep?:number;score?:number;hrv?:number;hrvRange?:[number,number];history?:{date:string;sleep:number|null;score:number|null;hrv:number|null}[]};dayMix?:{label:string;seconds:number;color:string}[];dayCoverage?:{covered:number;total:number};weekDays?:{label:string;value:number|null}[]};
