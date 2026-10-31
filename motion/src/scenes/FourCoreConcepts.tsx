import {AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

type ConceptId='patterns'|'workflows'|'knowledge'|'tools';
const palette={blue:'#4f6bff',ink:'#192435',muted:'#6c7890',border:'#dce3f2',background:'#f7f9ff'} as const;
const concepts:readonly {id:ConceptId;title:string;description:string;start:number}[]=[
  {id:'patterns',title:'Patterns',description:'How Agents work together',start:0},
  {id:'workflows',title:'Workflows',description:'Steps and logic',start:105},
  {id:'knowledge',title:'Knowledge Space',description:'Knowledge resources',start:210},
  {id:'tools',title:'ToolBox',description:'Actions Agents can take',start:345},
];
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
function ConceptIcon({id,color}:{id:ConceptId;color:string}) {
  const style={stroke:color,strokeWidth:4,fill:'white'};
  switch(id){
    case 'patterns':return <g {...style}><path d="M60 45 L145 20 M60 45 L145 80" fill="none"/>{[[60,45],[145,20],[145,80]].map(([x,y])=><circle key={`${x}-${y}`} cx={x} cy={y} r={13}/>)}</g>;
    case 'workflows':return <g {...style}><path d="M70 50 H95 M140 50 H165"/>{[25,95,165].map(x=><rect key={x} x={x} y={27} width={45} height={46} rx={9}/>)}</g>;
    case 'knowledge':return <g {...style}><path d="M80 53 L140 35 M80 60 L130 95"/>{[[40,30],[140,10],[130,75]].map(([x,y])=><rect key={`${x}-${y}`} x={x} y={y} width={40} height={45} rx={5}/>)}</g>;
    case 'tools':return <g {...style}><rect x={80} y={3} width={55} height={26} rx={6}/><rect x={28} y={24} width={162} height={80} rx={10}/>{[60,105,150].map(x=><path key={x} d={`M${x} 49 V78`}/>)}</g>;
  }
}
export function FourCoreConcepts({withAudio=false}:{withAudio?:boolean}) {
  const f=useCurrentFrame();
  return <AbsoluteFill style={{backgroundColor:palette.background,fontFamily:theme.fontFamily}}>
    {withAudio&&<Audio src={staticFile('m7/narration.m4a')}/>}
    <svg width={1920} height={1080} style={{fontFamily:theme.fontFamily}}>
      <text x={100} y={76} fill={palette.blue} fontSize={22} letterSpacing={2}>ODYSSEY / FOUR CORE CONCEPTS</text>
      <text x={100} y={158} fill={palette.ink} fontSize={48} fontWeight={600}>Four ideas. Clearer responsibilities.</text>
      {concepts.map((c,i)=>{
        const next=concepts[i+1]?.start??480;
        const enter=interpolate(f,[c.start,c.start+14],[0,1],clamp);
        const exit=interpolate(f,[next,next+14],[0,1],clamp);
        const all=interpolate(f,[480,496],[0,1],clamp);
        const active=(f>=c.start?enter*(1-exit):0)*(1-all)+all;
        const x=130+(i%2)*850,y=285+Math.floor(i/2)*285;
        const color=active>.5?palette.blue:'#9ba9c4';
        return <g key={c.id} transform={`translate(${x} ${y})`}>
          <rect width={810} height={245} rx={22} fill="white" stroke={palette.border} strokeWidth={2}/>
          <rect width={810} height={245} rx={22} fill="none" stroke={palette.blue} strokeWidth={4} opacity={active}/>
          <g transform={`translate(25 ${72-4*active})`}><ConceptIcon id={c.id} color={color}/></g>
          <text x={260} y={106} fill={palette.ink} opacity={.65+.35*active} fontSize={37} fontWeight={500}>{c.title}</text>
          <text x={260} y={167} fill={color} fontSize={27}>{c.description}</text>
        </g>;
      })}
    </svg>
  </AbsoluteFill>;
}
