import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {MotionLabel} from '../components/MotionLabel';
import {MotionArrow} from '../components/MotionArrow';
import {reveal} from '../components/timing';
import {theme} from '../theme';
import {motion005} from './motion005Config';

const c = theme.colors;
const t = motion005.timing;
function DocumentIcon({x, y}: {x: number; y: number}) {
  return <g stroke={c.primary} strokeWidth={2} fill={c.surface}>
    <path d={`M${x} ${y} h22 l12 12 v34 h-34 Z`}/>
    <path d={`M${x+22} ${y} v12 h12`} fill="none"/>
    <path d={`M${x+8} ${y+24} h18 M${x+8} ${y+32} h18`} stroke={c.border}/>
  </g>;
}
function FolderStorage() {
  const f = useCurrentFrame();
  return <g opacity={reveal(f, 0, 24)}>
    <MotionLabel text="FOLDER STORAGE" x={90} y={335} size={28} color={c.muted}/>
    <path d="M80 438 V390 L116 370 H292 L326 414 H610 L640 444 V870 H80 Z"
      fill={c.primarySoft} stroke={c.primary} strokeWidth={3}/>
    <rect x={80} y={438} width={560} height={442} rx={20} fill={c.surface} stroke={c.border} strokeWidth={3}/>
    <rect x={104} y={468} width={512} height={114} rx={14} fill={c.primarySoft}/>
    <path d="M124 510 H144 L134 524 Z" fill={c.primary}/>
    <path d="M162 536 V496 H182 L192 506 H212 V536 Z" stroke={c.primary} strokeWidth={3} fill="none"/>
    <MotionLabel text="Document Curator" x={230} y={512} size={30}/>
    <MotionLabel text="Playbook" x={230} y={556} size={30}/>
    <path d="M136 598 V820" stroke={c.border} strokeWidth={3}/>
    {motion005.documents.map((doc, i) => {
      const y = 626 + i * 90;
      return <g key={doc.id} opacity={reveal(f, 20 + i * 12, 24)}>
        <path d={`M136 ${y+22} H166`} stroke={c.border} strokeWidth={3}/>
        <DocumentIcon x={174} y={y}/>
        <MotionLabel text={doc.name} x={224} y={y+30} size={24}/>
      </g>;
    })}
  </g>;
}

export function KnowledgeOrganization({withAudio}: {withAudio: boolean}) {
  const f = useCurrentFrame();
  const graph = reveal(f, t.graph, 24);
  const definition = reveal(f, t.definition, 24) * (1 - reveal(f, t.groups, 24));
  const groups = reveal(f, t.groups, 30) * (1 - reveal(f, t.network, 30));
  const tags = reveal(f, t.tags, 30) * (1 - reveal(f, t.network, 30));
  const title = f < t.folders ? 'Storage and organization' : f < t.graph ? 'Documents stay in folders'
    : f < t.definition ? 'Relationships form a directed graph' : f < t.groups ? 'A document. A relationship.'
      : f < t.network ? 'Groups and Tags' : 'A connected knowledge network';
  return <AbsoluteFill style={{backgroundColor: c.canvas}}>
    {withAudio && <Audio src={staticFile(motion005.audio)}/>}
    <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img"
      aria-label="Documents remain in folders while their directed relationships form a separate knowledge graph.">
      <MotionLabel text="ODYSSEY / HOW 001 · M-05" x={90} y={85} size={25} color={c.primary}/>
      <MotionLabel text={title} x={90} y={200} size={54} weight={600}/>
      <FolderStorage/>
      <g opacity={1 - graph}>
        <rect x={770} y={410} width={1030} height={430} rx={20} fill={c.surface} stroke={c.border} strokeWidth={3}/>
        <g opacity={1 - reveal(f, t.folders, 24)}>
          <MotionLabel text="STORED IN" x={840} y={505} size={38} color={c.primary}/>
          <MotionLabel text="Folders" x={840} y={590} size={44}/>
          <MotionLabel text="ORGANIZED AS · Relationships" x={840} y={700} size={38} color={c.primary}/>
        </g>
        <g opacity={reveal(f, t.folders, 24)}>
          <MotionLabel text="Same documents. Same storage." x={820} y={535} size={40} color={c.primary}/>
          <MotionLabel text="A separate view of their relationships." x={820} y={650} size={34} color={c.muted}/>
        </g>
      </g>
      <g opacity={graph}>
        <g opacity={groups}>
          <rect x={708} y={372} width={1164} height={280} rx={24} fill={c.primarySoft} stroke={c.border} strokeWidth={3}/>
          <MotionLabel text="GROUP · Review context (example)" x={740} y={418} size={26} color={c.primary}/>
        </g>
        <MotionArrow from={{x: 1250, y: 530}} to={{x: 1370, y: 530}} start={t.graph+90} duration={30}/>
        <MotionArrow from={{x: 1500, y: 610}} to={{x: 1470, y: 730}} start={t.graph+125} duration={30}/>
        <MotionArrow from={{x: 1100, y: 730}} to={{x: 1020, y: 610}} start={t.graph+160} duration={30}/>
        <MotionArrow from={{x: 1370, y: 568}} to={{x: 1250, y: 568}} start={t.network+30} duration={30}/>
        <MotionArrow from={{x: 1420, y: 730}} to={{x: 1450, y: 610}} start={t.network+60} duration={30}/>
        <MotionArrow from={{x: 970, y: 610}} to={{x: 1120, y: 730}} start={t.network+90} duration={30}/>
        {motion005.documents.map((doc, i) => <g key={doc.id} opacity={reveal(f, t.graph+i*20, 24)}>
          <rect x={doc.x} y={doc.y} width={490} height={140} rx={20} fill={c.surface} stroke={c.border} strokeWidth={3}/>
          <rect x={doc.x} y={doc.y} width={490} height={140} rx={20} fill={c.primarySoft} stroke={c.primary} strokeWidth={3}
            opacity={i === 0 ? definition : 0}/>
          <MotionLabel text={doc.name} x={doc.x+24} y={doc.y+45} size={26}/>
          <MotionLabel text="Document" x={doc.x+24} y={doc.y+90} size={26} color={c.muted}/>
          <g opacity={tags}><MotionLabel text={`#${doc.tag}`} x={doc.x+24} y={doc.y+120} size={22} color={c.primary}/></g>
        </g>)}
        <g opacity={definition}>
          <MotionLabel text="NODE = Document" x={760} y={350} size={34} color={c.primary}/>
          <MotionLabel text="EDGE = Relationship" x={1300} y={410} size={30} color={c.primary}/>
        </g>
      </g>
    </svg>
  </AbsoluteFill>;
}
