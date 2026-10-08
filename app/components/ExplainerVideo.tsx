'use client';

import { useEffect, useRef, useState } from 'react';

// 42-second explainer: poster frame with a play button; one click starts it with sound.
// Files are versioned (public/ is served without long caching), so a new cut ships as -v4.
const SRC = '/video/onemarsmedia-360-v3.mp4';
const POSTER = '/video/onemarsmedia-360-poster-v3.webp';
const CAPTIONS = '/video/onemarsmedia-360-v3.en.vtt';

export default function ExplainerVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  // Keyboard and screen-reader users land on the player (and its controls) once it starts.
  useEffect(() => {
    if (started) videoRef.current?.focus();
  }, [started]);

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    setFailed(false);
    setStarted(true);
    video.play().catch(() => setStarted(false));
  };

  const onError = () => {
    setStarted(false);
    setFailed(true);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-white/10 bg-[#F1ECE2] shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
      {/* After the end the last frame (the sign-off) stays up; the native controls offer replay. */}
      <video
        ref={videoRef}
        className="h-full w-full focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-[#FF4A1C]"
        aria-label="Onemarsmedia explainer video"
        poster={POSTER}
        preload="metadata"
        playsInline
        controls={started}
        tabIndex={started ? 0 : -1}
        onError={onError}
      >
        <source src={SRC} type="video/mp4" onError={onError} />
        <track src={CAPTIONS} kind="captions" srcLang="en" label="English" />
        Your browser does not support the video tag.
      </video>
      {!started && (
        <button
          type="button"
          onClick={play}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-3 focus-visible:outline-none"
        >
          <span className="flex items-center gap-2 rounded-full bg-[#121110] px-4 py-2.5 text-white shadow-lg transition-transform group-hover:scale-105 group-focus-visible:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-[#FF4A1C] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[#F1ECE2] sm:gap-3 sm:px-6 sm:py-4">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current sm:h-6 sm:w-6">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
            <span className="text-sm font-semibold sm:text-base">
              Watch · 0:42<span className="sr-only"> the Onemarsmedia explainer, 42 seconds, with sound</span>
            </span>
          </span>
          {failed && (
            <span role="status" className="rounded-full bg-[#F1ECE2]/90 px-3 py-1 text-xs text-[#121110] sm:text-sm">
              The video could not load. Try again.
            </span>
          )}
        </button>
      )}
    </div>
  );
}
