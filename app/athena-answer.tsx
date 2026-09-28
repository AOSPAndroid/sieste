export default function AthenaAnswer({text}:{text:string}){
 const lines=text.split('\n').map(s=>s.trim()).filter(Boolean);
 const structured=lines.some(s=>/^Takeaway:/i.test(s));
 if(!structured)return <div className="athena-prose">{text.split(/\n\s*\n/).filter(Boolean).map((p,i)=><p key={i}>{p}</p>)}</div>;
 return <div className="athena-prose">{lines.map((line,i)=>{
 if(/^Takeaway:/i.test(line))return <p key={i} className="athena-takeaway">{line.replace(/^Takeaway:\s*/i,'')}</p>;
 if(/^Next:/i.test(line))return <div key={i} className="athena-next"><span>Next step</span><p>{line.replace(/^Next:\s*/i,'')}</p></div>;
 if(/^Note:/i.test(line))return <p key={i} className="athena-caveat">{line.replace(/^Note:\s*/i,'')}</p>;
 if(/^Why:?$/i.test(line))return <small key={i} className="athena-evidence-label">What stands out</small>;
 if(/^[-•]\s/.test(line))return <p key={i} className="athena-evidence"><span aria-hidden="true">·</span>{line.replace(/^[-•]\s*/,'')}</p>;
 return <p key={i}>{line}</p>;
 })}</div>;
}
