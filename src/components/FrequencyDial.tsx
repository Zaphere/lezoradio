import { useRef, useState, useCallback, useEffect } from 'react';
import { CHANNELS, MIN_FREQ, MAX_FREQ, snapFrequency } from '../lib/channels';
import { playDialClick } from '../lib/audio';

interface Props {
  frequency: string;
  isActive: boolean;
  onChange?: (freq: string) => void;
}

const TICK_COUNT = 24;
const KNOB_SIZE = 160;

const FREQ_RANGE = MAX_FREQ - MIN_FREQ;
const ANGLE_RANGE = 300;

function freqToAngle(f: number): number {
  const ratio = (f - MIN_FREQ) / FREQ_RANGE;
  return -ANGLE_RANGE / 2 + ratio * ANGLE_RANGE;
}

export default function FrequencyDial({ frequency, isActive, onChange }: Props) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragFreq, setDragFreq] = useState(parseFloat(frequency));
  const [snapping, setSnapping] = useState(false);

  const dragState = useRef<{ startAngle: number; startFreq: number } | null>(null);
  const currentFreqRef = useRef(parseFloat(frequency));

  useEffect(() => {
    if (!isDragging) {
      currentFreqRef.current = parseFloat(frequency);
      setDragFreq(parseFloat(frequency));
    }
  }, [frequency, isDragging]);

  const angle = freqToAngle(isDragging ? dragFreq : currentFreqRef.current);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    const el = knobRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
    dragState.current = { startAngle, startFreq: currentFreqRef.current };
    setIsDragging(true);
  }, []);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!dragState.current) return;
    const el = knobRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let currentAngle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);

    let delta = currentAngle - dragState.current.startAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const raw = dragState.current.startFreq + (delta / ANGLE_RANGE) * FREQ_RANGE;
    const clamped = Math.min(MAX_FREQ, Math.max(MIN_FREQ, raw));
    setDragFreq(clamped);
  }, []);

  const handleEnd = useCallback(() => {
    if (!dragState.current) return;
    setIsDragging(false);
    setSnapping(true);
    const snapped = snapFrequency(dragFreq);
    playDialClick();
    currentFreqRef.current = parseFloat(snapped);
    setDragFreq(currentFreqRef.current);
    onChange?.(snapped);
    setTimeout(() => setSnapping(false), 200);
    dragState.current = null;
  }, [dragFreq, onChange]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  }, [handleStart]);

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onMouseUp = () => handleEnd();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  useEffect(() => {
    if (!isDragging) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      handleMove(t.clientX, t.clientY);
    };
    const onTouchEnd = () => handleEnd();
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  const displayFreq = isDragging ? dragFreq.toFixed(1) : frequency;
  const channel = CHANNELS.find(c => c.frequency === displayFreq);

  return (
    <div className="flex flex-col items-center select-none">
      <div
        ref={knobRef}
        className="relative"
        style={{ width: KNOB_SIZE, height: KNOB_SIZE }}
      >
        {/* Outer ring with tick marks */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 160 160"
        >
          {Array.from({ length: TICK_COUNT }, (_, i) => {
            const tickAngle = (i / TICK_COUNT) * 360 - 90;
            const outerR = 76;
            const innerR = i % 4 === 0 ? 68 : 72;
            const x1 = 80 + outerR * Math.cos((tickAngle * Math.PI) / 180);
            const y1 = 80 + outerR * Math.sin((tickAngle * Math.PI) / 180);
            const x2 = 80 + innerR * Math.cos((tickAngle * Math.PI) / 180);
            const y2 = 80 + innerR * Math.sin((tickAngle * Math.PI) / 180);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isActive ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                strokeWidth={i % 4 === 0 ? 2 : 1}
                opacity={i % 4 === 0 ? 0.8 : 0.4}
                style={{ transition: 'stroke 0.3s' }}
              />
            );
          })}
        </svg>

        {/* Knob body */}
        <div
          className={`absolute rounded-full cursor-grab active:cursor-grabbing transition-shadow ${
            isDragging ? 'shadow-xl' : 'shadow-lg'
          }`}
          style={{
            width: 110,
            height: 110,
            left: 25,
            top: 25,
            background: isActive
              ? 'radial-gradient(circle at 40% 35%, hsl(var(--primary)/0.15), hsl(var(--surface)) 70%)'
              : 'radial-gradient(circle at 40% 35%, hsl(var(--surface-light)), hsl(var(--surface)))',
            border: `2px solid ${isActive ? 'hsl(var(--primary)/0.4)' : 'hsl(var(--border))'}`,
            transform: `rotate(${angle}deg)`,
            transition: snapping ? 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
          }}
          onMouseDown={onMouseDown}
          onTouchStart={(e) => {
            const t = e.touches[0];
            handleStart(t.clientX, t.clientY);
          }}
        >
          {/* Indicator line */}
          <div
            className="absolute left-1/2 top-0 w-0.5 rounded-full"
            style={{
              height: '40%',
              background: isActive
                ? 'linear-gradient(to bottom, hsl(var(--primary)), transparent)'
                : 'linear-gradient(to bottom, hsl(var(--text-secondary)/0.5), transparent)',
              transform: 'translateX(-50%)',
              transition: 'background 0.3s',
            }}
          />
          {/* Center dot */}
          <div
            className="absolute w-3 h-3 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              background: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary)/0.3)',
              transition: 'background 0.3s',
            }}
          />
        </div>

        {/* Frequency display overlay */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <div
            className={`text-3xl font-bold font-mono transition-colors ${
              isActive ? 'text-primary' : 'text-text-secondary'
            }`}
          >
            {displayFreq}
          </div>
          <div className="text-xs text-text-secondary mt-0.5">FM</div>
        </div>

        {/* Active glow */}
        {isActive && (
          <div
            className="absolute rounded-full animate-pulse"
            style={{
              top: -4, left: -4, right: -4, bottom: -4,
              border: '2px solid hsl(var(--primary)/0.15)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Channel name below dial */}
      <div className="mt-3 text-center min-h-[2.5rem]">
        {channel ? (
          <>
            <div className="text-2xl">{channel.emoji}</div>
            <div className={`text-sm font-semibold mt-1 transition-colors ${
              isActive ? 'text-text-primary' : 'text-text-secondary'
            }`}>
              {channel.name}
            </div>
          </>
        ) : (
          <div className="text-xs text-text-secondary mt-1">
            {isDragging ? 'Keep tuning...' : '--'}
          </div>
        )}
      </div>
    </div>
  );
}
