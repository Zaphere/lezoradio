interface Props {
  isLive: boolean;
}

export default function LiveIndicator({ isLive }: Props) {
  if (!isLive) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-alert opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-alert" />
      </span>
      <span className="text-sm font-semibold text-alert tracking-wider">LIVE</span>
    </div>
  );
}
