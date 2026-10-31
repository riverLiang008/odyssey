import {AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

const c={blue:'#4f6bff',ink:'#192435',muted:'#6c7890',line:'#dce3f2',bg:'#f7f9ff',soft:'#eef1ff'} as const;
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const ramp=(f:number,start:number,length=24)=>interpolate(f,[start,start+length],[0,1],clamp);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function Text({x,y,children,size=26,color=c.ink}:{x:number;y:number;children:React.ReactNode;size?:number;color?:string}){
  return <text x={x} y={y} fontSize={size} fill={color}>{children}</text>;
}
function Panel({x,y,w,h,active=false,soft=false}:{x:number;y:number;w:number;h:number;active?:boolean;soft?:boolean}){
  return <rect x={x} y={y} width={w} height={h} rx={18} fill={soft?c.soft:'white'} stroke={active?c.blue:c.line} strokeWidth={3}/>;
}
function Node({x,y,label,active=false}:{x:number;y:number;label:string;active?:boolean}){
  return <g><Panel x={x} y={y} w={260} h={115} active={active} soft={active}/><Text x={x+24} y={y+68} size={25} color={active?c.blue:c.ink}>{label}</Text></g>;
}
function Graph({x,y,w,h,focus=false}:{x:number;y:number;w:number;h:number;focus?:boolean}){
  const points=[[.5,.48],[.2,.18],[.83,.22],[.23,.81],[.8,.82]] as const;
  const labels=['Metadata','Playbook','Relationships','Review policy','Source records'];
  return <g>{points.slice(1).map((p,i)=><line key={i} x1={x+w*.5} y1={y+h*.48} x2={x+w*p[0]} y2={y+h*p[1]} stroke={focus?c.blue:'#a9b6e6'} strokeWidth={3}/>)}
    {points.map((p,i)=><g key={labels[i]}><circle cx={x+w*p[0]} cy={y+h*p[1]} r={i===0?23:15} fill={i===0?c.blue:'#dce3ff'} stroke={c.blue}/><Text x={x+w*p[0]-65} y={y+h*p[1]+50} size={19} color={i===0?c.blue:c.muted}>{labels[i]}</Text></g>)}</g>;
}
function Workflow({f}:{f:number}){
  const levels=ramp(f,365),settings=ramp(f,455),selected=f>=455;
  const xs=[mix(310,160,settings),mix(830,500,settings),mix(1350,840,settings)],y=mix(560,575,settings);
  return <g><Panel x={100} y={280} w={1720} h={620}/><Text x={130} y={337} size={27} color={c.blue}>Workflow</Text>
    <g opacity={levels}><Text x={130} y={395}>Workflow  /  Review group  /  Check metadata</Text><line x1={125} y1={420} x2={1795} y2={420} stroke={c.line} strokeWidth={2}/></g>
    {xs.slice(0,2).map((x,i)=><path key={i} d={`M${x+260} ${y+58} H${xs[i+1]}`} stroke={c.blue} strokeWidth={4} markerEnd="url(#context-arrow)"/>)}
    {xs.map((x,i)=><Node key={i} x={x} y={y} label={['Collect documents','Check metadata','Review changes'][i]??''} active={selected&&i===1}/>)}
    <g opacity={settings} transform={`translate(${(1-settings)*45},0)`}><Panel x={1200} y={450} w={585} h={410}/><Text x={1230} y={500} size={22} color={c.blue}>NODE SETTINGS</Text><Text x={1230} y={560} size={32}>Check metadata</Text>
      <Text x={1230} y={620} size={21} color={c.muted}>Node type</Text><Panel x={1230} y={632} w={520} h={51}/><Text x={1245} y={667} size={23}>Task</Text>
      <Text x={1230} y={720} size={21} color={c.muted}>Input</Text><Panel x={1230} y={732} w={520} h={51}/><Text x={1245} y={767} size={23}>Selected documents</Text>
    </g><g opacity={ramp(f,550)}><Text x={170} y={820} size={23} color={c.blue}>SELECTED NODE</Text></g></g>;
}
function Knowledge({f}:{f:number}){
  const list=ramp(f,845,30),read=ramp(f,945,30),focus=f>=1105;
  const shrink=list;
  return <g><Panel x={100} y={280} w={1720} h={620}/><Text x={130} y={337} size={27} color={c.blue}>Knowledge Space</Text>
    <g opacity={list} transform={`translate(${(1-list)*-40},0)`}><Panel x={125} y={385} w={440} h={480}/><Text x={150} y={440} size={22} color={c.blue}>DOCUMENTS</Text><Text x={150} y={494} size={24}>Document Curator Playbook</Text>
      {['metadata-guidelines.md','relationship-guidelines.md','review-and-change-policy.md'].map((label,i)=><g key={label}>{i===0&&<Panel x={142} y={522} w={403} h={63} active soft/>}<Text x={155} y={568+i*90} size={21} color={i===0?c.blue:c.muted}>{label}</Text></g>)}
    </g>
    <g opacity={read} transform={`translate(0,${(1-read)*24})`}><Panel x={590} y={385} w={630} h={480}/><Text x={620} y={440} size={22} color={c.blue}>DOCUMENT CONTENT</Text><Text x={620} y={505} size={30}>metadata-guidelines.md</Text><Text x={620} y={572} size={27}>Metadata guidelines</Text><Text x={620} y={630} size={23} color={c.muted}>Each document includes:</Text>
      {['• Title and owner','• Status and review date','• Links to source evidence'].map((label,i)=><Text key={label} x={630} y={680+i*45} size={23}>{label}</Text>)}<Text x={620} y={842} size={18} color={c.muted}>Illustrative document content</Text>
    </g>
    <g opacity={shrink}><Panel x={1245} y={385} w={550} h={480} active={focus}/><Text x={1270} y={440} size={22} color={c.blue}>KNOWLEDGE CONTEXT</Text></g>
    <Graph x={mix(430,1290,shrink)} y={mix(390,495,shrink)} w={mix(1050,430,shrink)} h={mix(390,245,shrink)} focus={focus}/>
    <g opacity={ramp(f,1105)}><Text x={1280} y={842} size={22} color={c.blue}>Same selected document</Text></g>
  </g>;
}
export function InterfaceContext({withAudio=false}:{withAudio?:boolean}){
  const f=useCurrentFrame(),intro=1-ramp(f,150,17),wf=ramp(f,150,17)*(1-ramp(f,641,20)),ks=ramp(f,641,20);
  const title=f<167?'Similar questions, across the interface':f<365?'More than a Canvas':f<641?'Know what you are editing':f<845?'More than a graph':f<1105?'Manage documents. Read their content.':'One document, in context';
  return <AbsoluteFill style={{backgroundColor:c.bg,fontFamily:theme.fontFamily}}>{withAudio&&<Audio src={staticFile('fig007008/narration.m4a')}/>}
    <svg width={1920} height={1080} style={{fontFamily:theme.fontFamily}}><defs><marker id="context-arrow" viewBox="0 0 10 10" refX={10} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill={c.blue}/></marker></defs>
      <Text x={90} y={76} size={22} color={c.blue}>ODYSSEY / INTERFACE DESIGN</Text><Text x={90} y={158} size={46}>{title}</Text>
      <g opacity={intro}>{[200,1010].map((x,i)=><g key={x}><Panel x={x} y={360} w={710} h={470}/><Text x={x+40} y={450} size={40} color={c.blue}>{i===0?'Workflow':'Knowledge Space'}</Text><Text x={x+40} y={520} size={25} color={c.muted}>{i===0?'Steps · Levels · Settings':'Documents · Content · Context'}</Text></g>)}<Node x={280} y={610} label="Node"/><Node x={590} y={610} label="Settings" active/><Graph x={1100} y={550} w={480} h={170}/></g>
      <g opacity={wf}><Workflow f={f}/></g><g opacity={ks}><Knowledge f={f}/></g>
    </svg></AbsoluteFill>;
}
