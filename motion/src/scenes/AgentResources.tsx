import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {MotionLabel} from '../components/MotionLabel';
import {reveal} from '../components/timing';
import {theme} from '../theme';
import {motion004} from './motion004Config';

const c = theme.colors;
const t = motion004.timing;
type Box = Readonly<{x: number; y: number; width: number; height: number}>;
function Panel({box, emphasis = 0}: {box: Box; emphasis?: number}) {
  return <>
    <rect {...box} rx={20} fill={c.surface} stroke={c.border} strokeWidth={3}/>
    <rect {...box} rx={20} fill={c.primarySoft} stroke={c.primary} strokeWidth={3} opacity={emphasis}/>
  </>;
}
function ResourceSummary({x, kind}: {x: number; kind: 'knowledge' | 'tools'}) {
  const knowledge = kind === 'knowledge';
  const accent = knowledge ? c.primary : c.error;
  const pills = knowledge ? [{name: 'Paper Research', width: 290}]
    : [{name: 'Web Search', width: 208}, {name: 'Read File', width: 170}];
  let offset = x + 60;
  return <g>
    <rect x={x} y={380} width={760} height={400} rx={20} fill={c.canvas} stroke={c.border} strokeWidth={3}/>
    <rect x={x + 36} y={424} width={688} height={166} rx={16} fill={c.surface} stroke={accent} strokeWidth={3}/>
    <MotionLabel text={knowledge ? 'Knowledge Spaces' : 'Toolbox'} x={x + 60} y={490} size={38}/>
    {pills.map(({name, width}) => {
      const left = offset;
      offset += width + 16;
      return <g key={name}>
        <rect x={left} y={514} width={width} height={50} rx={25} fill={c.primarySoft} stroke={c.border} strokeWidth={2}/>
        <MotionLabel text={name} x={left + 18} y={548} size={26} color={c.primary}/>
      </g>;
    })}
    <MotionLabel text={knowledge ? '+ Drop Knowledge Space' : '+ Drop Tool'} x={offset + 6} y={548} size={22} color={c.muted}/>
    <MotionLabel text={knowledge ? 'KNOWING' : 'DOING'} x={x + 70} y={865} size={56} color={c.primary}/>
    <MotionLabel text={knowledge ? 'Knowledge / context' : 'Tools / actions'} x={x + 70} y={915} size={34} color={c.muted}/>
  </g>;
}

export function AgentResources({withAudio}: {withAudio: boolean}) {
  const f = useCurrentFrame();
  const l = motion004.layout;
  const end = reveal(f, t.end, 30);
  const knowing = reveal(f, t.knowing, 24) * (1 - reveal(f, t.doing, 24));
  const doing = reveal(f, t.doing, 24);
  const resources = reveal(f, t.resources, 24);
  const title = f < t.model ? 'Agent Action: Four components' : f < t.resources ? 'Model + Goal'
    : f < t.knowing ? 'Knowledge Space + ToolBox' : f < t.doing ? 'Knowledge Space: Knowing'
      : f < t.end ? 'ToolBox: Doing' : 'Knowing vs Doing';
  return <AbsoluteFill style={{backgroundColor: c.canvas}}>
    {withAudio && <Audio src={staticFile(motion004.audio)}/>}
    <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img"
      aria-label="Four Agent components; Knowledge Space organizes knowledge, instructions and text resources, ToolBox organizes tools and actions.">
      <MotionLabel text="ODYSSEY / HOW 001 · M-04" x={100} y={90} size={25} color={c.primary}/>
      <MotionLabel text={title} x={100} y={205} size={55} weight={600}/>
      <g opacity={reveal(f, 0, 24) * (1 - end)}>
        <Panel box={l.card}/>
        <MotionLabel text="AGENT ACTION · Research &amp; synthesize" x={520} y={390} size={34} weight={600}/>
        {motion004.rows.map((text, i) => {
          const emphasis = i === 0 ? reveal(f, t.model, 12) * (1 - resources)
            : i === 1 ? reveal(f, t.goal, 12) * (1 - resources)
              : i === 2 ? resources * (1 - doing) : resources * (1 - knowing);
          const dim = i < 2 ? resources * 0.65 : i === 2 ? doing * 0.65 : knowing * 0.65;
          const y = l.rowY + i * l.rowGap;
          return <g key={text} opacity={1 - dim}>
            <Panel box={{x: l.rowX, y, width: l.rowWidth, height: l.rowHeight}} emphasis={emphasis}/>
            <MotionLabel text={text} x={l.rowX + 24} y={y + 49} size={32}/>
          </g>;
        })}
        <g opacity={knowing}>
          <MotionLabel text="Knowledge / Instructions / Text resources" x={960} y={915} size={36} color={c.primary} anchor="middle"/>
        </g>
        <g opacity={doing}>
          <MotionLabel text="Tools / Actions" x={960} y={915} size={36} color={c.primary} anchor="middle"/>
        </g>
      </g>
      <g opacity={end}>
        <ResourceSummary x={140} kind="knowledge"/>
        <ResourceSummary x={1020} kind="tools"/>
      </g>
    </svg>
  </AbsoluteFill>;
}
