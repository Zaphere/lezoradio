import StationGrid from '../components/StationGrid';
import ChannelGrid from '../components/ChannelGrid';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-bg-primary via-[#0F1225] to-[#1A0F1F] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-4 flex flex-col gap-3">
        <div className="text-center">
          <h1 className="text-xl font-bold text-text-primary mb-0.5 tracking-tight">
            Radiolezo
          </h1>
          <p className="text-[11px] text-text-secondary">Select a DRC region to start listening</p>
        </div>

        <div className="glass rounded-2xl p-4">
          <StationGrid />
        </div>

        <div className="glass rounded-2xl p-4">
          <h2 className="flex items-center justify-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            <span>📡</span>
            <span>Global Channels</span>
          </h2>
          <ChannelGrid />
        </div>
      </div>
    </div>
  );
}
