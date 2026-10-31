import {Composition} from 'remotion';
import {KnowledgeOrganization} from '../scenes/KnowledgeOrganization';
import {motion005} from '../scenes/motion005Config';
import {video} from '../theme';
export function Motion005() {
  return <>
    <Composition id="Motion005" component={KnowledgeOrganization} defaultProps={{withAudio: false}}
      durationInFrames={motion005.duration} {...video}/>
    <Composition id="Motion005Review" component={KnowledgeOrganization} defaultProps={{withAudio: true}}
      durationInFrames={motion005.duration} {...video}/>
  </>;
}
