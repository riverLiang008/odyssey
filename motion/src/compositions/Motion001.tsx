import {Composition} from 'remotion';
import {ExecutionDimensions} from '../scenes/ExecutionDimensions';
import {motion001} from '../scenes/motion001Config';
import {video} from '../theme';

export function Motion001() {
  return <Composition id={motion001.id} component={ExecutionDimensions}
    durationInFrames={motion001.durationInFrames} {...video}/>;
}
