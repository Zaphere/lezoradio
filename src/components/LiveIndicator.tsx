interface Props {
  isLive: boolean;
}

export default function LiveIndicator({ isLive }: Props) {
  if (!isLive) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3.5 w-3.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D62828] opacity-75" />
        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#D62828]" />
      </span>
      <span className="text-sm font-bold text-[#D62828] tracking-wider">LIVE</span>
    </div>
  );
}
