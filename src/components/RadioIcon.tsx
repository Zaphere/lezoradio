interface Props {
  className?: string;
  active?: boolean;
}

export default function RadioIcon({ className = 'w-10 h-10', active = false }: Props) {
  return (
    <svg
      className={`${className} ${active ? 'text-primary' : 'text-text-secondary'}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Tower base */}
      <path d="M12 10v12" />
      <path d="M9 22l3-12 3 12" />
      <path d="M10.5 16h3" />
      
      {/* Beacon tip */}
      <circle 
        cx="12" 
        cy="8" 
        r="1" 
        fill="currentColor" 
      />
      
      {/* Waves left and right */}
      <path 
        d="M12 3a5 5 0 0 0-5 5" 
        opacity={active ? 1 : 0.4}
      />
      <path 
        d="M17 8a5 5 0 0 0-5-5" 
        opacity={active ? 1 : 0.4}
      />
      <path 
        d="M12 1a7 7 0 0 0-7 7" 
        opacity={active ? 0.7 : 0.2}
      />
      <path 
        d="M19 8a7 7 0 0 0-7-7" 
        opacity={active ? 0.7 : 0.2}
      />
    </svg>
  );
}

