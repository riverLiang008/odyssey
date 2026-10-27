import {Composition} from 'remotion';
import {WorkflowTaxonomy} from '../scenes/WorkflowTaxonomy';
import {motion002} from '../scenes/motion002Config';
import {video} from '../theme';
export function Motion002() {
  return <>
    <Composition id="Motion002" component={WorkflowTaxonomy} defaultProps={{withAudio: false}}
      durationInFrames={motion002.duration} {...video}/>
    <Composition id="Motion002Review" component={WorkflowTaxonomy} defaultProps={{withAudio: true}}
      durationInFrames={motion002.duration} {...video}/>
  </>;
}
