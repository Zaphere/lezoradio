import StationGrid from '../components/StationGrid';
import ChannelGrid from '../components/ChannelGrid';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-bg-primary transition-colors duration-300">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-8 flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-[32px] font-bold text-[#1A1D23] dark:text-[#F1F5F9] tracking-tight">
            Radiolezo
          </h1>
          <p className="text-base text-[#6B7280] dark:text-[#94A3B8] mt-1">
            Select a DRC region to start listening
          </p>
        </div>

        <div className="bg-white dark:bg-white/6 rounded-3xl border border-[var(--color-border)] dark:border-white/8 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] p-6">
          <StationGrid />
        </div>

        <div className="bg-white dark:bg-white/6 rounded-3xl border border-[var(--color-border)] dark:border-white/8 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] p-6">
          <h2 className="flex items-center justify-center gap-2 text-base font-semibold text-[#6B7280] dark:text-[#94A3B8] mb-4">
            <span>Global Channels</span>
          </h2>
          <ChannelGrid />
        </div>
      </div>
    </div>
  );
}
