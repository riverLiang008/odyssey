import {AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
const palette={blue:'#4f6bff',ink:'#192435',muted:'#6c7890',border:'#dce3f2',background:'#f7f9ff'} as const;
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const progress=(f:number,start:number,length=24)=>interpolate(f,[start,start+length],[0,1],clamp);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function Box({x,y,w,h,title,accent=true}:{x:number;y:number;w:number;h:number;title:string;accent?:boolean}){
  return <g><rect x={x} y={y} width={w} height={h} rx={20} fill="white" stroke={accent?palette.blue:palette.border} strokeWidth={3}/>
    <text x={x+28} y={y+54} fontSize={32} fill={palette.ink}>{title}</text></g>;
}
export function LlmAsTool({withAudio=false}:{withAudio?:boolean}){
  const f=useCurrentFrame(),nest=progress(f,240,30),panel=progress(f,330,28),mapping=progress(f,438,18);
  const title=f<240?'Not always a top-level Node':f<330?'One model call, inside another node':f<438?'An LLM call can be a Tool':'Configure the call and its output mapping';
  const x=mix(500,130,panel),y=mix(345,360,panel),w=mix(920,950,panel);
  const focusY=mapping>.5?479:150,focusHeight=mapping>.5?60:314;
  return <AbsoluteFill style={{backgroundColor:palette.background,fontFamily:theme.fontFamily}}>
    {withAudio&&<Audio src={staticFile('fig002/narration.m4a')}/>}
    <svg width={1920} height={1080} style={{fontFamily:theme.fontFamily}}>
      <text x={100} y={76} fill={palette.blue} fontSize={22} letterSpacing={2}>ODYSSEY / LLM AS A TOOL</text>
      <text x={100} y={158} fill={palette.ink} fontSize={48} fontWeight={600}>{title}</text>
      <g opacity={1-nest}>
        <path d="M580 530 H750 M1150 530 H1320" stroke={palette.blue} strokeWidth={3} fill="none"/>
        <Box x={180} y={440} w={400} h={180} title="Node" accent={false}/>
        <Box x={1320} y={440} w={400} h={180} title="Node" accent={false}/>
        <text x={960} y={770} textAnchor="middle" fontSize={31} fill={palette.muted}>An independent LLM Node is one option.</text>
      </g>
      <g opacity={nest}>
        <Box x={x} y={y} w={w} h={390} title="TASK / NODE"/>
        <text x={x+35} y={y+125} fontSize={25} fill={palette.muted}>A predefined operation</text>
      </g>
      <Box x={mix(750,x+55,nest)} y={mix(440,y+160,nest)} w={mix(400,w-110,nest)} h={mix(180,140,nest)} title={nest>.5?'LLM Call · Tool':'LLM'}/>
      <text x={x+85} y={y+270} fontSize={26} fill={palette.blue} opacity={nest}>One model call</text>
    </svg>
    {panel>0&&<div style={{position:'absolute',left:1320,top:245,width:442,height:644,overflow:'hidden',opacity:panel,borderRadius:12}}>
      <Img src={staticFile('fig002/llm-call.svg')} style={{position:'absolute',left:0,top:0,width:442,height:716*442/384,maxWidth:'none'}}/>
      <svg width={442} height={644} style={{position:'absolute',inset:0}} viewBox="0 0 384 560">
        <defs><mask id="fig002-focus"><rect width={384} height={560} fill="white"/><rect x={14} y={focusY} width={356} height={focusHeight} rx={7} fill="black"/></mask></defs>
        <rect width={384} height={560} fill="#26334d" opacity={.22} mask="url(#fig002-focus)"/>
        <rect x={14} y={focusY} width={356} height={focusHeight} rx={7} fill="none" stroke={palette.blue} strokeWidth={2.5}/>
      </svg>
    </div>}
  </AbsoluteFill>;
}
