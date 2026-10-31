import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {MotionLabel} from '../components/MotionLabel';
import {reveal} from '../components/timing';
import {theme} from '../theme';
import {motion003} from './motion003Config';

const c = theme.colors;
const t = motion003.timing;
type Box = Readonly<{x: number; y: number; width: number; height: number}>;
function Panel({box, active = 0}: {box: Box; active?: number}) {
  return <>
    <rect {...box} rx={20} fill={c.surface} stroke={c.border} strokeWidth={3}/>
    <rect {...box} rx={20} fill={c.primarySoft} stroke={c.primary} strokeWidth={3} opacity={active}/>
  </>;
}

export function ThinkingOwnership({withAudio}: {withAudio: boolean}) {
  const f = useCurrentFrame();
  const entered = reveal(f, 0, 24);
  const agent = reveal(f, t.agent, 22) * (1 - reveal(f, t.task, 22));
  const task = reveal(f, t.task, 22) * (1 - reveal(f, t.contrast, 22));
  const goal = reveal(f, t.goal, 20) * (1 - reveal(f, t.task, 22));
  const title = f < t.question ? 'Agent and Task: one comparison' : f < t.agent ? 'Thinking Ownership'
    : f < t.goal ? 'Agent Action: Model + Goal' : f < t.task ? 'Agent: goal-bound freedom'
      : f < t.contrast ? 'Task: Predefined steps' : 'Who makes the decisions?';
  return <AbsoluteFill style={{backgroundColor: c.canvas}}>
    {withAudio && <Audio src={staticFile(motion003.audio)}/>}
    <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img"
      aria-label="Agent has goal-bound freedom; Task follows an operation defined in advance.">
      <MotionLabel text="ODYSSEY / HOW 001 · M-03" x={100} y={90} size={25} color={c.primary}/>
      <MotionLabel text={title} x={100} y={205} size={55} weight={600}/>
      <g opacity={reveal(f, t.question, 20) * (1 - reveal(f, t.agent, 20))}>
        <MotionLabel text="Who makes the decisions?" x={100} y={290} size={36} color={c.primary}/>
      </g>
      <g opacity={entered * (1 - task * 0.68)}>
        <Panel box={motion003.layout.agent} active={agent}/>
        <MotionLabel text="AGENT ACTION · Research &amp; synthesize" x={150} y={410} size={30} weight={600}/>
        {motion003.agentRows.map((text, i) => {
          const y = [450, 530, 610, 710][i] ?? 450;
          const emphasis = i === 1 ? goal : i === 0 ? agent * (1 - goal) : 0;
          return <g key={text}>
            <Panel box={{x: 150, y, width: 730, height: 68}} active={emphasis}/>
            <MotionLabel text={text} x={170} y={y + 44} size={28}/>
          </g>;
        })}
      </g>
      <g opacity={entered * (1 - agent * 0.68)}>
        <Panel box={motion003.layout.task} active={task}/>
        <MotionLabel text="TASK · Publish research brief" x={1050} y={460} size={32} weight={600}/>
        <MotionLabel text="Predefined sequence" x={1050} y={510} size={28} color={c.muted}/>
        {motion003.steps.map((text, i) => {
          const emphasis = reveal(f, t.task + i * 24, 18) * (1 - reveal(f, t.contrast, 22));
          const y = 550 + i * 70;
          return <g key={text}>
            <Panel box={{x: 1050, y, width: 720, height: 58}} active={emphasis}/>
            <MotionLabel text={`${i + 1}   ${text}`} x={1072} y={y + 39} size={28}/>
          </g>;
        })}
      </g>
      <MotionLabel text="Goal-bound choices" x={150} y={907} size={32} color={c.primary} start={t.contrast + 20}/>
      <MotionLabel text="Operation defined in advance" x={1050} y={907} size={32} color={c.primary} start={t.contrast + 20}/>
    </svg>
  </AbsoluteFill>;
}
