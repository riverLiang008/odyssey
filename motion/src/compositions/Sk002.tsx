import {AbsoluteFill, Composition, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {theme, video} from '../theme';

const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const items=[
  {label:'Model',start:36,x:450,y:380,w:330,h:65},
  {label:'Goal',start:62,x:785,y:380,w:125,h:65},
  {label:'Knowledge Space',start:88,x:450,y:448,w:460,h:106},
  {label:'ToolBox',start:114,x:450,y:558,w:460,h:106},
] as const;
function SketchAgent(){
  const f=useCurrentFrame();
  const zoom=interpolate(f,[24,44],[0,1],clamp),scale=.84+.76*zoom;
  const opacity=interpolate(f,[0,15],[0,1],clamp);
  return <AbsoluteFill style={{backgroundColor:'#f7f9ff',fontFamily:theme.fontFamily}}>
    <div style={{position:'absolute',left:90,top:55,color:'#4f6bff',fontSize:22,letterSpacing:2}}>ODYSSEY / EARLY DESIGN</div>
    <div style={{position:'absolute',left:90,top:110,color:'#192435',fontSize:48,fontWeight:600}}>What does an Agent Node need?</div>
    <div style={{position:'absolute',left:90,top:240,width:1740,height:660,overflow:'hidden',borderRadius:18,background:'white',opacity,clipPath:`inset(0 ${640*zoom}px 0 0 round 18px)`}}>
      <div style={{position:'absolute',left:0,top:0,width:2048,height:765,transformOrigin:'0 0',transform:`translate(${-350*zoom}px,${-490*zoom}px) scale(${scale})`}}>
        <Img src={staticFile('sk002/sketch.png')} style={{width:2048,height:765}}/>
        <svg width={2048} height={765} style={{position:'absolute',inset:0}}>
          {items.map(item=><rect key={item.label} x={item.x} y={item.y} width={item.w} height={item.h} rx={7} fill="#4f6bff" fillOpacity={.06} stroke="#4f6bff" strokeWidth={2} opacity={interpolate(f,[item.start,item.start+8],[0,1],clamp)}/>)}
        </svg>
      </div>
    </div>
    {items.map((item,i)=>{
      const enter=interpolate(f,[item.start,item.start+10],[0,1],clamp);
      return <div key={item.label} style={{position:'absolute',left:1280+(1-enter)*30,top:275+i*140,width:500,height:112,boxSizing:'border-box',border:'2px solid #4f6bff',borderRadius:16,backgroundColor:'white',opacity:enter,display:'flex',alignItems:'center',gap:24,paddingLeft:28,color:'#192435',fontSize:34}}><span style={{fontSize:20,color:'#4f6bff'}}>0{i+1}</span>{item.label}</div>;
    })}
    <div style={{position:'absolute',left:90,top:940,color:'#6c7890',fontSize:22,opacity:zoom}}>Agent Node / Early Design</div>
  </AbsoluteFill>;
}
export function Sk002(){return <Composition id="Sk002" component={SketchAgent} durationInFrames={180} {...video}/>;}
