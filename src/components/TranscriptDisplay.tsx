import { useState, useEffect, useRef } from 'react';

interface Props {
  text: string;
  isPlaying: boolean;
  onComplete?: () => void;
}

export default function TranscriptDisplay({ text, isPlaying, onComplete }: Props) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPlaying) {
      setCurrentIndex(0);
      setDisplayedText('');
    } else {
      setDisplayedText(text);
      setCurrentIndex(text.length);
    }
  }, [text, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;

    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, 30);

      return () => clearTimeout(timer);
    }

    onComplete?.();
  }, [currentIndex, text, isPlaying, onComplete]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedText, text, isPlaying]);

  return (
    <div className="glass rounded-2xl p-4 h-64 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Live Transcript
        </h4>
        {isPlaying && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-primary">Speaking</span>
          </div>
        )}
      </div>
      
      <div 
        ref={containerRef}
        className="h-48 overflow-y-auto whitespace-pre-wrap text-sm text-text-primary leading-relaxed"
      >
        {isPlaying ? (
          <>
            {displayedText}
            <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
          </>
        ) : (
          text
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 bg-surface rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(currentIndex / text.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
