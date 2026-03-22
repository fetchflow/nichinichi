import { useState } from "react";

// ─── constants ────────────────────────────────────────────────────────────────

const TM = {
  score:      { dot:"#639922", bg:"#EAF3DE", color:"#27500A" },
  solution:   { dot:"#1D9E75", bg:"#E1F5EE", color:"#085041" },
  decision:   { dot:"#534AB7", bg:"#EEEDFE", color:"#3C3489" },
  ai:         { dot:"#D85A30", bg:"#FAECE7", color:"#712B13" },
  reflection: { dot:"#BA7517", bg:"#FAEEDA", color:"#633806" },
  log:        { dot:"#888780", bg:"#F1EFE8", color:"#444441" },
};
const TO = ["score","solution","decision","ai","reflection","log"];
const tot = e => Object.values(e||{}).reduce((a,b)=>a+b,0);
const SM = {
  strong:       { c:"#1D9E75", bg:"#E1F5EE" },
  steady:       { c:"#185FA5", bg:"#E6F1FB" },
  moderate:     { c:"#BA7517", bg:"#FAEEDA" },
  breakthrough: { c:"#534AB7", bg:"#EEEDFE" },
  struggling:   { c:"#993C1D", bg:"#FAECE7" },
  quiet:        { c:"#888780", bg:"#F1EFE8" },
};

// ─── seed data ────────────────────────────────────────────────────────────────

const ENTRIES_INIT = [
  { id:1, date:"2026-03-17", time:"17:30", body:"slow morning but strong finish — debug days feel bad until they don't", type:"reflection", project:"devlog-platform", detail:null },
  { id:2, date:"2026-03-17", time:"16:48", body:"fixed, merged, Sarah unblocked on graphql", type:"score", project:"devlog-platform", detail:null },
  { id:3, date:"2026-03-17", time:"14:15", body:"claude suggested localStorage for jwt — rejected, xss risk", type:"ai", project:"api-refactor", detail:null },
  { id:4, date:"2026-03-17", time:"11:32", body:"jwt refresh swallowing errors — fixed via explicit error propagation", type:"solution", project:"api-refactor", detail:"Root cause: expiry check after decode, not before\nFix: move expiry check to top of middleware\nTime lost: 2hrs. Check expiry BEFORE decode, always." },
  { id:5, date:"2026-03-17", time:"09:05", body:"picking up the auth refactor from yesterday", type:"log", project:"api-refactor", detail:null },
  { id:6, date:"2026-03-16", time:"17:00", body:"pgvector migration — embeddings inserting correctly", type:"score", project:"devlog-platform", detail:null },
  { id:7, date:"2026-03-16", time:"14:22", body:"unix pipes framing unlocked clean functional pipeline in claude", type:"ai", project:"devlog-platform", detail:"What worked: 'composable transform functions, no classes, think Unix pipes'\nReusable for: parsers, validators, any data transform work." },
  { id:8, date:"2026-03-15", time:"09:45", body:"chose pgvector over pinecone — fewer vendors, built into supabase", type:"decision", project:"devlog-platform", detail:"Rejected: Pinecone (cost + vendor), Weaviate (ops overhead)\nRevisit if: query latency exceeds 200ms at scale." },
];

const GOALS_INIT = [
  { id:1, type:"career", title:"become a staff engineer", why:"want to lead technical direction, not just implement", horizon:"end of 2027", status:"active", entry_count:18,
    steps:[
      { id:101, title:"lead a cross-team technical initiative", status:"in_progress", notes:"devlog platform counts — spans 3 projects", due:null, linked:[{ date:"2026-03-17", time:"11:32", body:"chose pgvector — cross-project decision", type:"decision" }] },
      { id:102, title:"write and publish a technical design doc", status:"not_started", notes:"", due:"2026-06-01", linked:[] },
      { id:103, title:"mentor a junior through a full feature", status:"done", notes:"David's auth PR — Mar 2026", due:null, linked:[{ date:"2026-03-10", time:"17:00", body:"mentored david through first production PR", type:"score" }] },
    ],
    suggestions:[{ id:201, title:"document architecture decisions with explicit reasoning and revisit triggers", reason:"you've logged 14 decisions this quarter — formalising this pattern is staff-level behaviour" }],
    progress:[
      { week:"week of mar 11–17", signal:"strong", note:"Strong impact signal this week. Shipping with measurable outcomes and documented decisions are exactly the staff-level evidence to accumulate." },
      { week:"week of mar 4–10",  signal:"moderate", note:"One mentorship entry. Early signal in the right direction." },
    ],
  },
  { id:2, type:"learning", title:"distributed systems fundamentals", why:"keeps coming up in architecture decisions — want to stop guessing", horizon:"Q3 2026", status:"active", entry_count:11,
    steps:[
      { id:201, title:"read Designing Data-Intensive Applications", status:"in_progress", notes:"ch 1-4 done", due:"2026-04-30", linked:[] },
      { id:202, title:"build a toy distributed key-value store", status:"not_started", notes:"", due:null, linked:[] },
    ],
    suggestions:[{ id:301, title:"write a solution entry explaining CAP theorem in your own words", reason:"your logs mention CAP theorem but no entry consolidates your understanding yet" }],
    progress:[{ week:"week of mar 11–17", signal:"steady", note:"Practical signal building well. Theory still light." }],
  },
  { id:3, type:"learning", title:"rust — production confidence", why:"want to reach for it without hesitation", horizon:"Q2 2026", status:"active", entry_count:9,
    steps:[
      { id:301, title:"understand the async/await mental model deeply", status:"done", notes:"poll() source was the unlock", due:null, linked:[{ date:"2026-03-17", time:"09:30", body:"rust async finally clicked — read poll() source", type:"reflection" }] },
      { id:302, title:"ship one feature in rust to production", status:"not_started", notes:"", due:"2026-05-01", linked:[] },
    ],
    suggestions:[{ id:401, title:"write a playbook for Rust async based on your poll() insight", reason:"your breakthrough entry is detailed enough to become a reusable reference" }],
    progress:[{ week:"week of mar 11–17", signal:"breakthrough", note:"Real breakthrough logged this week. Going to source was the unlock." }],
  },
];

const MY_PB = [
  { id:1, title:"debugging node.js memory leaks", tags:["node","memory"], steps:6, forked_from:"priya" },
  { id:2, title:"new feature checklist", tags:["process","planning"], steps:4, forked_from:null },
];

const WEEK_DATA = [
  { label:"mon", entries:{ log:1, score:1 } },
  { label:"tue", entries:{ solution:2, decision:1, ai:1 } },
  { label:"wed", entries:{ score:3, log:1 } },
  { label:"thu", entries:{ solution:1, decision:2, score:1 } },
  { label:"fri", entries:{ decision:1, reflection:1 } },
  { label:"sat", entries:{ score:1, ai:1 } },
  { label:"sun", entries:{ reflection:1, score:2, ai:1, solution:1 } },
];
const MONTH_DATA = [
  { label:"1",  entries:{ log:1, score:2 } },        { label:"2",  entries:{ solution:1, ai:1 } },
  { label:"3",  entries:{ score:2, decision:1 } },   { label:"4",  entries:{} },
  { label:"5",  entries:{ log:1, reflection:1 } },   { label:"6",  entries:{ solution:2, score:1 } },
  { label:"7",  entries:{ decision:2 } },            { label:"8",  entries:{ score:3, ai:1 } },
  { label:"9",  entries:{ log:1 } },                 { label:"10", entries:{ solution:1, decision:1, score:1 } },
  { label:"11", entries:{ reflection:1, ai:1 } },    { label:"12", entries:{ score:2, solution:1 } },
  { label:"13", entries:{} },                        { label:"14", entries:{ log:1, decision:2 } },
  { label:"15", entries:{ score:2, ai:1 } },         { label:"16", entries:{ solution:2, score:1 } },
  { label:"17", entries:{ reflection:1, score:2, ai:1, solution:1 } }, { label:"18", entries:{ decision:1 } },
  { label:"19", entries:{ log:1, score:1 } },        { label:"20", entries:{ solution:1 } },
  { label:"21", entries:{ score:2, decision:1, ai:1 } }, { label:"22", entries:{} },
  { label:"23", entries:{ log:1, reflection:1 } },   { label:"24", entries:{ solution:1, score:1 } },
  { label:"25", entries:{ decision:1 } },            { label:"26", entries:{ score:1, ai:1 } },
  { label:"27", entries:{ log:1 } },                 { label:"28", entries:{ solution:1, score:1 } },
  { label:"29", entries:{} },                        { label:"30", entries:{ score:1, reflection:1 } },
  { label:"31", entries:{ decision:1, ai:1 } },
];
const YEAR_DATA = [
  { label:"jan", entries:{ log:6, score:10, solution:5, decision:4, ai:3, reflection:4 } },
  { label:"feb", entries:{ log:4, score:8,  solution:6, decision:5, ai:4, reflection:5 } },
  { label:"mar", entries:{ log:8, score:18, solution:7, decision:6, ai:6, reflection:4 } },
  ...["apr","may","jun","jul","aug","sep","oct","nov","dec"].map(l=>({ label:l, entries:{} })),
];
const HMAP = (() => {
  const d={}, counts=[0,0,2,3,1,0,0,1,2,4,3,2,1,0,0,3,2,5,4,3,0,0,1,2,3,2,1,0,0,2,4,3,2,1,0,0,1,3,2,4,2,0,0,2,3,5,3,2,0,0,1,2,4,3,2,0,0,0,2,3,2,1,0,0,2,3,4,5,3,0,0,1,2,3,2,0,0,0,2,4,3,5,2,0,0,0,0,0,0,0,0,0,1,2,3,4,2,0,0,2,3,4,3,2,0,0,1,2,3,0,0,0];
  const base=new Date("2025-12-01");
  counts.forEach((n,i)=>{ const dt=new Date(base); dt.setDate(dt.getDate()+i); d[dt.toISOString().split("T")[0]]=n; });
  return d;
})();
const TODAY="2026-03-17";
const MOMENTUM=[{l:"jan 20",n:8},{l:"jan 27",n:10},{l:"feb 3",n:7},{l:"feb 10",n:11},{l:"feb 17",n:9},{l:"feb 24",n:13},{l:"mar 3",n:10},{l:"mar 10",n:12},{l:"mar 17",n:14}];

// ─── primitives ───────────────────────────────────────────────────────────────

const f="monospace";
const Pill=({type,small})=>{const s=TM[type]||TM.log;return <span style={{fontSize:small?"9px":"10px",padding:"2px 6px",borderRadius:"20px",background:s.bg,color:s.color,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>{type}</span>;};
const SBadge=({signal})=>{const s=SM[signal]||SM.quiet;return <span style={{fontSize:"10px",padding:"2px 7px",borderRadius:"20px",background:s.bg,color:s.c,fontWeight:600,flexShrink:0}}>{signal}</span>;};
const Ic={
  home:   <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 7l6-5 6 5v8H10v-4H6v4H2z"/></svg>,
  feed:   <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="2"/><line x1="5" y1="7" x2="11" y2="7"/><line x1="5" y1="10" x2="9" y2="10"/></svg>,
  target: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r=".5" fill="currentColor"/></svg>,
  book:   <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h5a2 2 0 012 2v9a1.5 1.5 0 00-1.5-1.5H2V3z"/><path d="M14 3H9a2 2 0 00-2 2v9a1.5 1.5 0 011.5-1.5H14V3z"/></svg>,
  report: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="1" width="12" height="14" rx="2"/><line x1="5" y1="5" x2="11" y2="5"/><line x1="5" y1="8" x2="11" y2="8"/><line x1="5" y1="11" x2="8" y2="11"/></svg>,
  spark:  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4.2 4.2l2.1 2.1M9.7 9.7l2.1 2.1M4.2 11.8l2.1-2.1M9.7 6.3l2.1-2.1"/></svg>,
  back:   <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3L5 8l5 5"/></svg>,
  arrow:  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>,
  plus:   <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>,
  check:  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2"><path d="M2 5l3 3 3-4"/></svg>,
  trash:  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5h10l-1 9H4L3 5zM6 5V3h4v2M1 5h14"/></svg>,
  chev:   (o)=><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{transform:o?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0}}><path d="M4 6l4 4 4-4"/></svg>,
  send:   <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2L2 7l5 2 2 5z"/></svg>,
  fork:   <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="4" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="4" r="1.5"/><path d="M5 5.5v5M11 5.5c0 3-6 3-6 6"/></svg>,
};
function Btn({children,primary,small,onClick,disabled,style={}}){return <button onClick={onClick} disabled={disabled} style={{display:"flex",alignItems:"center",gap:"5px",padding:small?"4px 10px":"7px 14px",fontSize:small?"10px":"11px",border:primary?"none":"1px solid #e8e6de",borderRadius:"7px",background:disabled?"#f4f2ec":primary?"#1a1a18":"transparent",color:disabled?"#bbb":primary?"#fff":"#666",cursor:disabled?"default":"pointer",fontFamily:f,fontWeight:primary?600:400,transition:"all 0.15s",...style}}>{children}</button>;}
function Toast({msg}){if(!msg)return null;return <div style={{position:"absolute",bottom:"12px",left:"50%",transform:"translateX(-50%)",background:"#1a1a18",color:"#fff",padding:"6px 16px",borderRadius:"20px",fontSize:"10px",fontFamily:f,zIndex:200,whiteSpace:"nowrap"}}>✓ {msg}</div>;}

// ─── graphs ───────────────────────────────────────────────────────────────────

function MiniRadial({onClick}){
  const [hov,setHov]=useState(null),[card,setCard]=useState(false);
  const data=WEEK_DATA,n=data.length,cx=64,cy=64,minR=16,maxR=52,mx=Math.max(...data.map(d=>tot(d.entries)),1);
  const dom=d=>{let b="log",bn=0;TO.forEach(t=>{if((d.entries[t]||0)>bn){bn=d.entries[t]||0;b=t;}});return b;};
  return(
    <div onClick={onClick} onMouseEnter={()=>setCard(true)} onMouseLeave={()=>{setCard(false);setHov(null);}}
      style={{border:`1px solid ${card?"#534AB7":"#e8e6de"}`,borderRadius:"10px",padding:"12px",background:"#fff",cursor:"pointer",transition:"border-color 0.15s",flex:1}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"8px"}}>
        <div><div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px"}}>weekly</div><div style={{fontSize:"8px",color:"#ccc",fontFamily:f}}>mar 11–17</div></div>
        <div style={{display:"flex",alignItems:"center",gap:"3px"}}><div style={{textAlign:"right"}}><div style={{fontSize:"15px",fontWeight:700,color:"#1a1a18",fontFamily:f,lineHeight:1}}>19</div><div style={{fontSize:"7px",color:"#bbb"}}>entries</div></div><span style={{color:card?"#534AB7":"#ddd"}}>{Ic.arrow}</span></div>
      </div>
      <div style={{display:"flex",justifyContent:"center"}}>
        <svg viewBox="0 0 128 128" width="100" height="100">
          {data.map((d,i)=>{
            const sA=(i/n)*2*Math.PI-Math.PI/2,eA=sA+(2*Math.PI/n)*0.82,t=tot(d.entries),r=t===0?minR+3:minR+(t/mx)*(maxR-minR),dt=dom(d);
            const x1=cx+minR*Math.cos(sA),y1=cy+minR*Math.sin(sA),x2=cx+r*Math.cos(sA),y2=cy+r*Math.sin(sA),x3=cx+r*Math.cos(eA),y3=cy+r*Math.sin(eA),x4=cx+minR*Math.cos(eA),y4=cy+minR*Math.sin(eA),mA=(sA+eA)/2;
            return(<g key={i} onMouseEnter={e=>{e.stopPropagation();setHov(i);}} onMouseLeave={e=>{e.stopPropagation();setHov(null);}} style={{cursor:"pointer"}}>
              <path d={`M ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${minR} ${minR} 0 0 0 ${x1} ${y1} Z`} fill={t===0?"#f4f2ec":TM[dt].dot} opacity={hov===null?(t===0?0.3:0.78):hov===i?1:0.18} style={{transition:"opacity 0.12s"}}/>
              <text x={cx+(r+9)*Math.cos(mA)} y={cy+(r+9)*Math.sin(mA)} textAnchor="middle" dominantBaseline="central" fontFamily={f} fontSize="6" fill={hov===i?"#1a1a18":"#ccc"} fontWeight={hov===i?"700":"400"}>{d.label}</text>
            </g>);
          })}
          <circle cx={cx} cy={cy} r={minR-3} fill="#fafaf8"/>
          <text x={cx} y={cx-4} textAnchor="middle" fontFamily={f} fontSize="11" fill="#1a1a18" fontWeight="700">{hov!==null?tot(data[hov].entries):19}</text>
          <text x={cx} y={cx+7} textAnchor="middle" fontFamily={f} fontSize="6" fill="#bbb">{hov!==null?data[hov].label:"total"}</text>
        </svg>
      </div>
      <div style={{display:"flex",gap:"6px",justifyContent:"center",marginTop:"6px"}}>
        {[["cls",6],["dec",4],["sol",4]].map(([k,v])=><div key={k} style={{fontSize:"8px",color:"#bbb",fontFamily:f}}><span style={{color:"#555",fontWeight:700}}>{v}</span> {k}</div>)}
      </div>
    </div>
  );
}

function MiniStream({onClick}){
  const [card,setCard]=useState(false),[hovT,setHovT]=useState(null);
  const data=MONTH_DATA,W=200,H=52,n=data.length,sX=W/n,mx=Math.max(...data.map(d=>tot(d.entries)),1);
  const bands=e=>{let y=0;return TO.map(t=>{const h=((e[t]||0)/mx)*H;const b={y,h,t};y+=h;return b;});};
  const path=tk=>{const pts=data.map((d,i)=>{const b=bands(d.entries).find(b2=>b2.t===tk);return{x:i*sX+sX/2,yT:b?b.y:0,yB:b?b.y+b.h:0};});if(pts.every(p=>p.yT===p.yB))return null;let d=`M ${pts[0].x} ${pts[0].yT}`;for(let i=1;i<pts.length;i++){d+=` C ${pts[i-1].x+sX/2} ${pts[i-1].yT} ${pts[i].x-sX/2} ${pts[i].yT} ${pts[i].x} ${pts[i].yT}`;}d+=` L ${pts[pts.length-1].x} ${pts[pts.length-1].yB}`;for(let i=pts.length-2;i>=0;i--){d+=` C ${pts[i+1].x-sX/2} ${pts[i+1].yB} ${pts[i].x+sX/2} ${pts[i].yB} ${pts[i].x} ${pts[i].yB}`;}return d+" Z";};
  return(
    <div onClick={onClick} onMouseEnter={()=>setCard(true)} onMouseLeave={()=>{setCard(false);setHovT(null);}}
      style={{border:`1px solid ${card?"#534AB7":"#e8e6de"}`,borderRadius:"10px",padding:"12px",background:"#fff",cursor:"pointer",transition:"border-color 0.15s",flex:1}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"8px"}}>
        <div><div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px"}}>monthly</div><div style={{fontSize:"8px",color:"#ccc",fontFamily:f}}>march 2026</div></div>
        <div style={{display:"flex",alignItems:"center",gap:"3px"}}><div style={{textAlign:"right"}}><div style={{fontSize:"15px",fontWeight:700,color:"#1a1a18",fontFamily:f,lineHeight:1}}>89</div><div style={{fontSize:"7px",color:"#bbb"}}>entries</div></div><span style={{color:card?"#534AB7":"#ddd"}}>{Ic.arrow}</span></div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block",marginBottom:"4px"}}>
        {TO.map(t=>{const p=path(t);if(!p)return null;return <path key={t} d={p} fill={TM[t].dot} opacity={hovT===null?0.82:hovT===t?1:0.1} style={{transition:"opacity 0.15s",cursor:"pointer"}} onMouseEnter={e=>{e.stopPropagation();setHovT(t);}} onMouseLeave={e=>{e.stopPropagation();setHovT(null);}}/>;}) }
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
        {["1","8","15","22","31"].map(l=><span key={l} style={{fontSize:"7px",color:"#ccc",fontFamily:f}}>{l}</span>)}
      </div>
      <div style={{display:"flex",gap:"6px"}}>
        {[["cls",18],["dec",14],["sol",12]].map(([k,v])=><div key={k} style={{fontSize:"8px",color:"#bbb",fontFamily:f}}><span style={{color:"#555",fontWeight:700}}>{v}</span> {k}</div>)}
      </div>
    </div>
  );
}

function MiniSwimlane({onClick}){
  const [card,setCard]=useState(false),[hovT,setHovT]=useState(null);
  const data=YEAR_DATA,W=200,lH=12,lG=3,lW=48,cW=W-lW,n=data.length,sX=cW/n,mx=Math.max(...TO.map(t=>Math.max(...data.map(d=>d.entries[t]||0))),1),mR=5;
  return(
    <div onClick={onClick} onMouseEnter={()=>setCard(true)} onMouseLeave={()=>{setCard(false);setHovT(null);}}
      style={{border:`1px solid ${card?"#534AB7":"#e8e6de"}`,borderRadius:"10px",padding:"12px",background:"#fff",cursor:"pointer",transition:"border-color 0.15s",flex:1}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"8px"}}>
        <div><div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px"}}>yearly</div><div style={{fontSize:"8px",color:"#ccc",fontFamily:f}}>2026</div></div>
        <div style={{display:"flex",alignItems:"center",gap:"3px"}}><div style={{textAlign:"right"}}><div style={{fontSize:"15px",fontWeight:700,color:"#1a1a18",fontFamily:f,lineHeight:1}}>213</div><div style={{fontSize:"7px",color:"#bbb"}}>entries</div></div><span style={{color:card?"#534AB7":"#ddd"}}>{Ic.arrow}</span></div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${TO.length*(lH+lG)+12}`} style={{display:"block"}}>
        {TO.map((t,ti)=>{const y=ti*(lH+lG),isH=hovT===t;return(<g key={t} onMouseEnter={e=>{e.stopPropagation();setHovT(t);}} onMouseLeave={e=>{e.stopPropagation();setHovT(null);}} style={{cursor:"pointer"}}><rect x={lW} y={y} width={cW} height={lH} rx="2" fill={isH?TM[t].bg:"#f9f8f5"} style={{transition:"fill 0.15s"}}/><text x={lW-3} y={y+lH/2} textAnchor="end" dominantBaseline="central" fontFamily={f} fontSize="7" fill={isH?TM[t].color:"#ccc"} fontWeight={isH?"700":"400"}>{t}</text>{data.map((d,di)=>{const c=d.entries[t]||0;if(!c)return null;const r=Math.max((c/mx)*mR,1.5);return <circle key={di} cx={lW+di*sX+sX/2} cy={y+lH/2} r={r} fill={TM[t].dot} opacity={hovT&&!isH?0.1:0.82} style={{transition:"opacity 0.15s"}}/>;})}</g>);})}
        {data.map((d,i)=>(i===0||i===2||i===5||i===8||i===11)&&<text key={i} x={lW+i*sX+sX/2} y={TO.length*(lH+lG)+9} textAnchor="middle" fontFamily={f} fontSize="6" fill={tot(d.entries)>0?"#aaa":"#e0e0e0"}>{d.label}</text>)}
      </svg>
      <div style={{display:"flex",gap:"6px",marginTop:"4px"}}>
        {[["cls",94],["dec",62],["sol",38]].map(([k,v])=><div key={k} style={{fontSize:"8px",color:"#bbb",fontFamily:f}}><span style={{color:"#555",fontWeight:700}}>{v}</span> {k}</div>)}
      </div>
    </div>
  );
}

function Heatmap(){
  const [hov,setHov]=useState(null);
  const weeks=[]; const start=new Date("2025-12-01");
  for(let w=0;w<16;w++){const wk=[];for(let d=0;d<7;d++){const dt=new Date(start);dt.setDate(dt.getDate()+w*7+d);const k=dt.toISOString().split("T")[0];wk.push({k,n:HMAP[k]||0,fut:dt>new Date(TODAY),today:k===TODAY});}weeks.push(wk);}
  const mx=Math.max(...Object.values(HMAP),1);
  const col=(n,fut)=>{if(fut)return"transparent";if(n===0)return"#f0ede6";const s=["#d4c5f9","#b39cf0","#8f72e0","#6c4fd0","#4a2dc0","#2d1a9a"];return s[Math.min(Math.floor((n/mx)*s.length),s.length-1)];};
  return(
    <div><div style={{display:"flex",gap:"2px"}}>
      <div style={{display:"flex",flexDirection:"column",gap:"2px",marginRight:"3px"}}>{["M","","W","","F","",""].map((l,i)=><div key={i} style={{height:"10px",fontSize:"8px",color:"#ccc",fontFamily:f,lineHeight:"10px"}}>{l}</div>)}</div>
      {weeks.map((wk,wi)=><div key={wi} style={{display:"flex",flexDirection:"column",gap:"2px"}}>{wk.map(d=><div key={d.k} onMouseEnter={()=>setHov(d)} onMouseLeave={()=>setHov(null)} style={{width:"10px",height:"10px",borderRadius:"2px",background:col(d.n,d.fut),border:d.today?"1px solid #534AB7":"1px solid transparent",opacity:d.fut?0:1,flexShrink:0}}/>)}</div>)}
    </div>
    <div style={{marginTop:"5px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:"3px"}}><span style={{fontSize:"8px",color:"#ccc",fontFamily:f}}>less</span>{["#f0ede6","#d4c5f9","#8f72e0","#4a2dc0","#2d1a9a"].map((c,i)=><div key={i} style={{width:"8px",height:"8px",borderRadius:"2px",background:c}}/>)}<span style={{fontSize:"8px",color:"#ccc",fontFamily:f}}>more</span></div>
      <span style={{fontSize:"8px",color:hov&&hov.n>0?"#888":"#ccc",fontFamily:f}}>{hov&&hov.n>0?`${hov.k} · ${hov.n}`:"hover"}</span>
    </div></div>
  );
}

// ─── AI panel ─────────────────────────────────────────────────────────────────

function AiPanel(){
  const [q,setQ]=useState(""),[a,setA]=useState("");
  const ask=()=>{if(!q.trim())return;setA("Searching your logs...\n\nBased on your entries: jwt refresh bug fixed March 17 — expiry check was running after decode. You noted: \"Time lost: 2hrs. Check expiry BEFORE decode, always.\"\n\nRelated: 3 auth entries this month on api-refactor.");setQ("");};
  return(
    <div style={{width:"250px",borderLeft:"1px solid #e8e6de",display:"flex",flexDirection:"column",flexShrink:0,background:"#fafaf8"}}>
      <div style={{padding:"11px 13px",borderBottom:"1px solid #e8e6de",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",flexShrink:0}}>
        <span style={{fontSize:"11px",fontWeight:600,color:"#1a1a18",fontFamily:f}}>ask</span>
        <span style={{fontSize:"9px",padding:"2px 6px",background:"#EEEDFE",color:"#3C3489",borderRadius:"20px",fontWeight:700}}>Claude</span>
      </div>
      <div style={{flex:1,padding:"11px",overflowY:"auto"}}>
        {a?<div style={{fontSize:"11px",color:"#444",lineHeight:"1.8",fontFamily:f,whiteSpace:"pre-wrap"}}>{a}</div>
          :<div style={{color:"#ccc",fontSize:"11px",fontFamily:f,lineHeight:"2.2"}}>try:<br/>"when did i fix a jwt bug"<br/>"what did i decide about auth0"<br/>"my patterns this week"<br/>"solutions from march"</div>}
      </div>
      <div style={{padding:"9px",borderTop:"1px solid #e8e6de",display:"flex",gap:"5px",background:"#fff",flexShrink:0}}>
        <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="ask about your logs..." style={{flex:1,fontSize:"11px",padding:"6px 9px",border:"1px solid #d3d1c7",borderRadius:"6px",background:"#fafaf8",color:"#1a1a18",outline:"none",fontFamily:f}}/>
        <button onClick={ask} style={{padding:"6px 9px",background:"#1a1a18",border:"none",borderRadius:"6px",color:"#fff",cursor:"pointer"}}>{Ic.send}</button>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({onDrill}){
  return(
    <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:"11px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontSize:"15px",fontWeight:700,color:"#1a1a18",fontFamily:f,letterSpacing:"-0.3px"}}>good morning, jamie.</div><div style={{fontSize:"10px",color:"#bbb",fontFamily:f,marginTop:"2px"}}><span style={{color:"#534AB7"}}>12 days</span> in a row · <span style={{color:"#534AB7"}}>213 entries</span> in 2026</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:"22px",fontWeight:700,color:"#534AB7",fontFamily:f,lineHeight:1}}>12</div><div style={{fontSize:"8px",color:"#bbb",marginTop:"2px"}}>day streak</div></div>
      </div>
      {/* yesterday */}
      <div style={{border:"1px solid #e8e6de",borderRadius:"10px",padding:"11px 13px",background:"#fff"}}>
        <div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"7px"}}>yesterday · mar 16</div>
        {[{time:"17:00",type:"score",body:"pgvector migration — embeddings inserting correctly"},{time:"14:22",type:"ai",body:"unix pipes framing unlocked functional pipeline in claude"},{time:"09:30",type:"log",body:"picked up pgvector migration"}].map((e,i)=>(
          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"6px",padding:"3px 0",borderBottom:i<2?"1px solid #f9f8f5":"none"}}>
            <span style={{fontSize:"9px",color:"#ccc",fontFamily:f,flexShrink:0,paddingTop:"1px"}}>{e.time}</span>
            <Pill type={e.type} small/>
            <span style={{fontSize:"10px",color:"#555",fontFamily:f,lineHeight:"1.4",flex:1}}>{e.body}</span>
          </div>
        ))}
      </div>
      {/* heatmap */}
      <div style={{border:"1px solid #e8e6de",borderRadius:"10px",padding:"11px 13px",background:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"9px"}}>
          <div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px"}}>consistency · last 16 weeks</div>
          <div style={{display:"flex",gap:"10px"}}>{[["12","streak"],["31","longest"]].map(([v,l])=><div key={l} style={{textAlign:"right"}}><div style={{fontSize:"13px",fontWeight:700,color:"#1a1a18",fontFamily:f}}>{v}</div><div style={{fontSize:"8px",color:"#bbb"}}>{l}</div></div>)}</div>
        </div>
        <Heatmap/>
      </div>
      {/* momentum */}
      <div style={{border:"1px solid #e8e6de",borderRadius:"10px",padding:"11px 13px",background:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
          <div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px"}}>momentum · last 9 weeks</div>
          <span style={{fontSize:"9px",color:"#1D9E75",fontFamily:f}}>↑ 17% vs prior 4 weeks</span>
        </div>
        {(()=>{const W=340,H=44,mx=Math.max(...MOMENTUM.map(w=>w.n),1),sX=W/(MOMENTUM.length-1);const pts=MOMENTUM.map((w,i)=>({x:i*sX,y:H-(w.n/mx)*H}));const poly=pts.map(p=>`${p.x},${p.y}`).join(" ");return(
          <div><svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{display:"block"}}>
            <defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#534AB7" stopOpacity="0.12"/><stop offset="100%" stopColor="#534AB7" stopOpacity="0"/></linearGradient></defs>
            <polygon points={`0,${H} ${poly} ${W},${H}`} fill="url(#mg)"/>
            <polyline points={poly} fill="none" stroke="#534AB7" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7"/>
            {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fff" stroke="#534AB7" strokeWidth="1.5"/>)}
          </svg>
          <div style={{padding:"7px 9px",background:"#f9f8f5",borderRadius:"7px",borderLeft:"2px solid #534AB7",marginTop:"6px",display:"flex",gap:"5px"}}>
            <span style={{color:"#534AB7",flexShrink:0}}>{Ic.spark}</span>
            <div style={{fontSize:"10px",color:"#555",fontFamily:f,lineHeight:"1.7"}}>3 score entries this week — solid delivery. 4 decisions logged, 3 with explicit reasoning.</div>
          </div></div>
        );})()}
      </div>
      {/* graphs */}
      <div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px"}}>progress · click to explore</div>
      <div style={{display:"flex",gap:"8px"}}>
        <MiniRadial onClick={()=>onDrill("week")}/>
        <MiniStream onClick={()=>onDrill("month")}/>
        <MiniSwimlane onClick={()=>onDrill("year")}/>
      </div>
      {/* goals snapshot */}
      <div style={{border:"1px solid #e8e6de",borderRadius:"10px",padding:"11px 13px",background:"#fff"}}>
        <div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"7px"}}>goals · latest signal</div>
        {GOALS_INIT.map((g,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:"7px",padding:"5px 8px",border:"1px solid #f0ede6",borderRadius:"7px",background:"#fafaf8",marginBottom:"4px"}}>
          <div style={{width:"5px",height:"5px",borderRadius:"50%",background:g.type==="career"?"#534AB7":"#1D9E75",flexShrink:0}}/>
          <div style={{flex:1}}><div style={{fontSize:"10px",color:"#1a1a18",fontFamily:f}}>{g.title}</div><div style={{fontSize:"8px",color:"#bbb",fontFamily:f}}>→ {g.horizon}</div></div>
          <SBadge signal={g.progress[0]?.signal||"quiet"}/>
        </div>)}
      </div>
    </div>
  );
}

// ─── DRILL VIEW ───────────────────────────────────────────────────────────────

function DrillView({period,onBack}){
  const cfg={week:{title:"this week",sub:"march 11–17"},month:{title:"this month",sub:"march 2026"},year:{title:"this year",sub:"2026"}}[period];
  const stats={week:{t:19,c:6,d:4,s:4},month:{t:89,c:18,d:14,s:12},year:{t:213,c:94,d:62,s:38}}[period];
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"0 16px",borderBottom:"1px solid #e8e6de",background:"#fff",height:"40px",display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:"3px",fontSize:"11px",color:"#aaa",background:"none",border:"none",cursor:"pointer",fontFamily:f,padding:0}}>{Ic.back} dashboard</button>
        <span style={{color:"#e8e6de"}}>·</span>
        <span style={{fontSize:"11px",fontWeight:600,color:"#1a1a18",fontFamily:f}}>{cfg.title}</span>
        <span style={{fontSize:"10px",color:"#bbb",fontFamily:f}}>{cfg.sub}</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:"11px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
          {[["entries",stats.t],["closed",stats.c],["decisions",stats.d],["solutions",stats.s]].map(([k,v])=><div key={k} style={{border:"1px solid #e8e6de",borderRadius:"8px",padding:"10px",background:"#fff",textAlign:"center"}}><div style={{fontSize:"20px",fontWeight:700,color:"#1a1a18",fontFamily:f,lineHeight:1}}>{v}</div><div style={{fontSize:"9px",color:"#bbb",marginTop:"3px"}}>{k}</div></div>)}
        </div>
        <div style={{border:"1px solid #e8e6de",borderRadius:"10px",padding:"14px 16px",background:"#fff"}}>
          <div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"10px"}}>{period==="week"?"radial":period==="month"?"stream":"swimlane"} · {cfg.sub}</div>
          {period==="week"&&<div style={{display:"flex",justifyContent:"center"}}><svg viewBox="0 0 220 220" width="180" height="180">{WEEK_DATA.map((d,i)=>{const n=WEEK_DATA.length,sA=(i/n)*2*Math.PI-Math.PI/2,eA=sA+(2*Math.PI/n)*0.82,t=tot(d.entries),mx2=Math.max(...WEEK_DATA.map(d2=>tot(d2.entries)),1),r=t===0?28:28+(t/mx2)*80,cx=110,cy=110;const dom2=()=>{let b="log",bn=0;TO.forEach(tp=>{if((d.entries[tp]||0)>bn){bn=d.entries[tp]||0;b=tp;}});return b;};const x1=cx+28*Math.cos(sA),y1=cy+28*Math.sin(sA),x2=cx+r*Math.cos(sA),y2=cy+r*Math.sin(sA),x3=cx+r*Math.cos(eA),y3=cy+r*Math.sin(eA),x4=cx+28*Math.cos(eA),y4=cy+28*Math.sin(eA),mA=(sA+eA)/2;return(<g key={i}><path d={`M ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A 28 28 0 0 0 ${x1} ${y1} Z`} fill={t===0?"#f4f2ec":TM[dom2()].dot} opacity={t===0?0.3:0.8}/><text x={cx+(r+12)*Math.cos(mA)} y={cy+(r+12)*Math.sin(mA)} textAnchor="middle" dominantBaseline="central" fontFamily={f} fontSize="9" fill="#888">{d.label}</text></g>);})}<circle cx="110" cy="110" r="24" fill="#fafaf8"/><text x="110" y="107" textAnchor="middle" fontFamily={f} fontSize="15" fill="#1a1a18" fontWeight="700">19</text><text x="110" y="119" textAnchor="middle" fontFamily={f} fontSize="7" fill="#bbb">entries</text></svg></div>}
          {period==="month"&&(()=>{const W=380,H=80,n=MONTH_DATA.length,sX=W/n,mx2=Math.max(...MONTH_DATA.map(d=>tot(d.entries)),1);const bds=e=>{let y=0;return TO.map(t=>{const h=((e[t]||0)/mx2)*H;const b={y,h,t};y+=h;return b;});};const pt=tk=>{const pts=MONTH_DATA.map((d,i)=>{const b=bds(d.entries).find(b2=>b2.t===tk);return{x:i*sX+sX/2,yT:b?b.y:0,yB:b?b.y+b.h:0};});if(pts.every(p=>p.yT===p.yB))return null;let d=`M ${pts[0].x} ${pts[0].yT}`;for(let i=1;i<pts.length;i++){d+=` C ${pts[i-1].x+sX/2} ${pts[i-1].yT} ${pts[i].x-sX/2} ${pts[i].yT} ${pts[i].x} ${pts[i].yT}`;}d+=` L ${pts[pts.length-1].x} ${pts[pts.length-1].yB}`;for(let i=pts.length-2;i>=0;i--){d+=` C ${pts[i+1].x-sX/2} ${pts[i+1].yB} ${pts[i].x+sX/2} ${pts[i].yB} ${pts[i].x} ${pts[i].yB}`;}return d+" Z";};return<svg width="100%" viewBox={`0 0 ${W} ${H+14}`} style={{display:"block"}}>{TO.map(t=>{const p=pt(t);if(!p)return null;return<path key={t} d={p} fill={TM[t].dot} opacity="0.82"/>;})}{MONTH_DATA.map((d,i)=>(i===0||(parseInt(d.label))%5===0)&&<text key={i} x={i*sX+sX/2} y={H+11} textAnchor="middle" fontFamily={f} fontSize="7" fill="#ccc">{d.label}</text>)}</svg>;})()}
          {period==="year"&&(()=>{const W=380,lH=20,lG=4,lLW=60,cW=W-lLW,n=YEAR_DATA.length,sX=cW/n,mx2=Math.max(...TO.map(t=>Math.max(...YEAR_DATA.map(d=>d.entries[t]||0))),1),mR=8;return<svg width="100%" viewBox={`0 0 ${W} ${TO.length*(lH+lG)+14}`} style={{display:"block"}}>{TO.map((t,ti)=>{const y=ti*(lH+lG);return(<g key={t}><rect x={lLW} y={y} width={cW} height={lH} rx="3" fill="#f9f8f5"/><text x={lLW-4} y={y+lH/2} textAnchor="end" dominantBaseline="central" fontFamily={f} fontSize="8" fill="#bbb">{t}</text>{YEAR_DATA.map((d,di)=>{const c=d.entries[t]||0;if(!c)return null;const r=Math.max((c/mx2)*mR,2);return<circle key={di} cx={lLW+di*sX+sX/2} cy={y+lH/2} r={r} fill={TM[t].dot} opacity="0.85"/>;})}</g>);})} {YEAR_DATA.map((d,i)=><text key={i} x={lLW+i*sX+sX/2} y={TO.length*(lH+lG)+11} textAnchor="middle" fontFamily={f} fontSize="8" fill={tot(d.entries)>0?"#888":"#e0e0e0"}>{d.label}</text>)}</svg>;})()}
        </div>
        <div style={{border:"1px solid #e8e6de",borderRadius:"10px",padding:"12px 14px",background:"#fff"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}><div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px"}}>AI summary</div><span style={{fontSize:"9px",padding:"2px 6px",background:"#EEEDFE",color:"#3C3489",borderRadius:"20px",fontWeight:700}}>Claude</span></div>
          <div style={{fontSize:"11px",color:"#555",fontFamily:f,lineHeight:"1.8"}}>{{week:"3 score entries this week — solid delivery. 4 decisions logged, 3 with explicit reasoning. Entry count up 2 from last week.",month:"18 tickets closed across 3 projects. Decision quality improving — 11 of 14 with explicit reasoning. Velocity up 37%.",year:"213 entries across 3 months. 38 solutions logged. 62 decisions, 48 with reasoning. Output trending up in Q1."}[period]}</div>
          <button style={{marginTop:"9px",display:"flex",alignItems:"center",gap:"4px",fontSize:"10px",padding:"4px 10px",border:"1px solid #e8e6de",borderRadius:"6px",background:"transparent",color:"#888",cursor:"pointer",fontFamily:f}}>{Ic.spark} generate full digest</button>
        </div>
      </div>
    </div>
  );
}

// ─── LOG VIEW ─────────────────────────────────────────────────────────────────

function LogView({entries,onAdd,onDelete}){
  const [exp,setExp]=useState(null),[filter,setFilter]=useState("all"),[tab,setTab]=useState("feed"),[compose,setCompose]=useState(""),[compType,setCompType]=useState("log");
  const types=["all","solution","decision","reflection","score","ai","log"];
  const filtered=filter==="all"?entries:entries.filter(e=>e.type===filter);
  const grouped=filtered.reduce((a,e)=>{(a[e.date]=a[e.date]||[]).push(e);return a;},{});

  const handleLog=()=>{
    if(!compose.trim())return;
    const now=new Date();
    const time=now.toTimeString().slice(0,5);
    onAdd({id:Date.now(),date:TODAY,time,body:compose,type:compType,project:"devlog-platform",detail:null});
    setCompose("");
  };

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"8px 13px",borderBottom:"1px solid #e8e6de",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:"#fff"}}>
        <div style={{display:"flex",gap:"3px"}}>{["feed","stats","playbooks"].map(t=><button key={t} onClick={()=>setTab(t)} style={{fontSize:"10px",padding:"4px 10px",border:"none",borderRadius:"20px",background:tab===t?"#1a1a18":"transparent",color:tab===t?"#fff":"#aaa",cursor:"pointer",fontFamily:f}}>{t}</button>)}</div>
        <span style={{fontSize:"9px",color:"#aaa",fontFamily:f}}>{entries.length} entries</span>
      </div>
      {tab==="feed"&&<>
        <div style={{padding:"6px 13px",borderBottom:"1px solid #e8e6de",display:"flex",gap:"4px",flexWrap:"wrap",flexShrink:0}}>
          {types.map(t=><button key={t} onClick={()=>setFilter(t)} style={{fontSize:"9px",padding:"2px 7px",border:`1px solid ${filter===t?"#1a1a18":"#e8e6de"}`,borderRadius:"20px",background:filter===t?"#1a1a18":"transparent",color:filter===t?"#fff":"#aaa",cursor:"pointer",fontFamily:f}}>{t}</button>)}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px 13px"}}>
          {Object.entries(grouped).map(([date,es])=>(
            <div key={date} style={{marginBottom:"13px"}}>
              <div style={{fontSize:"9px",color:"#bbb",fontFamily:f,marginBottom:"6px",textTransform:"uppercase",letterSpacing:"1px"}}>{date}</div>
              {es.map(e=>(
                <div key={e.id} style={{border:`1px solid ${exp===e.id?TM[e.type].dot:"#e8e6de"}`,borderRadius:"8px",padding:"8px 10px",background:"#fff",marginBottom:"5px",transition:"border-color 0.15s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px",flexWrap:"wrap"}} onClick={()=>setExp(exp===e.id?null:e.id)}>
                    <span style={{fontSize:"9px",color:"#bbb",fontFamily:f,cursor:"pointer"}}>{e.time}</span>
                    <Pill type={e.type} small/>
                    {e.project&&<span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"20px",background:"#f4f2ec",color:TM[e.type]?.dot||"#666",fontFamily:f}}>{e.project}</span>}
                    <button onClick={ev=>{ev.stopPropagation();onDelete(e.id);}} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"#ddd",padding:"2px",display:"flex"}}>{Ic.trash}</button>
                  </div>
                  <div onClick={()=>setExp(exp===e.id?null:e.id)} style={{fontSize:"11px",color:"#1a1a18",lineHeight:"1.5",fontFamily:f,cursor:"pointer"}}>{e.body}</div>
                  {exp===e.id&&e.detail&&<div style={{marginTop:"8px",padding:"7px 9px",background:"#f4f2ec",borderLeft:`2px solid ${TM[e.type].dot}`,borderRadius:"0 5px 5px 0",fontSize:"10px",color:"#555",fontFamily:f,whiteSpace:"pre-wrap",lineHeight:"1.7"}}>{e.detail}</div>}
                </div>
              ))}
            </div>
          ))}
          {Object.keys(grouped).length===0&&<div style={{textAlign:"center",padding:"24px 0",color:"#ccc",fontFamily:f,fontSize:"11px"}}>no entries yet — start logging below</div>}
        </div>
        <div style={{padding:"9px 13px",borderTop:"1px solid #e8e6de",flexShrink:0,background:"#fff"}}>
          <div style={{border:"1px solid #d3d1c7",borderRadius:"9px",padding:"8px 10px"}}>
            <input value={compose} onChange={e=>setCompose(e.target.value)} onKeyDown={e=>(e.metaKey||e.ctrlKey)&&e.key==="Enter"&&handleLog()} placeholder="log what you're working on..." style={{width:"100%",border:"none",outline:"none",fontSize:"11px",color:"#1a1a18",background:"transparent",fontFamily:f,marginBottom:"6px"}}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"6px"}}>
              <div style={{display:"flex",gap:"3px",flexWrap:"wrap"}}>
                {["log","solution","decision","reflection","score","ai"].map(t=><button key={t} onClick={()=>setCompType(t)} style={{fontSize:"9px",padding:"2px 7px",border:`1px solid ${compType===t?"#534AB7":"#e8e6de"}`,borderRadius:"20px",background:compType===t?"#EEEDFE":"transparent",color:compType===t?"#3C3489":"#aaa",cursor:"pointer",fontFamily:f}}>{t}</button>)}
              </div>
              <Btn primary small onClick={handleLog}>Log ⌘↵</Btn>
            </div>
          </div>
        </div>
      </>}
      {tab==="stats"&&(
        <div style={{flex:1,overflowY:"auto",padding:"12px 13px"}}>
          <div style={{marginBottom:"14px"}}>
            <div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"8px"}}>activity — last 7 days</div>
            <div style={{display:"flex",gap:"4px",alignItems:"flex-end",height:"52px"}}>{[2,4,3,5,2,3,5].map((n,i)=><div key={i} style={{flex:1,height:`${(n/5)*100}%`,background:"#534AB7",borderRadius:"2px 2px 0 0",opacity:0.3+(n/5)*0.5}}/>)}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px",marginBottom:"14px"}}>
            {Object.entries({solution:4,decision:2,reflection:3,score:6,ai:3,log:2}).map(([t,n])=>{const s=TM[t];return<div key={t} style={{background:s.bg,borderRadius:"7px",padding:"8px",textAlign:"center"}}><div style={{fontSize:"16px",fontWeight:700,color:s.color,fontFamily:f}}>{n}</div><div style={{fontSize:"8px",color:s.color}}>{t}</div></div>;})}
          </div>
          <div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"7px"}}>skill map</div>
          {[["auth / security",8],["node.js",6],["database",5],["ai prompting",4]].map(([s,n])=>(<div key={s} style={{marginBottom:"5px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}><span style={{fontSize:"9px",color:"#555",fontFamily:f}}>{s}</span><span style={{fontSize:"9px",color:"#bbb",fontFamily:f}}>{n}</span></div><div style={{height:"3px",background:"#f0ede6",borderRadius:"2px"}}><div style={{height:"100%",width:`${(n/8)*100}%`,background:"#534AB7",borderRadius:"2px",opacity:0.7}}/></div></div>))}
        </div>
      )}
      {tab==="playbooks"&&(
        <div style={{flex:1,overflowY:"auto",padding:"10px 13px"}}>
          {MY_PB.map(p=>(<div key={p.id} style={{border:"1px solid #e8e6de",borderRadius:"8px",padding:"10px",background:"#fff",marginBottom:"6px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:"#1a1a18",fontFamily:f,marginBottom:"4px"}}>{p.title}</div>
            {p.forked_from&&<div style={{fontSize:"9px",color:"#aaa",fontFamily:f,marginBottom:"4px",display:"flex",alignItems:"center",gap:"3px"}}>{Ic.fork} forked from {p.forked_from}</div>}
            <div style={{display:"flex",gap:"4px",marginBottom:"6px"}}>{p.tags.map(t=><span key={t} style={{fontSize:"9px",padding:"1px 6px",background:"#f4f2ec",border:"1px solid #e8e6de",borderRadius:"20px",color:"#888"}}>{t}</span>)}</div>
            <div style={{fontSize:"9px",color:"#bbb",fontFamily:f}}>{p.steps} steps</div>
          </div>))}
          <button style={{width:"100%",padding:"7px",border:"1px dashed #d3d1c7",borderRadius:"8px",background:"transparent",color:"#aaa",cursor:"pointer",fontSize:"10px",fontFamily:f}}>+ new playbook</button>
        </div>
      )}
    </div>
  );
}

// ─── GOALS VIEW ───────────────────────────────────────────────────────────────

function GoalsView(){
  const [goals,setGoals]=useState(GOALS_INIT),[sel,setSel]=useState(1),[tab,setTab]=useState("steps"),[toast,setToast]=useState(null);
  const flash=msg=>{setToast(msg);setTimeout(()=>setToast(null),2200);};
  const selGoal=goals.find(g=>g.id===sel);
  const SO=["not_started","in_progress","done"];
  const SS={not_started:{l:"not started",c:"#aaa",bg:"#f4f2ec"},in_progress:{l:"in progress",c:"#185FA5",bg:"#E6F1FB"},done:{l:"done",c:"#1D9E75",bg:"#E1F5EE"}};
  const cycleStep=(gid,sid)=>{setGoals(p=>p.map(g=>g.id===gid?{...g,steps:g.steps.map(s=>s.id===sid?{...s,status:SO[(SO.indexOf(s.status)+1)%SO.length]}:s)}:g));flash("step updated");};
  const delStep=(gid,sid)=>{setGoals(p=>p.map(g=>g.id===gid?{...g,steps:g.steps.filter(s=>s.id!==sid)}:g));flash("step removed");};
  const acceptSug=(gid,sug)=>{setGoals(p=>p.map(g=>g.id===gid?{...g,steps:[...g.steps,{id:Date.now(),title:sug.title,status:"not_started",notes:`AI: ${sug.reason}`,due:null,linked:[]}],suggestions:g.suggestions.filter(s=>s.id!==sug.id)}:g));flash("added as step");};
  const dismissSug=(gid,sid)=>{setGoals(p=>p.map(g=>g.id===gid?{...g,suggestions:g.suggestions.filter(s=>s.id!==sid)}:g));flash("dismissed");};

  return(
    <div style={{flex:1,display:"flex",overflow:"hidden",position:"relative"}}>
      <Toast msg={toast}/>
      {/* left */}
      <div style={{width:"255px",borderRight:"1px solid #e8e6de",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"10px 11px",borderBottom:"1px solid #e8e6de",background:"#fff"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"7px"}}><div style={{fontSize:"12px",fontWeight:700,color:"#1a1a18"}}>goals</div><button style={{display:"flex",alignItems:"center",gap:"4px",padding:"3px 8px",fontSize:"9px",border:"none",borderRadius:"5px",background:"#1a1a18",color:"#fff",cursor:"pointer",fontFamily:f}}>{Ic.plus} new</button></div>
          <div style={{display:"flex",gap:"3px"}}>{[["active",goals.filter(g=>g.status==="active").length],["archived",0]].map(([t,n])=><button key={t} style={{flex:1,padding:"3px",fontSize:"9px",border:"none",borderRadius:"5px",background:t==="active"?"#f4f2ec":"transparent",color:t==="active"?"#1a1a18":"#bbb",cursor:"pointer",fontFamily:f,fontWeight:t==="active"?600:400}}>{t} {n>0&&`(${n})`}</button>)}</div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"7px"}}>
          {goals.filter(g=>g.status==="active").map(g=>{const career=g.type==="career",ac=career?"#534AB7":"#1D9E75",done=g.steps.filter(s=>s.status==="done").length;return(
            <div key={g.id} onClick={()=>{setSel(g.id);setTab("steps");}} style={{border:`1px solid ${sel===g.id?ac:"#e8e6de"}`,borderLeft:`3px solid ${ac}`,borderRadius:"8px",padding:"9px 10px",background:sel===g.id?"#fdfcff":"#fff",cursor:"pointer",marginBottom:"6px",transition:"all 0.15s"}}>
              <div style={{display:"flex",gap:"4px",marginBottom:"3px",flexWrap:"wrap"}}>
                <span style={{fontSize:"9px",padding:"1px 5px",borderRadius:"20px",background:career?"#EEEDFE":"#E1F5EE",color:career?"#3C3489":"#085041",fontWeight:700}}>{career?"career":"learning"}</span>
                {g.suggestions.length>0&&<span style={{fontSize:"8px",padding:"1px 5px",borderRadius:"20px",background:"#EEEDFE",color:"#534AB7",fontWeight:600}}>{g.suggestions.length} AI</span>}
              </div>
              <div style={{fontSize:"11px",fontWeight:700,color:"#1a1a18",fontFamily:f,marginBottom:"5px",lineHeight:"1.3"}}>{g.title}</div>
              {g.steps.length>0&&<div style={{marginBottom:"3px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}><span style={{fontSize:"8px",color:"#bbb",fontFamily:f}}>steps</span><span style={{fontSize:"8px",color:ac,fontFamily:f}}>{done}/{g.steps.length}</span></div><div style={{height:"2px",background:"#f0ede6",borderRadius:"2px"}}><div style={{height:"100%",width:g.steps.length>0?`${(done/g.steps.length)*100}%`:"0%",background:ac,borderRadius:"2px",opacity:0.7,transition:"width 0.3s"}}/></div></div>}
              <div style={{fontSize:"8px",color:"#bbb",fontFamily:f}}>→ {g.horizon}</div>
            </div>
          );})}
        </div>
        {goals.filter(g=>g.status==="active").length>=5&&<div style={{padding:"6px 11px",borderTop:"1px solid #f0ede6",fontSize:"9px",color:"#D85A30",fontFamily:f,background:"#fff8f5"}}>5/5 — pause one to add another</div>}
      </div>
      {/* right */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {selGoal?(()=>{
          const career=selGoal.type==="career",ac=career?"#534AB7":"#1D9E75",acBg=career?"#EEEDFE":"#E1F5EE",acTxt=career?"#3C3489":"#085041",done=selGoal.steps.filter(s=>s.status==="done").length;
          const inP=selGoal.steps.filter(s=>s.status==="in_progress"),notS=selGoal.steps.filter(s=>s.status==="not_started"),doneS=selGoal.steps.filter(s=>s.status==="done");
          return(<>
            <div style={{padding:"11px 14px",borderBottom:"1px solid #e8e6de",flexShrink:0,background:"#fff"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px",marginBottom:"5px"}}>
                <div style={{flex:1}}><span style={{fontSize:"9px",padding:"1px 6px",borderRadius:"20px",background:acBg,color:acTxt,fontWeight:700,display:"inline-block",marginBottom:"3px"}}>{career?"career":"learning"}</span><div style={{fontSize:"13px",fontWeight:700,color:"#1a1a18",fontFamily:f,lineHeight:"1.3"}}>{selGoal.title}</div></div>
                {selGoal.steps.length>0&&<div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:"17px",fontWeight:700,color:ac,fontFamily:f,lineHeight:1}}>{done}/{selGoal.steps.length}</div><div style={{fontSize:"8px",color:"#bbb",marginTop:"1px"}}>done</div></div>}
              </div>
              {selGoal.why&&<div style={{fontSize:"9px",color:"#888",fontFamily:f,fontStyle:"italic",marginBottom:"7px"}}>"{selGoal.why}"</div>}
              {selGoal.steps.length>0&&<div style={{height:"3px",background:"#f0ede6",borderRadius:"3px",marginBottom:"9px",overflow:"hidden"}}><div style={{height:"100%",width:`${(done/selGoal.steps.length)*100}%`,background:ac,borderRadius:"3px",opacity:0.8,transition:"width 0.4s"}}/></div>}
              <div style={{display:"flex",gap:"3px"}}>
                {[["steps",`steps (${selGoal.steps.length})`],["progress","progress"],["suggestions",selGoal.suggestions.length>0?`AI (${selGoal.suggestions.length})`:"AI"]].map(([t,lbl])=>(
                  <button key={t} onClick={()=>setTab(t)} style={{fontSize:"9px",padding:"3px 9px",border:"none",borderRadius:"20px",background:tab===t?"#1a1a18":"transparent",color:tab===t?"#fff":"#aaa",cursor:"pointer",fontFamily:f,fontWeight:tab===t?600:400}}>{lbl}</button>
                ))}
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"11px 14px"}}>
              {tab==="steps"&&<div>
                {selGoal.steps.length===0&&<div style={{textAlign:"center",padding:"18px 0",color:"#ccc",fontFamily:f,fontSize:"10px"}}>no steps yet</div>}
                {inP.length>0&&<div style={{marginBottom:"10px"}}><div style={{fontSize:"8px",color:"#185FA5",fontFamily:f,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"4px"}}>in progress</div>{inP.map(s=>renderStep(s,ac,selGoal.id,SS,cycleStep,delStep))}</div>}
                {notS.length>0&&<div style={{marginBottom:"10px"}}><div style={{fontSize:"8px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"4px"}}>not started</div>{notS.map(s=>renderStep(s,ac,selGoal.id,SS,cycleStep,delStep))}</div>}
                <button style={{display:"flex",alignItems:"center",gap:"4px",width:"100%",padding:"6px 8px",border:"1px dashed #d3d1c7",borderRadius:"7px",background:"transparent",color:"#aaa",cursor:"pointer",fontSize:"9px",fontFamily:f,marginBottom:"10px"}}>{Ic.plus} add step</button>
                {doneS.length>0&&<div><div style={{fontSize:"8px",color:"#1D9E75",fontFamily:f,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"4px"}}>done ({doneS.length})</div>{doneS.map(s=>renderStep(s,ac,selGoal.id,SS,cycleStep,delStep))}</div>}
              </div>}
              {tab==="progress"&&<div>{selGoal.progress.map((p,i)=><div key={i} style={{border:"1px solid #e8e6de",borderRadius:"8px",padding:"9px 11px",marginBottom:"7px",background:"#fff"}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px"}}><SBadge signal={p.signal}/><span style={{fontSize:"9px",color:"#aaa",fontFamily:f}}>{p.week}</span></div>
                <div style={{padding:"6px 8px",background:"#f9f8f5",borderRadius:"6px",borderLeft:`2px solid ${ac}`,display:"flex",gap:"5px"}}><span style={{color:ac,flexShrink:0}}>{Ic.spark}</span><div style={{fontSize:"10px",color:"#555",fontFamily:f,lineHeight:"1.7"}}>{p.note}</div></div>
              </div>)}</div>}
              {tab==="suggestions"&&<div>
                {selGoal.suggestions.length===0
                  ?<div style={{textAlign:"center",padding:"18px 0",color:"#ccc",fontFamily:f,fontSize:"10px"}}>no suggestions right now</div>
                  :<>{selGoal.suggestions.map(s=><div key={s.id} style={{border:"1px dashed #c4b5fd",borderRadius:"8px",padding:"9px 10px",background:"#fdfcff",marginBottom:"6px"}}>
                    <div style={{display:"flex",gap:"5px",alignItems:"flex-start",marginBottom:"6px"}}><span style={{color:"#534AB7",flexShrink:0}}>{Ic.spark}</span><div><div style={{fontSize:"10px",fontWeight:600,color:"#1a1a18",fontFamily:f,marginBottom:"2px"}}>{s.title}</div><div style={{fontSize:"9px",color:"#888",fontFamily:f,lineHeight:"1.5",fontStyle:"italic"}}>{s.reason}</div></div></div>
                    <div style={{display:"flex",gap:"4px"}}>
                      <button onClick={()=>acceptSug(selGoal.id,s)} style={{fontSize:"9px",padding:"3px 9px",border:"none",borderRadius:"5px",background:"#534AB7",color:"#fff",cursor:"pointer",fontFamily:f,fontWeight:600}}>add as step</button>
                      <button onClick={()=>dismissSug(selGoal.id,s.id)} style={{fontSize:"9px",padding:"3px 9px",border:"1px solid #e8e6de",borderRadius:"5px",background:"transparent",color:"#888",cursor:"pointer",fontFamily:f}}>dismiss</button>
                    </div>
                  </div>)}</>}
              </div>}
            </div>
          </>);
        })():<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc",fontFamily:f,fontSize:"11px"}}>select a goal</div>}
      </div>
    </div>
  );
}

function renderStep(s,ac,gid,SS,cycle,del){
  const done=s.status==="done";
  return(
    <div key={s.id} style={{border:"1px solid #e8e6de",borderRadius:"7px",padding:"7px 9px",background:done?"#f9f8f5":"#fff",marginBottom:"4px",opacity:done?0.72:1}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:"7px"}}>
        <div onClick={()=>cycle(gid,s.id)} style={{width:"15px",height:"15px",borderRadius:"50%",border:`1.5px solid ${done?"#1D9E75":ac}`,background:done?"#1D9E75":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px",cursor:"pointer",transition:"all 0.15s"}}>{done&&Ic.check}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:"10px",fontWeight:600,color:done?"#aaa":"#1a1a18",fontFamily:f,lineHeight:"1.3",textDecoration:done?"line-through":"none",marginBottom:"3px"}}>{s.title}</div>
          <div style={{display:"flex",gap:"4px",flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:"8px",padding:"1px 5px",borderRadius:"20px",background:SS[s.status].bg,color:SS[s.status].c,fontWeight:600,fontFamily:f}}>{SS[s.status].l}</span>
            {s.due&&<span style={{fontSize:"8px",color:"#bbb",fontFamily:f}}>{s.due}</span>}
            {s.linked&&s.linked.length>0&&<span style={{fontSize:"8px",color:ac,fontFamily:f}}>{s.linked.length} linked</span>}
          </div>
        </div>
        <button onClick={()=>del(gid,s.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ddd",padding:"2px",display:"flex"}}>{Ic.trash}</button>
      </div>
    </div>
  );
}

// ─── PLAYBOOKS LIB VIEW ───────────────────────────────────────────────────────

function PlaybooksView(){
  const [search,setSearch]=useState(""),[forked,setForked]=useState([]),[toast,setToast]=useState(null);
  const flash=msg=>{setToast(msg);setTimeout(()=>setToast(null),2000);};
  const COMMUNITY=[
    { id:10, title:"debugging node.js memory leaks", author:"priya", avatar:"PK", tags:["node","memory"], steps:5, forked_by:3 },
    { id:11, title:"stripe webhook idempotency",     author:"marco", avatar:"MR", tags:["stripe","backend"], steps:4, forked_by:1 },
    { id:12, title:"rust async mental model",         author:"marco", avatar:"MR", tags:["rust","async"], steps:3, forked_by:0 },
  ];
  const filtered=COMMUNITY.filter(p=>!search||p.title.includes(search)||p.tags.some(t=>t.includes(search)));
  return(
    <div style={{flex:1,overflowY:"auto",padding:"12px 14px",position:"relative"}}>
      <Toast msg={toast}/>
      <div style={{fontSize:"9px",color:"#bbb",fontFamily:f,marginBottom:"9px",padding:"5px 8px",background:"#f9f8f5",borderRadius:"6px"}}>community playbooks — fork to your private collection</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="search playbooks..." style={{width:"100%",fontSize:"11px",padding:"6px 10px",border:"1px solid #d3d1c7",borderRadius:"7px",background:"#fafaf8",color:"#1a1a18",outline:"none",fontFamily:f,marginBottom:"8px",boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:"4px",marginBottom:"10px",flexWrap:"wrap"}}>{["node","stripe","rust","memory"].map(t=><button key={t} onClick={()=>setSearch(t)} style={{fontSize:"9px",padding:"2px 7px",border:`1px solid ${search===t?"#1a1a18":"#e8e6de"}`,borderRadius:"20px",background:search===t?"#1a1a18":"transparent",color:search===t?"#fff":"#aaa",cursor:"pointer",fontFamily:f}}>#{t}</button>)}</div>
      {filtered.map(p=>{const fk=forked.includes(p.id);return(
        <div key={p.id} style={{border:"1px solid #e8e6de",borderRadius:"8px",padding:"11px",background:"#fff",marginBottom:"7px"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:"#1a1a18",fontFamily:f,marginBottom:"4px"}}>{p.title}</div>
          <div style={{display:"flex",alignItems:"center",gap:"5px",marginBottom:"6px"}}><div style={{width:"15px",height:"15px",borderRadius:"50%",background:"#E1F5EE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"7px",fontWeight:700,color:"#085041"}}>{p.avatar}</div><span style={{fontSize:"9px",color:"#aaa",fontFamily:f}}>{p.author} · {p.steps} steps · {p.forked_by} forks</span></div>
          <div style={{display:"flex",gap:"4px",marginBottom:"8px",flexWrap:"wrap"}}>{p.tags.map(t=><span key={t} style={{fontSize:"9px",padding:"1px 6px",background:"#f4f2ec",border:"1px solid #e8e6de",borderRadius:"20px",color:"#888"}}>{t}</span>)}</div>
          <div style={{display:"flex",gap:"5px",justifyContent:"flex-end"}}>
            <Btn small>view</Btn>
            <Btn small primary={!fk} disabled={fk} onClick={()=>{if(!fk){setForked(prev=>[...prev,p.id]);flash(`forked "${p.title}" → your playbooks`);}}}>
              {fk?<>✓ forked</>:<>{Ic.fork} fork</>}
            </Btn>
          </div>
        </div>
      );})}
    </div>
  );
}

// ─── REPORTS VIEW ─────────────────────────────────────────────────────────────

function ReportsView(){
  const [gen,setGen]=useState({}),[loading,setLoading]=useState(null),[view,setView]=useState(null),[copied,setCopied]=useState(false);
  const generate=type=>{setLoading(type);setTimeout(()=>{setLoading(null);setGen(p=>({...p,[type]:true}));setView(type);},1200);};
  const DIGESTS={
    week:"3 score entries this week — solid delivery. 4 decisions logged, 3 with explicit reasoning. Entry count up 2 from last week.",
    month:"18 tickets closed across 3 projects. Decision quality improving — 11 of 14 with explicit reasoning. Velocity up 37% vs last month.",
    review:"## Q1 2026\n\nShipped 11 features, closed 47 tickets.\n\nAuth middleware refactor: -40% API latency, zero breaking changes.\nCI race condition fix: unblocked 4 engineers.\nMentored David through first production PR.\n\n12 documented decisions with reasoning and revisit triggers.\nRust async mental model unlocked via stdlib source.\n8 reusable AI prompting patterns documented.",
  };
  if(view)return(
    <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
      <button onClick={()=>setView(null)} style={{display:"flex",alignItems:"center",gap:"3px",fontSize:"10px",color:"#aaa",background:"none",border:"none",cursor:"pointer",fontFamily:f,marginBottom:"10px",padding:0}}>{Ic.back} reports</button>
      <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"10px"}}><span style={{fontSize:"9px",padding:"2px 6px",borderRadius:"20px",fontWeight:600,background:{week:"#EEEDFE",month:"#E1F5EE",review:"#FAEEDA"}[view],color:{week:"#3C3489",month:"#085041",review:"#633806"}[view]}}>{view}</span><span style={{fontSize:"9px",color:"#aaa",fontFamily:f}}>generated just now</span></div>
      <div style={{background:"#fff",border:"1px solid #e8e6de",borderRadius:"8px",padding:"12px",fontSize:"11px",color:"#555",fontFamily:f,lineHeight:"2",whiteSpace:"pre-wrap"}}>{DIGESTS[view]}</div>
      <button onClick={()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{marginTop:"8px",display:"flex",alignItems:"center",gap:"4px",fontSize:"9px",padding:"3px 9px",border:"1px solid #e8e6de",borderRadius:"6px",background:copied?"#E1F5EE":"transparent",color:copied?"#085041":"#888",cursor:"pointer",fontFamily:f}}>{copied?"✓ copied":"copy markdown"}</button>
    </div>
  );
  return(
    <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
      <div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"9px"}}>generate</div>
      {[{type:"week",label:"weekly digest",sub:"mar 11–17 · 19 entries"},{type:"month",label:"monthly summary",sub:"march 2026 · 89 entries"}].map(cfg=>(
        <div key={cfg.type} style={{border:"1px solid #e8e6de",borderRadius:"8px",padding:"11px",background:"#fff",marginBottom:"7px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontSize:"11px",fontWeight:600,color:"#1a1a18",fontFamily:f}}>{cfg.label}</div><div style={{fontSize:"9px",color:"#aaa",fontFamily:f,marginTop:"1px"}}>{cfg.sub}</div></div>
          {gen[cfg.type]?<Btn small onClick={()=>setView(cfg.type)}>{Ic.spark} view</Btn>:<Btn primary small onClick={()=>generate(cfg.type)} disabled={loading===cfg.type}>{Ic.spark}{loading===cfg.type?"generating...":"generate"}</Btn>}
        </div>
      ))}
      <div style={{border:"1px solid #534AB7",borderRadius:"8px",padding:"11px",background:"#fff",marginBottom:"13px"}}>
        <div style={{fontSize:"11px",fontWeight:600,color:"#1a1a18",fontFamily:f,marginBottom:"2px"}}>performance review</div>
        <div style={{fontSize:"9px",color:"#aaa",fontFamily:f,marginBottom:"9px"}}>AI-generated from your logs — customise range</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"8px"}}>
          {["from","to"].map(k=><div key={k}><div style={{fontSize:"8px",color:"#aaa",marginBottom:"3px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{k}</div><input type="date" defaultValue={k==="from"?"2026-01-01":"2026-03-17"} style={{width:"100%",fontSize:"9px",padding:"4px 6px",border:"1px solid #d3d1c7",borderRadius:"5px",background:"#fafal8",color:"#555",outline:"none",fontFamily:f,boxSizing:"border-box"}}/></div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"4px",marginBottom:"8px"}}>
          {["scores","decisions","solutions","reflections","ai","playbooks"].map(k=><div key={k} style={{display:"flex",alignItems:"center",gap:"4px",padding:"3px 5px",borderRadius:"5px",background:"#f4f2ec",cursor:"pointer"}}><div style={{width:"11px",height:"11px",border:"1px solid #534AB7",borderRadius:"2px",background:"#534AB7",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="7" height="7" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2"><path d="M2 5l3 3 3-4"/></svg></div><span style={{fontSize:"8px",color:"#1a1a18"}}>{k}</span></div>)}
        </div>
        {gen.review?<Btn small onClick={()=>setView("review")}>{Ic.spark} view report</Btn>:<Btn primary small onClick={()=>generate("review")} disabled={loading==="review"}>{Ic.spark}{loading==="review"?"generating...":"generate"}</Btn>}
      </div>
      <div style={{fontSize:"9px",color:"#aaa",fontFamily:f,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"8px"}}>past reports</div>
      {[{type:"week",label:"week of mar 11–17",n:19,preview:"Shipped auth refactor, pgvector migration."},{type:"month",label:"february 2026",n:67,preview:"12 tickets closed, 2 features shipped."}].map((d,i)=>(
        <div key={i} onClick={()=>setView(d.type)} style={{border:"1px solid #e8e6de",borderRadius:"7px",padding:"8px 10px",background:"#fff",marginBottom:"5px",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"8px",padding:"2px 5px",borderRadius:"20px",fontWeight:600,background:{week:"#EEEDFE",month:"#E1F5EE"}[d.type],color:{week:"#3C3489",month:"#085041"}[d.type]}}>{d.type}</span>
          <div style={{flex:1}}><div style={{fontSize:"10px",fontWeight:600,color:"#1a1a18",fontFamily:f}}>{d.label}</div><div style={{fontSize:"9px",color:"#aaa",fontFamily:f}}>{d.preview}</div></div>
          <span style={{fontSize:"9px",color:"#bbb",fontFamily:f}}>{d.n}</span>
        </div>
      ))}
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────

const NAV=[
  {id:"dashboard", icon:Ic.home,   label:"dashboard"},
  {id:"log",       icon:Ic.feed,   label:"log"},
  {id:"goals",     icon:Ic.target, label:"goals"},
  {id:"playbooks", icon:Ic.book,   label:"playbooks"},
  {id:"reports",   icon:Ic.report, label:"reports"},
];

export default function App(){
  const [view,setView]=useState("dashboard"),[drill,setDrill]=useState(null);
  const [entries,setEntries]=useState(ENTRIES_INIT);
  const addEntry=e=>setEntries(prev=>[e,...prev]);
  const delEntry=id=>setEntries(prev=>prev.filter(e=>e.id!==id));
  const navTo=v=>{setView(v);setDrill(null);};

  return(
    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:"13px",background:"#fafaf8",height:"780px",border:"1px solid #e8e6de",borderRadius:"16px",overflow:"hidden",display:"flex"}}>
      {/* sidebar */}
      <div style={{width:"52px",background:"#fff",borderRight:"1px solid #e8e6de",display:"flex",flexDirection:"column",alignItems:"center",padding:"14px 0",gap:"3px",flexShrink:0}}>
        <div style={{fontSize:"13px",fontWeight:700,color:"#534AB7",marginBottom:"14px",letterSpacing:"-0.5px"}}>dl</div>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>navTo(n.id)} title={n.label}
            style={{width:"36px",height:"36px",border:"none",borderRadius:"8px",background:view===n.id?"#EEEDFE":"transparent",color:view===n.id?"#534AB7":"#bbb",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
            {n.icon}
          </button>
        ))}
        <div style={{marginTop:"auto",width:"28px",height:"28px",borderRadius:"50%",background:"#EEEDFE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",fontWeight:700,color:"#534AB7"}}>JS</div>
      </div>

      {/* main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{height:"44px",borderBottom:"1px solid #e8e6de",background:"#fff",display:"flex",alignItems:"center",padding:"0 16px",justifyContent:"space-between",flexShrink:0}}>
          <span style={{fontSize:"12px",fontWeight:600,color:"#1a1a18"}}>{drill?`${drill} detail`:view}</span>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <span style={{fontSize:"10px",color:"#aaa",fontFamily:"monospace"}}>{entries.length} entries</span>
            {view==="log"&&<Btn primary small>+ entry</Btn>}
            {view==="goals"&&<Btn primary small>+ goal</Btn>}
          </div>
        </div>

        <div style={{flex:1,overflow:"hidden",display:"flex"}}>
          {view==="dashboard"&&(drill?<DrillView period={drill} onBack={()=>setDrill(null)}/>:<Dashboard onDrill={setDrill}/>)}
          {view==="log"&&<><LogView entries={entries} onAdd={addEntry} onDelete={delEntry}/><AiPanel/></>}
          {view==="goals"&&<GoalsView/>}
          {view==="playbooks"&&<PlaybooksView/>}
          {view==="reports"&&<ReportsView/>}
        </div>
      </div>
    </div>
  );
}
