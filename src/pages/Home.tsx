import StationGrid from '../components/StationGrid';
import ChannelGrid from '../components/ChannelGrid';

export default function Home() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Radio Dial</h1>
        <p className="text-sm text-text-secondary">Select a country to start listening</p>
      </div>

      <StationGrid />

      <div className="border-t border-border/30 pt-6">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 px-1">
          Global Channels
        </h2>
        <ChannelGrid />
      </div>
    </div>
  );
}
