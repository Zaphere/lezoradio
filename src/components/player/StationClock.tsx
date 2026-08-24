import type { StationTimeInfo } from '../../lib/types';
import { getTimezoneAbbreviation } from '../../lib/stationTime';

interface Props {
  timeInfo: StationTimeInfo;
}

export default function StationClock({ timeInfo }: Props) {
  const tzAbbr = getTimezoneAbbreviation(timeInfo.timezone);
  return (
    <div className="flex items-center gap-2 text-sm">
      <svg className="w-4 h-4 text-[#00A651]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-mono text-[#111111] dark:text-[#F1F5F9] font-semibold tabular-nums tracking-wider">
        {timeInfo.timeString}
      </span>
      <span className="text-[#555555]/60 dark:text-[#94A3B8]/60 text-xs uppercase tracking-wide">
        {tzAbbr}
      </span>
    </div>
  );
}
