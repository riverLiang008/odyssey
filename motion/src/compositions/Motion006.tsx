import {Composition} from 'remotion';
import {KnowledgeAccess} from '../scenes/KnowledgeAccess';
import {video} from '../theme';
export function Motion006() {
  return <>
    <Composition id="Motion006" component={KnowledgeAccess} defaultProps={{withAudio: false}} durationInFrames={1401} {...video}/>
    <Composition id="Motion006Review" component={KnowledgeAccess} defaultProps={{withAudio: true}} durationInFrames={1401} {...video}/>
  </>;
}
