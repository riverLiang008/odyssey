import {Composition} from 'remotion';
import {FourCoreConcepts} from '../scenes/FourCoreConcepts';
import {video} from '../theme';
export function Motion007(){
  return <>
    <Composition id="Motion007" component={FourCoreConcepts} defaultProps={{withAudio:false}} durationInFrames={512} {...video}/>
    <Composition id="Motion007Review" component={FourCoreConcepts} defaultProps={{withAudio:true}} durationInFrames={512} {...video}/>
  </>;
}
