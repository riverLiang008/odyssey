import {Composition} from 'remotion';
import {LlmAsTool} from '../scenes/LlmAsTool';
import {video} from '../theme';
export function Fig002(){return <>
  <Composition id="Fig002" component={LlmAsTool} defaultProps={{withAudio:false}} durationInFrames={520} {...video}/>
  <Composition id="Fig002Review" component={LlmAsTool} defaultProps={{withAudio:true}} durationInFrames={520} {...video}/>
</>;}
