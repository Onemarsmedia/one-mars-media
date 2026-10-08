import React from 'react';
import {AbsoluteFill} from 'remotion';

// Camera motion blur centred on the frame, matching After Effects with shutter phase = -angle/2:
// the exposure spans [t - angle/720, t + angle/720] frames, sampled evenly and averaged.
// Averaging is progressive with plain alpha: sample i goes over the first i samples at opacity
// 1/(i+1), so the stack equals their mean. Every sample is opaque (it carries the comp background).
// (Additive blending with opacity 1/n tints the result in Chromium, so it is not used.)
export const MotionBlur: React.FC<{t: number; shutterAngle: number; samples: number; render: (t: number, sample: number) => React.ReactNode}> = ({t, shutterAngle, samples, render}) => {
  if (samples <= 1 || shutterAngle <= 0) return <>{render(t, 0)}</>;
  const span = shutterAngle / 360;
  return (
    <AbsoluteFill>
      {Array.from({length: samples}, (_, i) => {
        const ts = t - span / 2 + (span * (i + 0.5)) / samples;
        return (
          <AbsoluteFill key={i} style={{opacity: 1 / (i + 1)}}>
            {render(ts, i)}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
