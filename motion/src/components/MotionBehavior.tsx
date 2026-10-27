import {useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {reveal} from './timing';
import {MotionLabel} from './MotionLabel';

export interface MotionBehaviorProps {
  x: number; y: number; width: number; height: number; start: number;
  title: string; description: string;
}

// A cross-cutting area, deliberately without execution arrows, handles or node styling.
export function MotionBehavior({x, y, width, height, start, title, description}: MotionBehaviorProps) {
  const frame = useCurrentFrame();
  return <g opacity={reveal(frame, start, 24)}>
    <rect x={x} y={y} width={width} height={height} rx={theme.radius}
      fill={theme.colors.primarySoft} fillOpacity={0.85}/>
    <path d={`M ${x - 12} ${y} h -18 v ${height} h 18`} stroke={theme.colors.primary}
      strokeWidth={2} fill="none"/>
    <MotionLabel text={title} x={x + 32} y={y + height - 72} start={start} weight={600} color={theme.colors.primary}/>
    <MotionLabel text={description} x={x + 32} y={y + height - 32} start={start + 6}
      size={theme.type.caption} color={theme.colors.muted}/>
  </g>;
}
