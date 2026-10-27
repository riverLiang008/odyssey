import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {reveal} from './timing';

export interface MotionNodeProps {
  x: number; y: number; width: number; height: number; text: string; start: number;
  fill?: string; stroke?: string; radius?: number;
}

export function MotionNode({x, y, width, height, text, start,
  fill = theme.colors.surface, stroke = theme.colors.border, radius = theme.radius}: MotionNodeProps) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = 0.96 + 0.04 * spring({frame: frame - start, fps, config: {damping: 200}});
  return <g opacity={reveal(frame, start)} transform={`translate(${x + width / 2} ${y + height / 2}) scale(${scale})`}>
    <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={radius}
      fill={fill} stroke={stroke} strokeWidth={2}/>
    <text textAnchor="middle" dominantBaseline="central" fontFamily={theme.fontFamily}
      fontSize={theme.type.heading} fontWeight={600} fill={theme.colors.ink}>{text}</text>
  </g>;
}
