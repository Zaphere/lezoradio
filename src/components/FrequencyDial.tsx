import { useRef, useState, useCallback, useEffect } from 'react';
import { CHANNELS, MIN_FREQ, MAX_FREQ, snapFrequency } from '../lib/channels';
import { playDialClick } from '../lib/audio';

interface Props {
  frequency: string;
  isActive: boolean;
  tunerSoundEnabled?: boolean;
  onChange?: (freq: string) => void;
}

const TICK_COUNT = 24;
const KNOB_SIZE = 160;
const DEBOUNCE_MS = 200;

const FREQ_RANGE = MAX_FREQ - MIN_FREQ;
const ANGLE_RANGE = 300;

function freqToAngle(f: number): number {
  const ratio = (f - MIN_FREQ) / FREQ_RANGE;
  return -ANGLE_RANGE / 2 + ratio * ANGLE_RANGE;
}

function freqToRatio(f: number): number {
  return (f - MIN_FREQ) / FREQ_RANGE;
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = {
    x: cx + r * Math.cos((startAngle * Math.PI) / 180),
    y: cy + r * Math.sin((startAngle * Math.PI) / 180),
  };
  const end = {
    x: cx + r * Math.cos((endAngle * Math.PI) / 180),
    y: cy + r * Math.sin((endAngle * Math.PI) / 180),
  };
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function FrequencyDial({ frequency, isActive, tunerSoundEnabled = false, onChange }: Props) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragFreq, setDragFreq] = useState(parseFloat(frequency));
  const [snapping, setSnapping] = useState(false);
  const [hover, setHover] = useState(false);

  const dragState = useRef<{ startAngle: number; startFreq: number } | null>(null);
  const currentFreqRef = useRef(parseFloat(frequency));
  const dragFreqRef = useRef(dragFreq);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnappedRef = useRef<string>(frequency);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!isDragging) {
      const snapped = snapFrequency(parseFloat(frequency));
      currentFreqRef.current = parseFloat(snapped);
      lastSnappedRef.current = snapped;
      setDragFreq(currentFreqRef.current);
    }
  }, [frequency, isDragging]);

  const angle = freqToAngle(isDragging ? dragFreq : currentFreqRef.current);
  const ratio = freqToRatio(isDragging ? dragFreq : currentFreqRef.current);

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
    const snapped = snapFrequency(clamped);
    dragFreqRef.current = parseFloat(snapped);
    setDragFreq(dragFreqRef.current);

    if (snapped !== lastSnappedRef.current) {
      lastSnappedRef.current = snapped;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        onChangeRef.current?.(snapped);
      }, DEBOUNCE_MS);
    }
  }, []);

  const handleEnd = useCallback(() => {
    if (!dragState.current) return;
    setIsDragging(false);
    setSnapping(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const snapped = snapFrequency(dragFreqRef.current);
    if (tunerSoundEnabled) playDialClick();
    currentFreqRef.current = parseFloat(snapped);
    lastSnappedRef.current = snapped;
    setDragFreq(currentFreqRef.current);
    onChangeRef.current?.(snapped);
    setTimeout(() => setSnapping(false), 200);
    dragState.current = null;
  }, [tunerSoundEnabled]);

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
    <div className="flex flex-col items-center select-none touch-none"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        ref={knobRef}
        className="relative"
        style={{ width: KNOB_SIZE, height: KNOB_SIZE }}
      >
        {/* Frequency indicator arc — rotates with dial */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 160 160">
          <path
            d={describeArc(80, 80, 74, -150 + ratio * 300 - 15, -150 + ratio * 300 + 15)}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity={isActive ? 0.8 : 0.12}
            className="transition-all duration-300 ease-out"
          />
        </svg>

        {/* Outer ring with tick marks */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 160">
          {Array.from({ length: TICK_COUNT }, (_, i) => {
            const tickAngle = (i / TICK_COUNT) * 360 - 90;
            const outerR = 76;
            const innerR = i % 4 === 0 ? 66 : 71;
            const x1 = 80 + outerR * Math.cos((tickAngle * Math.PI) / 180);
            const y1 = 80 + outerR * Math.sin((tickAngle * Math.PI) / 180);
            const x2 = 80 + innerR * Math.cos((tickAngle * Math.PI) / 180);
            const y2 = 80 + innerR * Math.sin((tickAngle * Math.PI) / 180);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                className={isActive ? 'stroke-primary' : 'stroke-border'}
                strokeWidth={i % 4 === 0 ? 2 : 1}
                opacity={i % 4 === 0 ? 0.8 : 0.35}
                style={{ transition: 'stroke 0.3s' }}
              />
            );
          })}
        </svg>

        {/* Knob body */}
        <div
          className={`absolute rounded-full cursor-grab active:cursor-grabbing ${
            isDragging ? 'shadow-xl shadow-black/30' : hover ? 'shadow-lg shadow-black/25' : 'shadow-md shadow-black/20'
          }`}
          style={{
            width: 100,
            height: 100,
            left: 30,
            top: 30,
            background: isActive
              ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
              : 'var(--color-surface)',
            border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
            transform: `rotate(${angle}deg)`,
            transition: snapping
              ? 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease'
              : 'box-shadow 0.2s ease',
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
              height: '42%',
              background: isActive
                ? 'linear-gradient(to bottom, var(--color-primary), transparent)'
                : 'linear-gradient(to bottom, var(--color-text-secondary), transparent)',
              transform: 'translateX(-50%)',
              transition: 'background 0.3s',
            }}
          />
          {/* Center dot */}
          <div
            className="absolute w-3 h-3 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              background: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              opacity: isActive ? 1 : 0.3,
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
            className={`text-3xl font-bold font-mono tracking-tight transition-colors ${
              isActive ? 'text-primary' : 'text-text-secondary'
            }`}
          >
            {displayFreq}
          </div>
          <div className="text-xs text-text-secondary mt-0.5 font-medium">FM</div>
        </div>
      </div>

      {/* Channel name below dial — clean text only, no emoji here */}
      <div className="mt-4 text-center min-h-[2rem]">
        {channel ? (
          <div className={`text-sm font-semibold transition-colors ${
            isActive ? 'text-text-primary' : 'text-text-secondary'
          }`}>
            {channel.name}
          </div>
        ) : (
          <div className="text-xs text-text-secondary">
            {isDragging ? 'Tuning...' : '--'}
          </div>
        )}
      </div>
    </div>
  );
}
