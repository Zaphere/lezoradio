import type { PlaybackState } from '../../lib/types';

interface Props {
  state: PlaybackState;
  hasPlaylist: boolean;
  isIntroActive: boolean;
  onPlay: () => void;
  onStop: () => void;
  onSkipNext: () => void;
  onSkipIntro: () => void;
  disabled?: boolean;
}

export default function VoicePlayer({
  state,
  hasPlaylist,
  isIntroActive,
  onPlay,
  onStop,
  onSkipNext,
  onSkipIntro,
  disabled,
}: Props) {
  const isActive = state !== 'idle' || isIntroActive;

  const iconBtn =
    'w-11 h-11 rounded-xl bg-white/10 text-text-primary hover:bg-white/20 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Voice Reader</h4>
        {isIntroActive && (
          <button
            onClick={onSkipIntro}
            className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            Skip Intro
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        {state === 'idle' && !isIntroActive ? (
          <button
            onClick={onPlay}
            disabled={disabled}
            className="flex-1 py-4 rounded-2xl bg-primary text-white text-sm font-bold 
                       shadow-lg shadow-primary/30 transition-all cursor-pointer 
                       hover:bg-primary-dark disabled:opacity-30 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play News
          </button>
        ) : (
          <>
            <button onClick={onStop} className="flex-1 py-3 rounded-2xl bg-alert/20 text-alert hover:bg-alert/30 text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
              Stop
            </button>

            <button onClick={onSkipNext} disabled={!hasPlaylist} className={iconBtn} title="Next story">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 18h2V6h-2v12zm-11-7l8.5-6v12l-8.5-6z" />
              </svg>
            </button>
          </>
        )}
      </div>

      {isActive && (
        <p className="text-center text-[10px] text-text-secondary">
          {isIntroActive ? 'Intro playing…' : 'On air — playing through unplayed stories'}
        </p>
      )}
    </div>
  );
}
