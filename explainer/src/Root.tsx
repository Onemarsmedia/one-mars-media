import React from 'react';
import {AbsoluteFill, Composition, useCurrentFrame} from 'remotion';
import {buildTestScene} from './film/testScene';
import {loadFonts} from './fonts';
import {SceneFrame} from './render/SceneRenderer';
import type {Scene} from './scene/types';

const SceneComp: React.FC<{scene: Scene}> = ({scene}) => {
  loadFonts(scene.fonts);
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <SceneFrame scene={scene} t={frame} />
    </AbsoluteFill>
  );
};

const test = buildTestScene();
const testMain = test.comps[test.main];

export const Root: React.FC = () => (
  <>
    <Composition
      id="EngineTest"
      component={SceneComp}
      durationInFrames={testMain.duration}
      fps={testMain.fps}
      width={testMain.width}
      height={testMain.height}
      defaultProps={{scene: test}}
    />
  </>
);
