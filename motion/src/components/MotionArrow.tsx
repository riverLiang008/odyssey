import {useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {reveal} from './timing';

type Point = Readonly<{x: number; y: number}>;
export interface MotionArrowProps {
  from: Point; to: Point; start: number; duration?: number; color?: string;
}

export function MotionArrow({from, to, start, duration = 20, color = theme.colors.primary}: MotionArrowProps) {
  const progress = reveal(useCurrentFrame(), start, duration);
  const x = from.x + (to.x - from.x) * progress;
  const y = from.y + (to.y - from.y) * progress;
  const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
  return <g opacity={progress} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round">
    <path d={`M ${from.x} ${from.y} L ${x} ${y}`}/>
    <path d="M -12 -7 L 0 0 L -12 7" transform={`translate(${x} ${y}) rotate(${angle})`}/>
  </g>;
}
