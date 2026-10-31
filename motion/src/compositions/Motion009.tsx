import {Composition} from 'remotion';
import {PatternSimplification} from '../scenes/PatternSimplification';
import {video} from '../theme';
export function Motion009(){return <>
  <Composition id="Motion009" component={PatternSimplification} defaultProps={{withAudio:false}} durationInFrames={880} {...video}/>
  <Composition id="Motion009Review" component={PatternSimplification} defaultProps={{withAudio:true}} durationInFrames={880} {...video}/>
</>;}
