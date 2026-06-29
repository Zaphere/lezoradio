interface Props {
  text: string;
  region?: string;
  category?: string;
}

export default function NowPlaying({ text, region, category }: Props) {
  if (!text) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
          <svg className="w-6 h-6 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 012.828-2.828" />
          </svg>
        </div>
        <p className="text-text-secondary text-sm">Awaiting broadcast…</p>
        <p className="text-text-secondary/50 text-xs mt-1">Stand by for the next transmission</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5 animate-slide-up">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {region && (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
            {region}
          </span>
        )}
        {category && (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 text-text-secondary capitalize">
            {category}
          </span>
        )}
      </div>
      <p className="text-text-primary leading-relaxed text-sm">{text}</p>
    </div>
  );
}
