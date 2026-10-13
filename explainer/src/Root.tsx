import React from 'react';
import {AbsoluteFill, Composition, continueRender, delayRender, staticFile, useCurrentFrame} from 'remotion';
import {buildTestScene} from './film/testScene';
import {buildReferenceScene, buildTileAnimScene} from './film/editorial/reference';
import {buildEditorialScene} from './film/editorial/film';
import {buildReelCoverDarkScene, buildReelCoverScene, buildReelFrameScene, COVER} from './film/editorial/reelCover';
import {buildOneLineScene} from './film/oneline/film';
import {buildTimelineScene} from './film/timeline/film';
import {buildActionScene} from './film/action/film';
import {buildAction2Scene} from './film/action2/film';
import {buildAction3Scene} from './film/action3/film';
import {buildAction4Scene} from './film/action4/film';
import {loadFonts} from './fonts';
import {MotionBlur} from './render/MotionBlur';
import {SceneFrame} from './render/SceneRenderer';
import type {Scene} from './scene/types';

/** Image layers: hold the render until every image of the scene has decoded. */
function usePreloadImages(scene: Scene) {
  const files = React.useMemo(() => [...new Set(Object.values(scene.comps).flatMap((c) => c.layers.flatMap((l) => (l.kind === 'image' ? [l.file] : []))))], [scene]);
  const [handle] = React.useState(() => (files.length ? delayRender(`images (${files.length})`) : null));
  React.useEffect(() => {
    if (handle === null) return;
    Promise.all(files.map((f) => new Promise<void>((ok, fail) => {
      const im = new Image();
      im.onload = () => im.decode().then(() => ok(), () => ok());
      im.onerror = () => fail(new Error(`image failed: ${f}`));
      im.src = staticFile(f);
    }))).then(() => continueRender(handle));
  }, [files, handle]);
}

const SceneComp: React.FC<{scene: Scene}> = ({scene}) => {
  loadFonts(scene.fonts);
  usePreloadImages(scene);
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
const oneLineV = buildOneLineScene(true);
const timeline = buildTimelineScene();
const action = buildActionScene();
const action2 = buildAction2Scene();
const action3 = buildAction3Scene();
const action4 = buildAction4Scene();
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
    <Composition id="OneLine9x16" component={SceneComp} durationInFrames={oneLineV.comps[oneLineV.main].duration} fps={60} width={1080} height={1920} defaultProps={{scene: oneLineV}} />
    <Composition id="Timeline" component={SceneComp} durationInFrames={timeline.comps[timeline.main].duration} fps={60} width={1920} height={1080} defaultProps={{scene: timeline}} />
    <Composition id="ActionTaker" component={SceneComp} durationInFrames={action.comps[action.main].duration} fps={60} width={1080} height={1920} defaultProps={{scene: action}} />
    <Composition id="ActionTakerV2" component={SceneComp} durationInFrames={action2.comps[action2.main].duration} fps={60} width={1080} height={1920} defaultProps={{scene: action2}} />
    <Composition id="ActionTakerV3" component={SceneComp} durationInFrames={action3.comps[action3.main].duration} fps={60} width={1080} height={1920} defaultProps={{scene: action3}} />
    <Composition id="ActionTakerV4" component={SceneComp} durationInFrames={action4.comps[action4.main].duration} fps={60} width={1080} height={1920} defaultProps={{scene: action4}} />
    <Composition id="TilesAnim" component={SceneComp} durationInFrames={tilesAnim.comps[tilesAnim.main].duration} fps={60} width={1920} height={1080} defaultProps={{scene: tilesAnim}} />
    <Composition id="ReelCover" component={SceneComp} durationInFrames={reelCover.comps[reelCover.main].duration} fps={60} width={COVER.w} height={COVER.h} defaultProps={{scene: reelCover}} />
    <Composition id="ReelCoverDark" component={SceneComp} durationInFrames={reelCoverDark.comps[reelCoverDark.main].duration} fps={60} width={COVER.w} height={COVER.h} defaultProps={{scene: reelCoverDark}} />
    <Composition id="ReelFrame" component={SceneComp} durationInFrames={1} fps={60} width={COVER.w} height={COVER.h} defaultProps={{scene: reelFrame}} />
    <Composition id="TilesRef" component={SceneComp} durationInFrames={1} fps={60} width={1920} height={1080} defaultProps={{scene: ref}} />
  </>
);
