import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {MotionLabel} from '../components/MotionLabel';
import {reveal} from '../components/timing';
import {theme} from '../theme';
import {motion002} from './motion002Config';

const c = theme.colors;
const t = motion002.timing;
type Box = Readonly<{x: number; y: number; width: number; height: number}>;

function Card({box, text, start, emphasis = 0, subtitle}: {box: Box; text: string; start: number; emphasis?: number;
  subtitle?: Readonly<{text: string; start: number}>}) {
  const f = useCurrentFrame();
  const p = reveal(f, start, 22);
  return <g opacity={p} transform={`translate(0 ${12 * (1 - p)})`}>
    <rect {...box} rx={18} fill={c.surface} stroke={c.border} strokeWidth={3}/>
    <rect {...box} rx={18} fill={c.primarySoft} stroke={c.primary} strokeWidth={3} opacity={emphasis}/>
    <MotionLabel text={text} x={box.x + box.width / 2} y={box.y + box.height / 2 + (subtitle ? -8 : 12)}
      size={34} weight={600} anchor="middle"/>
    {subtitle && <MotionLabel text={subtitle.text} x={box.x + box.width / 2} y={box.y + box.height - 20}
      size={24} color={c.muted} anchor="middle" start={subtitle.start}/>}
  </g>;
}

function ClassificationLine({path, start}: {path: string; start: number}) {
  const p = reveal(useCurrentFrame(), start, 25);
  return <path d={path} fill="none" stroke={c.primary} strokeWidth={3}
    pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={p}/>;
}

export function WorkflowTaxonomy({withAudio}: {withAudio: boolean}) {
  const f = useCurrentFrame();
  const logicEmphasis = reveal(f, t.logic, 22) * (1 - reveal(f, t.action, 25));
  const actionEmphasis = reveal(f, t.action, 25) * (1 - reveal(f, t.children, 25));
  const {root, logic, action, leaves} = motion002.layout;
  return <AbsoluteFill style={{backgroundColor: c.canvas}}>
    {withAudio && <Audio src={staticFile(motion002.audio)}/>}
    <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img"
      aria-label="Workflow Nodes comprise Logic Nodes and Action Nodes. Branch and Loop are Logic examples. Agent and Task are Action subtypes.">
      <MotionLabel text="ODYSSEY / HOW 001 · M-02" x={100} y={90} size={25} color={c.primary}/>
      <MotionLabel text="Two groups of Workflow Nodes" x={100} y={185} size={55} weight={600}/>
      <ClassificationLine path="M960 350 V395 H500 V440" start={t.split}/>
      <ClassificationLine path="M960 395 H1420 V440" start={t.split + 12}/>
      <ClassificationLine path="M500 550 V655 H320 V700" start={t.branch - 15}/>
      <ClassificationLine path="M500 655 H680 V700" start={t.loop - 15}/>
      <ClassificationLine path="M1420 550 V655 H1240 V700" start={t.children}/>
      <ClassificationLine path="M1420 655 H1600 V700" start={t.task - 15}/>
      <Card box={root} text="Workflow Nodes" start={t.root} emphasis={1}/>
      <Card box={logic} text="Logic Nodes" start={t.split + 20} emphasis={logicEmphasis}
        subtitle={{text: 'Controls the flow', start: t.flow}}/>
      <Card box={action} text="Action Nodes" start={t.split + 35} emphasis={actionEmphasis}
        subtitle={{text: 'Does the actual work', start: t.work}}/>
      <Card box={{x: 170, ...leaves}} text="Branch" start={t.branch}/>
      <Card box={{x: 530, ...leaves}} text="Loop" start={t.loop}/>
      <Card box={{x: 1090, ...leaves}} text="Agent Nodes" start={t.children + 15} emphasis={reveal(f, t.children + 15, 25)}/>
      <Card box={{x: 1450, ...leaves}} text="Task Nodes" start={t.task} emphasis={reveal(f, t.task, 25)}/>
      <MotionLabel text="Examples" x={500} y={850} size={27} color={c.muted} anchor="middle" start={t.branch}/>
    </svg>
  </AbsoluteFill>;
}
