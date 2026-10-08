'use client';

import { useRef, useState } from 'react';

// 30-second explainer: poster frame with a play button; one click starts it with sound.
// Files are versioned (public/ is served without long caching), so a new cut ships as -v2.
const SRC = '/video/onemarsmedia-360-v1.mp4';
const POSTER = '/video/onemarsmedia-360-poster-v1.jpg';
const CAPTIONS = '/video/onemarsmedia-360-v1.en.vtt';

export default function ExplainerVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    video.play().catch(() => setStarted(false));
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-white/10 bg-[#F1ECE2] shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
      <video
        ref={videoRef}
        className="h-full w-full"
        poster={POSTER}
        preload="metadata"
        playsInline
        controls={started}
        onEnded={() => setStarted(false)}
      >
        <source src={SRC} type="video/mp4" />
        <track src={CAPTIONS} kind="captions" srcLang="en" label="English" />
        Your browser does not support the video tag.
      </video>
      {!started && (
        <button
          type="button"
          onClick={play}
          aria-label="Play the Onemarsmedia explainer video (30 seconds, with sound)"
          className="group absolute inset-0 flex items-center justify-center"
        >
          <span className="flex items-center gap-2 rounded-full bg-[#121110] px-4 py-2.5 text-white shadow-lg transition-transform group-hover:scale-105 group-focus-visible:scale-105 sm:gap-3 sm:px-6 sm:py-4">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current sm:h-6 sm:w-6">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
            <span className="text-sm font-semibold sm:text-base">Watch · 0:30</span>
          </span>
        </button>
      )}
    </div>
  );
}
