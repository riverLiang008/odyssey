import {AbsoluteFill, Audio, Composition, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {theme, video} from '../theme';
const c={blue:'#4f6bff',ink:'#192435',muted:'#75819a',line:'#dce3f2',bg:'#f7f9ff'} as const;
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const ramp=(f:number,start:number,duration=24)=>interpolate(f,[start,start+duration],[0,1],clamp);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function Exploration({withAudio=false}:{withAudio?:boolean}){
 const f=useCurrentFrame(),change=ramp(f,28,32),examples=ramp(f,95,24),direction=ramp(f,152,45);
 const scale=mix(1,.8,direction),x=mix(520,130,examples),y=mix(345,385,direction);
 return <AbsoluteFill style={{backgroundColor:c.bg,fontFamily:theme.fontFamily}}>
  {withAudio&&<Audio src={staticFile('edit002/narration.m4a')}/>}
  <svg width={1920} height={1080} style={{fontFamily:theme.fontFamily}}>
   <defs><pattern id="exploration-dots" width={32} height={32} patternUnits="userSpaceOnUse"><circle cx={2} cy={2} r={1.2} fill={c.line}/></pattern></defs>
   <text x={100} y={80} fill={c.blue} fontSize={22} letterSpacing={2}>ODYSSEY / AN ONGOING JOURNEY</text>
   <text x={100} y={166} fill={c.ink} fontSize={48}>There is more to explore.</text>
   <g opacity={ramp(f,0,18)} transform={`translate(${x},${y}) scale(${scale})`}>
    <rect width={850} height={450} rx={24} fill="white" stroke={c.line} strokeWidth={3}/>
    <text x={35} y={55} fill={c.blue} fontSize={23}>ODYSSEY / DESIGN CANVAS</text>
    <rect x={20} y={85} width={810} height={340} rx={14} fill="url(#exploration-dots)"/>
    <path d={`M240 245 L${mix(360,390,change)} ${mix(245,180,change)} L650 245`} stroke={c.blue} strokeWidth={3} fill="none"/>
    {[{x:70,y:195,label:'Agent'},{x:mix(340,370,change),y:mix(195,130,change),label:'Tools'},{x:610,y:195,label:'Knowledge'}].map(n=><g key={n.label}><rect x={n.x} y={n.y} width={170} height={100} rx={14} fill="#eef1ff" stroke={c.blue} strokeWidth={2}/><text x={n.x+85} y={n.y+58} textAnchor="middle" fill={c.ink} fontSize={23}>{n.label}</text></g>)}
    <text x={35} y={395} fill={c.muted} fontSize={21}>Keep changing the design</text>
   </g>
   <g opacity={examples} transform={`translate(${mix(1050,890,direction)},${mix(320,350,direction)}) scale(${mix(1,.88,direction)})`}>
    {[0,1].map(i=><g key={i} transform={`translate(0,${i*235+(1-examples)*35})`}>
     <rect width={375} height={195} rx={20} fill="white" stroke={c.line} strokeWidth={3}/>
     {i===0?<g fill="none" stroke={c.blue} strokeWidth={3}><rect x={30} y={30} width={46} height={60} rx={5}/><path d="M40 47 H65 M40 60 H65 M40 73 H58"/></g>:<path d="M30 35 H88 V77 H55 L37 92 V77 H30 Z" fill="#eef1ff" stroke={c.blue} strokeWidth={3}/>}
     <text x={30} y={140} fill={c.ink} fontSize={27}>{i===0?'Document curation':'Knowledge Q&A'}</text>
     <text x={30} y={175} fill={c.muted} fontSize={19}>An example to explore</text>
    </g>)}
   </g>
   <path d="M1170 755 C1400 900 1340 410 1525 470" fill="none" stroke={c.blue} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1-direction} opacity={direction}/>
   <g opacity={ramp(f,176,28)}>
    <path d="M1540 410 V365 Q1540 345 1560 345 H1760 Q1780 345 1780 365 V570 Q1780 590 1760 590 H1560 Q1540 590 1540 570 V520" fill="none" stroke={c.blue} strokeWidth={3} strokeDasharray="12 10"/>
    <text x={1660} y={477} textAnchor="middle" fill={c.blue} fontSize={56}>…</text>
    <text x={1660} y={650} textAnchor="middle" fill={c.ink} fontSize={27}>A different direction</text>
   </g>
  </svg>
 </AbsoluteFill>;
}
export function Edit002(){return <>
 <Composition id="Edit002" component={Exploration} defaultProps={{withAudio:false}} durationInFrames={252} {...video}/>
 <Composition id="Edit002Review" component={Exploration} defaultProps={{withAudio:true}} durationInFrames={252} {...video}/>
</>;}
