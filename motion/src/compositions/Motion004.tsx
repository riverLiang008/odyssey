import {Composition} from 'remotion';
import {AgentResources} from '../scenes/AgentResources';
import {motion004} from '../scenes/motion004Config';
import {video} from '../theme';
export function Motion004() {
  return <>
    <Composition id="Motion004" component={AgentResources} defaultProps={{withAudio: false}}
      durationInFrames={motion004.duration} {...video}/>
    <Composition id="Motion004Review" component={AgentResources} defaultProps={{withAudio: true}}
      durationInFrames={motion004.duration} {...video}/>
  </>;
}
