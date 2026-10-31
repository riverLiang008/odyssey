import {Composition} from 'remotion';
import {SystemOverview} from '../scenes/SystemOverview';
import {video} from '../theme';
export function R012() {
  return <>
    <Composition id="R012" component={SystemOverview} defaultProps={{withAudio:false}} durationInFrames={843} {...video}/>
    <Composition id="R012Review" component={SystemOverview} defaultProps={{withAudio:true}} durationInFrames={843} {...video}/>
  </>;
}
