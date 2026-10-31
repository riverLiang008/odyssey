import {Composition} from 'remotion';
import {OdysseyOutro} from '../scenes/OdysseyOutro';
import {video} from '../theme';
export function Outro() {
  return <Composition id="OdysseyOutro" component={OdysseyOutro} durationInFrames={165} {...video}/>;
}
