import {AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

type Point=readonly [number,number];
type Pattern='linear'|'solo'|'hub'|'circle';
const palette={blue:'#4f6bff',ink:'#192435',muted:'#6c7890',border:'#dce3f2',background:'#f7f9ff'} as const;
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const phase=(f:number,start:number,length=24)=>interpolate(f,[start,start+length],[0,1],clamp);
function Link({a,b,both=false}:{a:Point;b:Point;both?:boolean}){
  const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
  const x=b[0]-17*Math.cos(angle),y=b[1]-17*Math.sin(angle);
  const sx=a[0]+17*Math.cos(angle),sy=a[1]+17*Math.sin(angle);
  return <g stroke={palette.blue} strokeWidth={3} fill={palette.blue}>
    <line x1={sx} y1={sy} x2={x} y2={y}/>
    <path d={`M${x} ${y} L${x-12*Math.cos(angle-.5)} ${y-12*Math.sin(angle-.5)} L${x-12*Math.cos(angle+.5)} ${y-12*Math.sin(angle+.5)} Z`} stroke="none"/>
    {both&&<path d={`M${sx} ${sy} L${sx+12*Math.cos(angle-.5)} ${sy+12*Math.sin(angle-.5)} L${sx+12*Math.cos(angle+.5)} ${sy+12*Math.sin(angle+.5)} Z`} stroke="none"/>}
  </g>;
}
function PatternGlyph({kind}:{kind:Pattern}){
  let points:readonly Point[];let links:readonly (readonly [number,number])[];
  switch(kind){
    case 'linear':points=[[-110,0],[0,0],[110,0]];links=[[0,1],[1,2]];break;
    case 'solo':points=[[0,0]];links=[];break;
    case 'hub':points=[[0,0],[-95,0],[95,0],[0,-65],[0,65]];links=[[0,1],[0,2],[0,3],[0,4]];break;
    case 'circle':points=[[0,-60],[95,0],[0,60],[-95,0]];links=[[0,1],[1,2],[2,3],[3,0]];break;
  }
  return <g>{links.map(([a,b])=>{
    const from=points[a],to=points[b];
    if(!from||!to)throw new Error('Invalid Pattern illustration edge');
    return <Link key={`${a}-${b}`} a={from} b={to} both={kind==='hub'}/>;
  })}{points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={14} stroke={palette.blue} strokeWidth={4} fill={kind==='hub'&&i===0?palette.blue:'white'}/>)}</g>;
}
const freePoints:readonly Point[]=[[450,450],[850,350],[1300,430],[1500,650],[1000,780],[500,730],[950,540]];
const freeLinks:readonly (readonly [number,number])[]=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,6],[6,2],[6,4]];
const options:readonly {id:Pattern;label:string;highlight:number}[]=[
  {id:'linear',label:'Linear',highlight:425},
  {id:'solo',label:'Solo',highlight:455},
  {id:'hub',label:'Hub and Spoke',highlight:485},
  {id:'circle',label:'Circle',highlight:525},
];
export function PatternSimplification({withAudio=false}:{withAudio?:boolean}){
  const f=useCurrentFrame(),gather=phase(f,127,165),templates=phase(f,250,48),ui=phase(f,554,30);
  const title=f<127?'A simpler starting point':f<425?'Ready-made Patterns':f<554?'Choose a structure, then configure':'Less setup. Clearer choices.';
  return <AbsoluteFill style={{backgroundColor:palette.background,fontFamily:theme.fontFamily}}>
    {withAudio&&<Audio src={staticFile('m9/narration.m4a')}/>}
    <svg width={1920} height={1080} style={{fontFamily:theme.fontFamily}}>
      <text x={100} y={76} fill={palette.blue} fontSize={22} letterSpacing={2}>ODYSSEY / PATTERN DESIGN</text>
      <text x={100} y={158} fill={palette.ink} fontSize={48} fontWeight={600}>{title}</text>
      <g opacity={1-templates} transform={`translate(${960*gather*.3} ${540*gather*.3}) scale(${1-.3*gather})`}>
        {freeLinks.map(([a,b],i)=>{
          const from=freePoints[a],to=freePoints[b];if(!from||!to)throw new Error('Invalid free topology edge');
          return <g key={`${a}-${b}`} opacity={i>5?1-gather:1}><Link a={from} b={to}/></g>;
        })}
        {freePoints.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={14} fill="white" stroke={palette.blue} strokeWidth={4}/>)}
      </g>
      <g opacity={templates*(1-ui)}>
        {options.map((o,i)=>{
          const x=150+(i%2)*850,y=285+Math.floor(i/2)*285;
          const next=options[i+1]?.highlight??554;
          const active=f<425?1:phase(f,o.highlight,8)*(1-phase(f,next,8));
          return <g key={o.id} transform={`translate(${x} ${y+18*(1-templates)})`}>
            <rect width={770} height={240} rx={22} fill="white" stroke={palette.border} strokeWidth={2}/>
            <rect width={770} height={240} rx={22} fill="none" stroke={palette.blue} strokeWidth={3} opacity={active}/>
            <text x={30} y={58} fontSize={32} fill={palette.ink}>{o.label}</text>
            <g transform="translate(390 143)"><PatternGlyph kind={o.id}/></g>
          </g>;
        })}
      </g>
    </svg>
    {ui>0&&<div style={{position:'absolute',left:180,top:270,width:1560,height:610,overflow:'hidden',borderRadius:14,opacity:ui}}>
      <Img src={staticFile('m9/create-modal.svg')} style={{position:'absolute',maxWidth:'none',left:-660,top:-860,width:2880,height:1920}}/>
    </div>}
  </AbsoluteFill>;
}
