import {useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {reveal} from './timing';

export interface MotionLabelProps {
  text: string;
  x: number;
  y: number;
  start?: number;
  size?: number;
  color?: string;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
}

export function MotionLabel({text, x, y, start = 0, size = theme.type.body,
  color = theme.colors.ink, weight = 400, anchor = 'start'}: MotionLabelProps) {
  const frame = useCurrentFrame();
  return <text x={x} y={y} fill={color} fontSize={size} fontWeight={weight}
    fontFamily={theme.fontFamily} textAnchor={anchor} opacity={reveal(frame, start)}>{text}</text>;
}
