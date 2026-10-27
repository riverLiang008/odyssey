import {interpolate} from 'remotion';

export const reveal = (frame: number, start: number, duration = 18): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
