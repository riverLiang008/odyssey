import {AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

type Rect = readonly [number, number, number, number];
type Shot = Readonly<{start: number; end: number; title: string; note: string}>;
const shots: readonly Shot[] = [
  {start: 0, end: 198, title: 'How do we search for knowledge?', note: 'Documents and their relationships'},
  {start: 198, end: 382, title: 'Find useful information', note: 'Knowledge Retrieval'},
  {start: 382, end: 643, title: 'See the wider context', note: 'Beyond an isolated piece of text'},
  {start: 643, end: 1019, title: 'Follow the links between documents', note: 'Design exploration'},
  {start: 1019, end: 1237, title: 'RAG can still be a Tool', note: 'Knowledge Retrieval in the Agent Toolbox'},
  {start: 1237, end: 1401, title: 'Retrieval + Graph Navigation', note: 'Complementary ways to access knowledge · Design exploration'},
];
const blue = '#4f6bff';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
function Screenshot({name, crop, dest, focus = [], strength = 1}: {
  name: string; crop: Rect; dest: Rect; focus?: readonly Rect[]; strength?: number;
}) {
  const [x, y, w, h] = dest;
  const [cx, cy, cw, ch] = crop;
  const scale = Math.min(w / cw, h / ch);
  const width = cw * scale, height = ch * scale;
  const dims: readonly [number, number] = name === '04' ? [1688, 965] : [2560, name === '02' ? 1348 : 1349];
  return <div style={{position: 'absolute', left: x + (w - width) / 2, top: y + (h - height) / 2,
    width, height, overflow: 'hidden', borderRadius: 12, boxShadow: '0 12px 40px #22335512'}}>
    <Img src={staticFile(`m6/${name}.png`)} style={{position: 'absolute', maxWidth: 'none',
      width: dims[0] * scale, height: dims[1] * scale, left: -cx * scale, top: -cy * scale}}/>
    {focus.length > 0 && <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
      <defs><mask id={`focus-${name}-${x}`}><rect width={width} height={height} fill="white"/>
        {focus.map(([fx, fy, fw, fh]) => <rect key={`${fx}-${fy}`} x={(fx-cx)*scale} y={(fy-cy)*scale}
          width={fw*scale} height={fh*scale} rx={10} fill="black"/>)}</mask></defs>
      <rect width={width} height={height} fill="#26334d" opacity={.25*strength} mask={`url(#focus-${name}-${x})`}/>
      {focus.map(([fx, fy, fw, fh]) => <rect key={`${fx}-${fy}`} x={(fx-cx)*scale} y={(fy-cy)*scale}
        width={fw*scale} height={fh*scale} rx={10} fill="none" stroke={blue} strokeWidth={3} opacity={strength}/>)}</svg>}
  </div>;
}
export function KnowledgeAccess({withAudio = false}: {withAudio?: boolean}) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{backgroundColor: '#f7f9ff', fontFamily: theme.fontFamily, color: '#17202a'}}>
    {withAudio && <Audio src={staticFile('m6/narration.m4a')}/>}
    {shots.map((shot, i) => {
      if (frame < shot.start || frame >= shot.end) return null;
      const f = frame - shot.start;
      const fade = interpolate(f, [0, 12], [0, 1], clamp);
      const graphCrop: Rect = [950, 580, 1440, 580];
      return <AbsoluteFill key={shot.start} style={{opacity: fade}}>
        <div style={{position: 'absolute', left: 100, top: 54, fontSize: 21, color: blue, letterSpacing: 2}}>ODYSSEY / KNOWLEDGE ACCESS</div>
        <div style={{position: 'absolute', left: 100, top: 108, fontSize: 49, fontWeight: 600}}>{shot.title}</div>
        <div style={{position: 'absolute', left: 100, top: 179, fontSize: 25, color: '#69758b'}}>{shot.note}</div>
        {i === 0 && <div style={{position: 'absolute', inset: 0, transform: `translateY(${interpolate(f,[0,198],[8,0],clamp)}px)`}}>
          <Screenshot name="03" crop={[360,360,2090,945]} dest={[100,250,1720,640]}/></div>}
        {i === 1 && <Screenshot name="01" crop={[1900,850,600,220]} dest={[280,320,1360,480]} focus={[[1940,915,510,110]]}/>}
        {i === 2 && <Screenshot name="03" crop={graphCrop} dest={[100,260,1720,620]}
          focus={[[995,770,345,210]]} strength={interpolate(f,[80,210],[1,0],clamp)}/>}
        {i === 3 && <>
          <Screenshot name="04" crop={[80,370,1020,420]} dest={[90,320,1040,500]}
            focus={f < 110 ? [[140,515,235,150]] : [[140,515,235,150],[495,620,235,145]]}/>
          <Screenshot name="04" crop={[1135,280,475,635]} dest={[1190,245,620,650]}
            focus={f >= 70 ? [[1150,820,450,90]] : []}/></>}
        {i === 4 && <>
          <Screenshot name="02" crop={[875,225,675,590]} dest={[130,250,920,640]} focus={[[930,655,570,120]]}/>
          <Screenshot name="02" crop={[1920,190,580,1070]} dest={[1090,245,700,650]}/></>}
        {i === 5 && <>
          <div style={{position:'absolute',left:140,top:290,fontSize:24,color:blue}}>RETRIEVAL / TOOLBOX</div>
          <div style={{position:'absolute',left:1050,top:290,fontSize:24,color:blue}}>DOCUMENT RELATIONSHIPS</div>
          <Screenshot name="02" crop={[900,520,605,260]} dest={[120,370,760,440]}/>
          <div style={{position:'absolute',left:935,top:535,fontSize:54,color:blue}}>+</div>
          <Screenshot name="04" crop={[100,380,990,420]} dest={[1030,370,770,440]}/></>}
      </AbsoluteFill>;
    })}
  </AbsoluteFill>;
}
