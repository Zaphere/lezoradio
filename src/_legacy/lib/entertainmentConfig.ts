// @deprecated — archived in Phase 1 (2026-07-14). Config values now in database tables. See docs/DATABASE_ARCHITECTURE.md.
function storageUrl(file: string): string {
  return `/api/content/storage?bucket=introaudio&file=${encodeURIComponent(file)}`;
}

export interface EntertainmentTrack {
  id: string;
  title: string;
  url: string;
  mood: string;
}

export const ENTERTAINMENT_TRACKS: EntertainmentTrack[] = [
  {
    id: 'kumbaya',
    title: 'Kumbaya',
    url: storageUrl('Kumbaya.mp3'),
    mood: 'reflective and communal',
  },
  {
    id: 'familia',
    title: 'Familia',
    url: storageUrl('Familia.mp3'),
    mood: 'warm and uplifting',
  },
  {
    id: 'kumbaya-encore',
    title: 'Kumbaya',
    url: storageUrl('Kumbaya.mp3'),
    mood: 'peaceful and heartfelt',
  },
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function commentaryAfterTrack(track: EntertainmentTrack, stationName: string): string {
  const lines: Record<string, string[]> = {
    kumbaya: [
      `That was ${track.title} here on ${stationName} — a ${track.mood} classic that never loses its power to bring people together.`,
      `Beautiful stuff. ${track.title} has that ${track.mood} quality — perfect for a moment of calm on ${stationName}.`,
      `We hope ${track.title} gave you a breather. That ${track.mood} melody is a favourite with our listeners.`,
    ],
    familia: [
      `${track.title} — now that is a ${track.mood} track. Great choice for our entertainment hour on ${stationName}.`,
      `Loved that one. ${track.title} carries a ${track.mood} energy that fits right in with the ${stationName} vibe.`,
      `That was ${track.title}. A ${track.mood} piece that reminds us what community sounds like.`,
    ],
    'kumbaya-encore': [
      `And once more, ${track.title} — still ${track.mood}, still timeless. Thanks for staying with ${stationName}.`,
      `An encore of ${track.title}. That ${track.mood} sound is the perfect note to wind down this set.`,
    ],
  };

  return pick(lines[track.id] ?? lines.kumbaya);
}

export function introBeforeTrack(next: EntertainmentTrack, stationName: string): string {
  const lines = [
    `Coming up next on ${stationName}, ${next.title}. Lean in — you're going to enjoy this one.`,
    `Stay with us. ${next.title} is up next on ${stationName}.`,
    `Next on the ${stationName} entertainment desk: ${next.title}. Here we go.`,
    `Let's keep the mood going. ${next.title}, live on ${stationName}.`,
  ];
  return pick(lines);
}

export function entertainmentSegmentOpen(stationName: string): string {
  return `You're listening to the ${stationName} entertainment segment. We've lined up some music for you — first up, ${ENTERTAINMENT_TRACKS[0].title}.`;
}

export function entertainmentSegmentClose(stationName: string): string {
  return `That wraps up our music on ${stationName}. Hang tight — we're checking the news feeds for the latest updates.`;
}
