import {AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {MotionArrow} from '../components/MotionArrow';
import {MotionLabel} from '../components/MotionLabel';
import {reveal} from '../components/timing';
import {theme} from '../theme';
import {m1V2} from './m1V2Config';

const c = theme.colors;
const t = m1V2.timing;
const l = m1V2.layout;
const ease = (frame: number, start: number, duration: number) => interpolate(frame,
  [start, start + duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});

function Label({text, x, y, size = 30, color = c.ink, start = 0, weight = 400,
  anchor = 'start'}: {text: string; x: number; y: number; size?: number; color?: string;
    start?: number; weight?: number; anchor?: 'start' | 'middle' | 'end'}) {
  return <MotionLabel {...{text, x, y, size, color, start, weight, anchor}}/>;
}

function Structure() {
  const f = useCurrentFrame();
  const p = ease(f, t.pattern, 30);
  const nodes = [
    {id: 'input', x: l.left, width: l.sideWidth, title: 'Input Guardrail', start: t.structure},
    {id: 'execution', x: l.centerLeft, width: l.centerWidth, title: 'Execution Module', start: t.structure + 20},
    {id: 'output', x: l.right, width: l.sideWidth, title: 'Output Guardrail', start: t.structure + 40},
  ];
  return <g opacity={reveal(f, t.structure, 30) * (1 - reveal(f, t.comparison, 24))}>
    {nodes.map((node) => <g key={node.id} opacity={reveal(f, node.start, 25)}>
      <rect x={node.x} y={l.top} width={node.width} height={l.height} rx={20}
        fill={c.surface} stroke={node.id === 'execution' ? c.primary : c.border} strokeWidth={3}/>
      <Label text={node.title} x={node.x + node.width / 2} y={465 - (node.id === 'execution' ? p * 60 : 0)}
        anchor="middle" size={32} weight={600}/>
    </g>)}
    <MotionArrow from={{x: 510, y: 460}} to={{x: 590, y: 460}} start={345} color={c.ink}/>
    <MotionArrow from={{x: 1330, y: 460}} to={{x: 1410, y: 460}} start={360} color={c.ink}/>
    <g opacity={p}>
      <Label text="PATTERN · Linear (example)" x={650} y={450} color={c.primary} size={23}/>
      {[0, 1, 2].map((i) => <g key={`agent-${i}`} opacity={reveal(f, 480 + i * 16, 20)}>
        <rect x={657 + i * 207} y={475} width={165} height={65} rx={12} fill={c.surface} stroke={c.border} strokeWidth={2}/>
        <Label text={`Agent ${i + 1}`} x={739 + i * 207} y={516} size={25} anchor="middle"/>
      </g>)}
      {[0, 1].map((i) => <MotionArrow key={`internal-${i}`} from={{x: 829 + i * 207, y: 507}}
        to={{x: 856 + i * 207, y: 507}} start={510 + i * 24} duration={18}/>)}
    </g>
    <g opacity={reveal(f, t.behavior, 36)}>
      {[318, 960, 1602].map((x) => <line key={x} x1={x} x2={x} y1={570} y2={695}
        stroke={c.primary} strokeWidth={2} strokeDasharray="8 10" opacity={reveal(f, 666, 30)}/>)}
      <rect x={l.left} y={l.behaviorTop} width={1620} height={l.behaviorHeight} rx={18}
        fill={c.primarySoft} stroke={c.primary} strokeWidth={3}/>
      <Label text="Execution Behavior · applies across the system" x={960} y={767} size={34}
        color={c.primary} weight={600} anchor="middle"/>
    </g>
  </g>;
}

function Comparison() {
  const f = useCurrentFrame();
  const right = reveal(f, t.behaviorContrast, 30);
  return <g opacity={reveal(f, t.comparison, 24) * (1 - reveal(f, t.ui, 24))}>
    <g opacity={1 - right * 0.25}>
      <rect x={150} y={350} width={755} height={460} rx={20} fill={c.surface} stroke={c.border} strokeWidth={3}/>
      <Label text="MODULE / PATTERN" x={527} y={445} size={36} color={c.primary} weight={600} anchor="middle"/>
      <Label text="Moves the system forward" x={527} y={565} size={34} anchor="middle"/>
      <MotionArrow from={{x: 330, y: 670}} to={{x: 725, y: 670}} start={840} duration={45}/>
    </g>
    <g opacity={0.35 + right * 0.65}>
      <rect x={1015} y={350} width={755} height={460} rx={20} fill={c.surface}
        stroke={right > 0 ? c.primary : c.border} strokeWidth={3}/>
      <Label text="BEHAVIOR" x={1392} y={445} size={36} color={c.primary} weight={600} anchor="middle"/>
      <Label text="Does not move it forward" x={1392} y={555} size={32} anchor="middle"/>
      <Label text="on its own" x={1392} y={605} size={32} anchor="middle"/>
      <Label text="Cross-cutting behavior" x={1392} y={715} size={26} color={c.muted} anchor="middle"/>
    </g>
  </g>;
}

function SystemConfiguration() {
  const f = useCurrentFrame();
  const focus = ease(f, 1240, 60) * (1 - ease(f, t.overview, 100));
  // Source screenshot is 2560×1349. Viewport moves between the configured
  // Agent and its empty-slot neighbors, then the complete configuration area.
  const x = 820 + 450 * focus;
  const y = 250 + 200 * focus;
  const w = 1710 - 660 * focus;
  const h = 1040 - 380 * focus;
  return <g opacity={reveal(f, t.ui, 24)}>
    <svg x={120} y={295} width={1680} height={570} viewBox={`${x} ${y} ${w} ${h}`}>
      <defs><clipPath id="configuration-crop"><rect x={x} y={y} width={w} height={h}/></clipPath></defs>
      <g clipPath="url(#configuration-crop)">
        <image href={staticFile(m1V2.assets.system)} width={2560} height={1349}/>
        <circle cx={2010} cy={864} r={48} fill="none" stroke={c.primary} strokeWidth={4}
          opacity={reveal(f, 1280, 25) * (1 - reveal(f, t.overview, 40))}/>
      </g>
    </svg>
    <g opacity={1 - reveal(f, t.overview, 40)}>
      <Label text="Agent 1 · Filled = configured" x={960} y={902} color={c.primary} weight={600} size={30} anchor="middle" start={1260}/>
    </g>
    <Label text="System structure and configuration, in one place" x={960} y={902}
      size={30} color={c.primary} weight={600} anchor="middle" start={t.overview + 40}/>
  </g>;
}

export function ExecutionDimensionsV2({withAudio}: {withAudio: boolean}) {
  const f = useCurrentFrame();
  const title = f < 300 ? 'A simple two-dimensional layout' : f < 450 ? 'Execution Modules'
    : f < 630 ? 'Inside a module: Pattern' : f < 810 ? 'Execution Behaviors'
      : f < 1212 ? 'What moves the system forward?' : f < 1476 ? 'Configuration becomes visible'
        : 'The system, in one place';
  return <AbsoluteFill style={{backgroundColor: c.canvas}}>
    {withAudio && <>
      <Sequence durationInFrames={1212}><Audio src={staticFile(m1V2.assets.audio1)}/></Sequence>
      <Sequence from={t.ui}><Audio src={staticFile(m1V2.assets.audio2)}/></Sequence>
    </>}
    <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img" aria-label={title}>
      <Label text="ODYSSEY / HOW 001                                      M-01" x={100} y={90} size={25} color={c.primary} weight={600}/>
      <Label text={title} x={100} y={190} size={55} weight={600}/>
      <g opacity={reveal(f, 0, 24) * (1 - reveal(f, t.sketchOut, 90))}>
        <image href={staticFile(m1V2.assets.sketch)} x={200} y={280} width={1520} height={600}/>
      </g>
      <Structure/>
      <Comparison/>
      <SystemConfiguration/>
    </svg>
  </AbsoluteFill>;
}
