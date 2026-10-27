import {Composition} from 'remotion';
import {ExecutionDimensionsV2} from '../scenes/ExecutionDimensionsV2';
import {m1V2} from '../scenes/m1V2Config';
import {video} from '../theme';

export function Motion001V2() {
  return <>
    <Composition id="Motion001V2" component={ExecutionDimensionsV2} defaultProps={{withAudio: false}}
      durationInFrames={m1V2.duration} {...video}/>
    <Composition id="Motion001V2Review" component={ExecutionDimensionsV2} defaultProps={{withAudio: true}}
      durationInFrames={m1V2.duration} {...video}/>
  </>;
}
