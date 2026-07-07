import type { StationTimeInfo } from '../../lib/types';
import { getTimezoneAbbreviation } from '../../lib/stationTime';

interface Props {
  timeInfo: StationTimeInfo;
}

export default function StationClock({ timeInfo }: Props) {
  const tzAbbr = getTimezoneAbbreviation(timeInfo.timezone);
  return (
    <div className="flex items-center gap-2 text-xs">
      <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-mono text-text-primary font-medium tabular-nums tracking-wider">
        {timeInfo.timeString}
      </span>
      <span className="text-text-secondary/60 text-[10px] uppercase tracking-wide">
        {tzAbbr}
      </span>
    </div>
  );
}
