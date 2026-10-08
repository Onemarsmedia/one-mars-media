import React from 'react';
import {AbsoluteFill, Composition, useCurrentFrame} from 'remotion';
import {buildTestScene} from './film/testScene';
import {buildReferenceScene} from './film/editorial/reference';
import {buildEditorialScene} from './film/editorial/film';
import {loadFonts} from './fonts';
import {MotionBlur} from './render/MotionBlur';
import {SceneFrame} from './render/SceneRenderer';
import type {Scene} from './scene/types';

const SceneComp: React.FC<{scene: Scene}> = ({scene}) => {
  loadFonts(scene.fonts);
  const frame = useCurrentFrame();
  const mb = scene.comps[scene.main].motionBlur;
  return (
    <AbsoluteFill>
      {mb ? (
        <MotionBlur t={frame} shutterAngle={mb.shutterAngle} samples={mb.perFrame?.[frame] ?? mb.samples} render={(t, i) => <SceneFrame scene={scene} t={t} idPrefix={`s${i}_`} />} />
      ) : (
        <SceneFrame scene={scene} t={frame} />
      )}
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
    <Composition
      id="Onemarsmedia360"
      component={SceneComp}
      durationInFrames={film.comps[film.main].duration}
      fps={film.comps[film.main].fps}
      width={1920}
      height={1080}
      defaultProps={{scene: film}}
    />
    <Composition id="TilesRef" component={SceneComp} durationInFrames={1} fps={60} width={1920} height={1080} defaultProps={{scene: ref}} />
  </>
);
