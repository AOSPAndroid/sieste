"use client";
import {cyclingReference} from './cycling-advanced-data';
import {useEffect,useState} from 'react';
import {ArrowUp,ArrowDown} from 'lucide-react';
import {ExpandButton} from './expansion';
import {sportFamily,runningPace,cadenceUnit} from './sports';
import './activity-laps.css';
export const measured=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function lapValues(lap:Record<string,any>){
 const s={...lap,...lap.summary};
 return {...s,pace:measured(s.pace)&&s.pace>0?s.pace:measured(s.duration)&&measured(s.distance)&&s.distance>0?s.duration/s.distance*1000:null,speed:measured(s.speed)?s.speed:measured(s.distance)&&measured(s.duration)&&s.duration>0?s.distance/s.duration:null,ascent:measured(s.altitude?.ascent)?s.altitude.ascent:null,descent:measured(s.altitude?.descent)?Math.abs(s.altitude.descent):null};
}
const n=(v:unknown,d=0)=>measured(v)?v.toLocaleString('en-GB',{maximumFractionDigits:d}):'—';
const time=(v:unknown)=>measured(v)?`${Math.floor(v/60)}:${String(Math.floor(v%60)).padStart(2,'0')}`:'—';
type Props={detail:Record<string,any>;expanded?:boolean;selectableLaps?:number[];selectedLap?:number|null;onSelectLap?:(lap:number)=>void};
export default function ActivityLaps({detail,expanded=false,selectableLaps=[],selectedLap=null,onSelectLap}:Props){
 const [more,setMore]=useState(expanded),family=sportFamily(detail),ride=family==='cycling',strength=family==='strength_training',laps=(detail.laps??[]).map(lapValues),ftp=ride?cyclingReference(detail).ftp:null,weight=ride?cyclingReference(detail).weight:null;
 const [chosen,setChosen]=useState(selectedLap);
 useEffect(()=>setChosen(selectedLap),[selectedLap]);
 const select=(lap:number)=>{setChosen(lap);onSelectLap?.(lap)};
 return <section className="compact-laps"><header><h3>Recorded laps <span>{laps.length}</span></h3><div><button type="button" aria-pressed={more} onClick={()=>setMore(v=>!v)}>{more?'Fewer columns':'More stats'}</button>{!expanded&&<ExpandButton title="Recorded laps"><ActivityLaps detail={detail} expanded selectableLaps={selectableLaps} selectedLap={chosen} onSelectLap={onSelectLap}/></ExpandButton>}</div></header>{laps.length?<div className="compact-lap-scroll" tabIndex={0} aria-label="Lap statistics, scroll horizontally for more columns"><table><thead><tr><th scope="col">Lap</th>{!strength&&<><th scope="col">km</th><th scope="col">{ride?'km/h':'/km'}</th></>}<th scope="col">HR <small>bpm</small></th>{ride&&<><th scope="col">Power <small>W</small></th><th scope="col">Cadence <small>rpm</small></th></>}{!strength&&<th scope="col">↑ / ↓ <small>m</small></th>}{(more||strength)&&<th scope="col">Time</th>}{more&&<>{!ride&&<th scope="col">Cadence <small>{cadenceUnit(family)}</small></th>}{family==='running'&&<th scope="col">Step <small>cm</small></th>}{!ride&&<th scope="col">Power <small>W</small></th>}</>}</tr></thead><tbody>{laps.map((s:Record<string,any>,i:number)=>{
 const number=i+1,selectable=!!onSelectLap&&selectableLaps.includes(number);
 return <tr key={i} className={`${selectable?'is-selectable':''}${chosen===number?' is-selected':''}`} onClick={selectable?()=>select(number):undefined}><th scope="row">{selectable?<button type="button" className="lap-select" aria-label={`Select Lap ${number}`} aria-pressed={chosen===number} onClick={e=>{e.stopPropagation();select(number)}}><i className="lap-marker"/>{number}</button>:<><i className="lap-marker"/>{number}{onSelectLap&&<small className="lap-unmapped">No route</small>}</>}</th>{!strength&&<><td>{measured(s.distance)?n(s.distance/1000,2):'—'}</td><td className="lap-pace">{ride?(measured(s.speed)?n(s.speed*3.6,1):'—'):runningPace(s.pace)}</td></>}<td><span className="lap-hr-dot" aria-hidden="true"/>{n(s.heartrate)}</td>{ride&&<><td>{n(s.power)}{weight&&measured(s.power)&&<small className="effort-ftp">{n(s.power/weight,2)} W/kg</small>}{ftp&&measured(s.power)&&<small className="effort-ftp">{n(s.power/ftp*100)}%</small>}</td><td>{n(s.cadence)}</td></>}{!strength&&<td><span className="lap-elevation" aria-label={`Elevation gain ${n(s.ascent)} metres, loss ${n(s.descent)} metres`}><span><ArrowUp size={11}/>{n(s.ascent)}</span><b>·</b><span><ArrowDown size={11}/>{n(s.descent)}</span></span></td>}{(more||strength)&&<td>{time(s.duration)}</td>}{more&&<>{!ride&&<td>{n(s.cadence)}</td>}{family==='running'&&<td>{n(s.stepLength)}</td>}{!ride&&<td>{n(s.power)}</td>}</>}</tr>;
 })}</tbody></table></div>:<p className="empty">No lap records supplied for this activity.</p>}</section>;
}
