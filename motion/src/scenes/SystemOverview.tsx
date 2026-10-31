import {AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

const palette = {blue: '#4f6bff', ink: '#192435', muted: '#6c7890', border: '#dce3f2', background: '#f7f9ff', card: '#eef2ff'} as const;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const progress = (f: number, start: number, length = 24) => {
  const p = interpolate(f, [start, start + length], [0, 1], clamp);
  return p * p * (3 - 2 * p);
};
const mix = (a: number, b: number, t: number) => a + (b-a)*t;
function Box({x,y,w,h,title,fill='white',accent=false}: {x:number;y:number;w:number;h:number;title:string;fill?:string;accent?:boolean}) {
  return <g><rect x={x} y={y} width={w} height={h} rx={22} fill={fill} stroke={accent?palette.blue:palette.border} strokeWidth={3}/>
    <text x={x+28} y={y+49} fontSize={29} fill={palette.ink}>{title}</text></g>;
}
export function SystemOverview({withAudio=false}: {withAudio?:boolean}) {
  const f=useCurrentFrame();
  const expand=progress(f,210,48), scatter=progress(f,552,55), ending=progress(f,747,30);
  const flowX=mix(330,140,scatter),flowY=mix(390,420,scatter),flowW=mix(1260,530,scatter);
  const title=f<210?'A Workflow describes the steps':f<353?'An Agent system is more than a Workflow':f<552?'More than the steps it runs':f<747?'Information across different pages':'Hard to see the whole system';
  const cards=[
    {id:'settings',title:'Settings',desc:'System configuration',x:190,toX:780,y:670,toY:390,start:353,width:480,toW:450},
    {id:'guardrails',title:'Guardrails',desc:'Rules and boundaries',x:720,toX:780,y:670,toY:590,start:392,width:480,toW:450},
    {id:'collaboration',title:'Agent collaboration',desc:'Ways to work together',x:1250,toX:1335,y:670,toY:490,start:435,width:480,toW:450},
  ];
  return <AbsoluteFill style={{backgroundColor:palette.background,fontFamily:theme.fontFamily}}>
    {withAudio&&<Audio src={staticFile('r012/narration.m4a')}/>}
    <svg width={1920} height={1080} style={{fontFamily:theme.fontFamily}}>
      <text x={100} y={76} fill={palette.blue} fontSize={22} letterSpacing={2}>ODYSSEY / SYSTEM DESIGN</text>
      <text x={100} y={153} fill={palette.ink} fontSize={49} fontWeight={600}>{title}</text>
      <g opacity={expand*(1-scatter)}><Box x={120} y={280} w={1680} h={620} title="AGENT SYSTEM" accent/></g>
      <g opacity={scatter}>
        <Box x={110} y={320} w={590} h={510} title="PAGE A"/>
        <Box x={750} y={280} w={510} h={540} title="PAGE B"/>
        <Box x={1310} y={360} w={500} h={510} title="PAGE C"/>
      </g>
      <Box x={flowX} y={flowY} w={flowW} h={270} title="WORKFLOW"/>
      {[0,1,2].map(i=>{
        const step=(flowW-120)/3,x=flowX+40+i*step,y=flowY+105;
        const reveal=progress(f,20+i*28);
        return <g key={`step-${i}`} opacity={reveal} transform={`translate(0 ${12*(1-reveal)})`}>
          <rect x={x} y={y} width={step-45} height={105} rx={18} fill={palette.card} stroke={palette.blue} strokeWidth={3}/>
          <text x={x+12} y={y+62} fontSize={mix(29,18,scatter)} fill={palette.ink}>Step {i+1}</text>
          {i<2&&<g opacity={progress(f,100+i*22)}><line x1={x+step-38} y1={y+53} x2={x+step-10} y2={y+53} stroke={palette.blue} strokeWidth={3}/>
            <path d={`M ${x+step-10} ${y+53} l -10 -7 v 14 z`} fill={palette.blue}/></g>}
        </g>;
      })}
      {cards.map(c=>{
        const p=progress(f,c.start),x=mix(c.x,c.toX,scatter),y=mix(c.y,c.toY,scatter),w=mix(c.width,c.toW,scatter);
        return <g key={c.id} opacity={p} transform={`translate(0 ${18*(1-p)})`}>
          <Box x={x} y={y} w={w} h={180} title={c.title} fill={palette.card}/>
          <text x={x+28} y={y+127} fontSize={23} fill={palette.muted}>{c.desc}</text>
        </g>;
      })}
      <text x={960} y={930} textAnchor="middle" fontSize={32} fill={palette.blue} opacity={ending}>One system. Several disconnected views.</text>
    </svg>
  </AbsoluteFill>;
}
