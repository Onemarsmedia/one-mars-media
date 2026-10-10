import React from 'react';
import {AbsoluteFill, Composition, useCurrentFrame} from 'remotion';
import {buildTestScene} from './film/testScene';
import {buildReferenceScene, buildTileAnimScene} from './film/editorial/reference';
import {buildEditorialScene} from './film/editorial/film';
import {buildReelCoverDarkScene, buildReelCoverScene, buildReelFrameScene, COVER} from './film/editorial/reelCover';
import {buildOneLineScene} from './film/oneline/film';
import {buildTimelineScene} from './film/timeline/film';
import {buildActionScene} from './film/action/film';
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
const tilesAnim = buildTileAnimScene();
const film = buildEditorialScene();
const reelCover = buildReelCoverScene();
const reelFrame = buildReelFrameScene();
const reelCoverDark = buildReelCoverDarkScene();
const oneLine = buildOneLineScene();
const timeline = buildTimelineScene();
const action = buildActionScene();
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
    <Composition id="OneLine" component={SceneComp} durationInFrames={oneLine.comps[oneLine.main].duration} fps={60} width={1920} height={1080} defaultProps={{scene: oneLine}} />
    <Composition id="Timeline" component={SceneComp} durationInFrames={timeline.comps[timeline.main].duration} fps={60} width={1920} height={1080} defaultProps={{scene: timeline}} />
    <Composition id="ActionTaker" component={SceneComp} durationInFrames={action.comps[action.main].duration} fps={60} width={1080} height={1920} defaultProps={{scene: action}} />
    <Composition id="TilesAnim" component={SceneComp} durationInFrames={tilesAnim.comps[tilesAnim.main].duration} fps={60} width={1920} height={1080} defaultProps={{scene: tilesAnim}} />
    <Composition id="ReelCover" component={SceneComp} durationInFrames={reelCover.comps[reelCover.main].duration} fps={60} width={COVER.w} height={COVER.h} defaultProps={{scene: reelCover}} />
    <Composition id="ReelCoverDark" component={SceneComp} durationInFrames={reelCoverDark.comps[reelCoverDark.main].duration} fps={60} width={COVER.w} height={COVER.h} defaultProps={{scene: reelCoverDark}} />
    <Composition id="ReelFrame" component={SceneComp} durationInFrames={1} fps={60} width={COVER.w} height={COVER.h} defaultProps={{scene: reelFrame}} />
    <Composition id="TilesRef" component={SceneComp} durationInFrames={1} fps={60} width={1920} height={1080} defaultProps={{scene: ref}} />
  </>
);
