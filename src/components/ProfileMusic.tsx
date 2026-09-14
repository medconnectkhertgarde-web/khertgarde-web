import { useCallback, useEffect, useRef, useState } from "react";
import { Music2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";

import type { PortfolioMusicTrack } from "@/lib/portfolio-music";

interface YouTubePlayerEvent {
  data: number;
  target: YouTubePlayer;
}

interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  destroy(): void;
}

interface YouTubePlayerConstructorOptions {
  videoId: string;
  host?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: YouTubePlayerEvent) => void;
    onStateChange?: (event: YouTubePlayerEvent) => void;
    onAutoplayBlocked?: () => void;
    onError?: () => void;
  };
}

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, options: YouTubePlayerConstructorOptions) => YouTubePlayer;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    if (existing) {
      existing.addEventListener("error", () => reject(new Error("YouTube player failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener("error", () => reject(new Error("YouTube player failed to load")), { once: true });
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

export function ProfileMusic({ tracks }: { tracks: PortfolioMusicTrack[] }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shouldPlay, setShouldPlay] = useState(false);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const currentIndexRef = useRef(0);

  const currentTrack = tracks[currentIndex] ?? tracks[0] ?? null;

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (currentIndex >= tracks.length && tracks.length > 0) setCurrentIndex(0);
  }, [currentIndex, tracks.length]);

  const selectTrack = useCallback(
    (nextIndex: number, autoPlay = true) => {
      if (!tracks.length) return;
      const normalized = (nextIndex + tracks.length) % tracks.length;
      const nextTrack = tracks[normalized];
      setCurrentIndex(normalized);
      setShouldPlay(autoPlay);
      setPlayerError(false);

      if (playerRef.current && nextTrack) {
        if (autoPlay) playerRef.current.loadVideoById(nextTrack.youtube_video_id);
        else playerRef.current.cueVideoById(nextTrack.youtube_video_id);
      }
    },
    [tracks],
  );

  useEffect(() => {
    if (!open || !currentTrack || !mountRef.current || playerRef.current) return;

    let cancelled = false;

    void loadYouTubeIframeApi()
      .then(() => {
        if (cancelled || !mountRef.current || !window.YT?.Player) return;

        playerRef.current = new window.YT.Player(mountRef.current, {
          videoId: currentTrack.youtube_video_id,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            controls: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              setPlayerReady(true);
              if (shouldPlay) event.target.playVideo();
            },
            onStateChange: (event) => {
              if (cancelled || !window.YT) return;
              setPlaying(event.data === window.YT.PlayerState.PLAYING);
              if (event.data === window.YT.PlayerState.ENDED && tracks.length > 1) {
                selectTrack(currentIndexRef.current + 1, true);
              }
            },
            onAutoplayBlocked: () => {
              if (!cancelled) {
                setPlaying(false);
                setShouldPlay(false);
              }
            },
            onError: () => {
              if (!cancelled) {
                setPlaying(false);
                setPlayerError(true);
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setPlayerError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack, open, selectTrack, shouldPlay, tracks.length]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  if (!tracks.length || !currentTrack) return null;

  function togglePlayback() {
    setOpen(true);
    setShouldPlay(!playing);
    setPlayerError(false);

    if (!playerRef.current || !playerReady) return;
    if (playing) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  }

  function closePlayer() {
    playerRef.current?.destroy();
    playerRef.current = null;
    setPlayerReady(false);
    setPlaying(false);
    setShouldPlay(false);
    setOpen(false);
  }

  return (
    <div className="profile-music">
      <button
        type="button"
        className={`profile-music-button${playing ? " is-playing" : ""}`}
        onClick={togglePlayback}
        aria-label={playing ? "Pause profile music" : "Play profile music"}
        title={playing ? "Pause music" : "Play music"}
      >
        <span className="profile-music-icon" aria-hidden="true">
          {playing ? <Pause /> : <Play />}
        </span>
        <span className="profile-music-equalizer" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>

      {open ? (
        <div className="profile-music-panel" aria-label="YouTube music player">
          <div className="profile-music-panel-header">
            <div>
              <span className="profile-music-source"><Music2 aria-hidden="true" /> YouTube</span>
              <strong>{currentTrack.title || "Profile music"}</strong>
            </div>
            <button type="button" className="icon-button" onClick={closePlayer} aria-label="Close music player">
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="profile-youtube-player">
            {playerError ? (
              <div className="profile-music-error">
                This YouTube video could not be played here. Try another video in the admin panel.
              </div>
            ) : (
              <div ref={mountRef} className="profile-youtube-mount" />
            )}
          </div>

          <div className="profile-music-controls">
            {tracks.length > 1 ? (
              <button type="button" className="icon-button" onClick={() => selectTrack(currentIndex - 1, true)} aria-label="Previous track">
                <SkipBack aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" className="profile-music-inline-control" onClick={togglePlayback}>
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {playing ? "Pause" : "Play"}
            </button>
            {tracks.length > 1 ? (
              <button type="button" className="icon-button" onClick={() => selectTrack(currentIndex + 1, true)} aria-label="Next track">
                <SkipForward aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
