interface Props {
  onSimulateNews: () => void;
  onTriggerAlert: () => void;
  onReset: () => void;
}

export default function TestControls({ onSimulateNews, onTriggerAlert, onReset }: Props) {
  return (
    <div className="glass rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Test Controls</h4>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onSimulateNews}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <span className="text-[10px] font-medium">News</span>
        </button>
        <button
          onClick={onTriggerAlert}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-alert/10 text-alert hover:bg-alert/20 transition-all cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-[10px] font-medium">Alert</span>
        </button>
        <button
          onClick={onReset}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/10 text-text-secondary hover:bg-white/20 transition-all cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-[10px] font-medium">Reset</span>
        </button>
      </div>
    </div>
  );
}
