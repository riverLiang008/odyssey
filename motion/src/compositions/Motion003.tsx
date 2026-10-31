import {Composition} from 'remotion';
import {ThinkingOwnership} from '../scenes/ThinkingOwnership';
import {motion003} from '../scenes/motion003Config';
import {video} from '../theme';
export function Motion003() {
  return <>
    <Composition id="Motion003" component={ThinkingOwnership} defaultProps={{withAudio: false}}
      durationInFrames={motion003.duration} {...video}/>
    <Composition id="Motion003Review" component={ThinkingOwnership} defaultProps={{withAudio: true}}
      durationInFrames={motion003.duration} {...video}/>
  </>;
}
