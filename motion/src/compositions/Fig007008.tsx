import {Composition} from 'remotion';
import {InterfaceContext} from '../scenes/InterfaceContext';
import {video} from '../theme';
export function Fig007008(){return <>
  <Composition id="Fig007008" component={InterfaceContext} defaultProps={{withAudio:false}} durationInFrames={1224} {...video}/>
  <Composition id="Fig007008Review" component={InterfaceContext} defaultProps={{withAudio:true}} durationInFrames={1224} {...video}/>
</>;}
