import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {MotionArrow} from '../components/MotionArrow';
import {MotionBehavior} from '../components/MotionBehavior';
import {MotionLabel} from '../components/MotionLabel';
import {MotionNode} from '../components/MotionNode';
import {reveal} from '../components/timing';
import {theme, video} from '../theme';
import {motion001} from './motion001Config';

export function ExecutionDimensions() {
  const frame = useCurrentFrame();
  const {layout: l, timing: t, copy: c} = motion001;
  const right = l.left + 3 * l.nodeWidth + 2 * l.gap;
  const dimension = reveal(frame, t.dimensions, 24);
  return <AbsoluteFill style={{backgroundColor: theme.colors.canvas}}>
    <svg viewBox={`0 0 ${video.width} ${video.height}`} width="100%" height="100%" role="img"
      aria-label="Execution modules advance state horizontally; execution behavior spans execution as a different dimension.">
      <MotionLabel text={c.eyebrow} x={120} y={104} size={theme.type.eyebrow} color={theme.colors.primary} weight={600}/>
      <MotionLabel text={c.title} x={120} y={211} size={theme.type.title} weight={600}/>
      <MotionLabel text={c.subtitle} x={124} y={265} color={theme.colors.muted}/>
      <MotionBehavior x={l.left - 30} y={l.behaviorTop} width={right - l.left + 60}
        height={l.behaviorHeight} start={t.behavior} title={c.behavior} description={c.behaviorDescription}/>
      {c.nodes.map((text, index) => <MotionNode key={text} text={text}
        x={l.left + index * (l.nodeWidth + l.gap)} y={l.top} width={l.nodeWidth} height={l.nodeHeight}
        start={t.nodes[index] ?? 0} stroke={index === 1 ? theme.colors.primary : theme.colors.border}/>)}
      {t.arrows.map((start, index) => <MotionArrow key={start} start={start}
        from={{x: l.left + l.nodeWidth + index * (l.nodeWidth + l.gap) + 12, y: l.top + l.nodeHeight / 2}}
        to={{x: l.left + (index + 1) * (l.nodeWidth + l.gap) - 12, y: l.top + l.nodeHeight / 2}}/>)}
      <g opacity={dimension}>
        <path d={`M ${l.left} 340 H ${right}`} stroke={theme.colors.border} strokeWidth={2}/>
        <MotionArrow from={{x: l.left, y: 340}} to={{x: right, y: 340}} start={t.dimensions} duration={24}/>
        <MotionLabel text={c.horizontal} x={l.left} y={313} start={t.dimensions} weight={600} color={theme.colors.primary}/>
        <MotionLabel text={c.vertical} x={120} y={615} start={t.dimensions} size={theme.type.eyebrow} weight={600}/>
        <MotionLabel text={c.verticalNote} x={120} y={652} start={t.dimensions} size={theme.type.eyebrow} color={theme.colors.muted}/>
        <MotionLabel text={c.horizontalNote} x={l.left} y={814} start={t.dimensions + 12} color={theme.colors.primary}/>
      </g>
      <MotionLabel text={c.footer} x={120} y={972} start={75} size={theme.type.caption} color={theme.colors.muted}/>
      <MotionLabel text="01 / 01" x={1800} y={972} start={0} anchor="end" size={theme.type.eyebrow} color={theme.colors.muted}/>
    </svg>
  </AbsoluteFill>;
}
