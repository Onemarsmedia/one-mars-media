'use client';

import { useEffect, useRef, useState } from 'react';

// 54-second explainer: poster frame with a play button; one click starts it with sound.
// Files are versioned (public/video is cached as immutable), so a new cut ships as -v6.
const SRC = '/video/onemarsmedia-360-v5.mp4';
const SRC_720 = '/video/onemarsmedia-360-720-v5.mp4'; // phones: same film at 720p, under half the size
const POSTER = '/video/onemarsmedia-360-poster-v5.webp';
const CAPTIONS = '/video/onemarsmedia-360-v5.en.vtt';

export default function ExplainerVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const attempt = useRef(0);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  // A source error can fire before hydration, when no handler is attached yet: check once on mount.
  useEffect(() => {
    const video = videoRef.current;
    if (video && (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE)) setFailed(true);
  }, []);

  // Keyboard and screen-reader users land on the player (and its controls) once it starts,
  // and back on the button if it fails.
  useEffect(() => {
    if (started) videoRef.current?.focus();
  }, [started]);
  useEffect(() => {
    if (failed) buttonRef.current?.focus();
  }, [failed]);

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    const id = ++attempt.current;
    if (failed) video.load(); // a failed element stays failed until it reloads its source
    setFailed(false);
    setStarted(true);
    video.play().catch((err: DOMException) => {
      // load() aborts the previous attempt's pending play(); only the current attempt counts
      if (id === attempt.current && err.name !== 'AbortError') setStarted(false);
    });
  };

  const onError = () => {
    attempt.current++;
    setStarted(false);
    setFailed(true);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-white/10 bg-[#F1ECE2] shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
      {/* After the end the last frame (the credits) stays up; the native controls offer replay. */}
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
        <source src={SRC_720} type="video/mp4" media="(max-width: 800px)" />
        <source src={SRC} type="video/mp4" onError={onError} />
        <track src={CAPTIONS} kind="captions" srcLang="en" label="English" />
        Your browser does not support the video tag.
      </video>
      <p role="status" className="sr-only">
        {failed ? 'The video could not load.' : ''}
      </p>
      {!started && (
        <button
          ref={buttonRef}
          type="button"
          onClick={play}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-3 focus-visible:outline-none"
        >
          <span className="flex items-center gap-2 rounded-full bg-[#121110] px-4 py-2.5 text-white shadow-lg transition-transform group-hover:scale-105 group-focus-visible:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-[#FF4A1C] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[#121110] sm:gap-3 sm:px-6 sm:py-4">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current sm:h-6 sm:w-6">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
            <span className="text-sm font-semibold sm:text-base">
              {failed ? 'Try again' : 'Watch · 0:54'}
              <span className="sr-only"> the Onemarsmedia explainer, 54 seconds, with sound</span>
            </span>
          </span>
          {failed && (
            <span aria-hidden="true" className="rounded-full bg-[#F1ECE2]/90 px-3 py-1 text-xs text-[#121110] sm:text-sm">
              The video could not load.
            </span>
          )}
        </button>
      )}
    </div>
  );
}
