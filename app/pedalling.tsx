import {useMemo} from 'react';
import {pedalling,balanceWords} from './pedalling-data';

const pct=(v:number|null)=>v===null?'—':`${Math.round(v)}%`;
const minutes=(s:number)=>`${Math.round(s/60)} min`;
// Shown only for rides with a dual-sided power meter (or one recording these metrics).
export default function Pedalling({detail}:{detail:Parameters<typeof pedalling>[0]}){
 const model=useMemo(()=>pedalling(detail),[detail]);
 if(!model)return null;
 const {whole,rows,shift}=model,leg=shift===null||Math.abs(shift)<2?null:shift>0?'left':'right';
 return <section className="pedalling-card" aria-labelledby="pedalling-title">
  <header><h3 id="pedalling-title">Pedalling</h3><small>{whole.balance!==null?balanceWords(whole.balance):'Balance not recorded'}{leg?` · moves ${Math.round(Math.abs(shift!))} points to the ${leg} leg as power rises`:''}</small></header>
  <div className="pedalling-stats">
   <span><b>{whole.balance===null?'—':`${Math.round(whole.balance)}/${100-Math.round(whole.balance)}`}</b><small>Left / right power</small></span>
   <span><b>{pct(whole.torque)}</b><small>Torque effectiveness</small></span>
   <span><b>{pct(whole.smoothness)}</b><small>Pedal smoothness</small></span>
  </div>
  {rows.length>1&&<div className="pedalling-bands" role="table" aria-label="Pedalling by power"><div role="row"><span role="columnheader">Power</span><span role="columnheader">Time</span><span role="columnheader">L / R</span><span role="columnheader">Torque</span><span role="columnheader">Smooth</span></div>
   {rows.map(r=><div role="row" key={r.from}><span role="cell">{r.from}–{r.to} W</span><span role="cell">{minutes(r.seconds)}</span><span role="cell">{r.balance===null?'—':`${Math.round(r.balance)}/${100-Math.round(r.balance)}`}</span><span role="cell">{pct(r.torque)}</span><span role="cell">{pct(r.smoothness)}</span></div>)}
  </div>}
  <p className="pedalling-note">Torque effectiveness is the share of each pedal stroke that pushes the bike forward (most riders sit at 70–90%). Smoothness compares average to peak force through the stroke (typically 15–35%; higher is smoother). Bands split this ride&apos;s own power into thirds.</p>
 </section>;
}
