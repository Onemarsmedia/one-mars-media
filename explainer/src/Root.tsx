import React from 'react';
import {AbsoluteFill, Composition, useCurrentFrame} from 'remotion';
import {buildTestScene} from './film/testScene';
import {buildReferenceScene} from './film/editorial/reference';
import {buildEditorialScene} from './film/editorial/film';
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
const ref = buildReferenceScene();
const film = buildEditorialScene();
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
    <Composition id="Onemarsmedia360" component={SceneComp} durationInFrames={900} fps={30} width={1920} height={1080} defaultProps={{scene: film}} />
    <Composition id="TilesRef" component={SceneComp} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{scene: ref}} />
  </>
);
