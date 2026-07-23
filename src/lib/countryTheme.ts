// lib/countryTheme.ts
//
// Generates a country-flavoured colour theme (primary / secondary / accent / glow)
// so each station's Radio page picks up that nation's own palette instead of
// one flat brand colour for every country.
//
// Usage:
//   const theme = getCountryTheme(station.country_code, station.name, drcRegion?.slug);
//   <div style={{ '--c-primary': theme.primary, ... } as React.CSSProperties}>

export interface CountryTheme {
    /** Main accent — buttons, dial ring, live pulse */
    primary: string;
    /** Secondary accent — gradients, badges */
    secondary: string;
    /** Tertiary accent — highlights, glows */
    accent: string;
    /** rgba/hsla glow used in box-shadows */
    glow: string;
    /** css gradient string for hero backgrounds */
    gradient: string;
}

// Curated palettes pulled from national flag colours. Extend freely —
// anything missing falls back to a deterministic, still-tasteful
// generated palette (see generateTheme below).
const CURATED: Record<string, CountryTheme> = {
    CD: { // DR Congo — sky blue / flag yellow / flag red
        primary: '#0077C8',
        secondary: '#F7D618',
        accent: '#CE1021',
        glow: 'rgba(0, 119, 200, 0.38)',
        gradient: 'linear-gradient(135deg, #0077C8 0%, #F7D618 55%, #CE1021 100%)',
    },
    CG: { // Congo-Brazzaville
        primary: '#009543',
        secondary: '#FBDE4A',
        accent: '#DC241F',
        glow: 'rgba(0, 149, 67, 0.35)',
        gradient: 'linear-gradient(135deg, #009543 0%, #FBDE4A 55%, #DC241F 100%)',
    },
    NG: {
        primary: '#008751',
        secondary: '#00B96B',
        accent: '#EFEFEF',
        glow: 'rgba(0, 135, 81, 0.35)',
        gradient: 'linear-gradient(135deg, #006B3F 0%, #00B96B 100%)',
    },
    KE: {
        primary: '#BB0000',
        secondary: '#006600',
        accent: '#E4E4E4',
        glow: 'rgba(187, 0, 0, 0.3)',
        gradient: 'linear-gradient(135deg, #111111 0%, #BB0000 55%, #006600 100%)',
    },
    ZA: {
        primary: '#007A4D',
        secondary: '#FFB612',
        accent: '#DE3831',
        glow: 'rgba(0, 122, 77, 0.35)',
        gradient: 'linear-gradient(135deg, #007A4D 0%, #FFB612 55%, #DE3831 100%)',
    },
    GH: {
        primary: '#006B3F',
        secondary: '#FCD116',
        accent: '#CE1126',
        glow: 'rgba(252, 209, 22, 0.3)',
        gradient: 'linear-gradient(135deg, #006B3F 0%, #FCD116 55%, #CE1126 100%)',
    },
    FR: {
        primary: '#0055A4',
        secondary: '#E7E7E7',
        accent: '#EF4135',
        glow: 'rgba(0, 85, 164, 0.35)',
        gradient: 'linear-gradient(135deg, #0055A4 0%, #EF4135 100%)',
    },
    US: {
        primary: '#3C3B6E',
        secondary: '#E7E7E7',
        accent: '#B22234',
        glow: 'rgba(178, 34, 52, 0.3)',
        gradient: 'linear-gradient(135deg, #3C3B6E 0%, #B22234 100%)',
    },
    GB: {
        primary: '#012169',
        secondary: '#E7E7E7',
        accent: '#C8102E',
        glow: 'rgba(1, 33, 105, 0.35)',
        gradient: 'linear-gradient(135deg, #012169 0%, #C8102E 100%)',
    },
    BR: {
        primary: '#009739',
        secondary: '#FEDD00',
        accent: '#012169',
        glow: 'rgba(0, 151, 57, 0.35)',
        gradient: 'linear-gradient(135deg, #009739 0%, #FEDD00 55%, #012169 100%)',
    },
    RW: {
        primary: '#00A1DE',
        secondary: '#FAD201',
        accent: '#009A44',
        glow: 'rgba(0, 161, 222, 0.35)',
        gradient: 'linear-gradient(135deg, #00A1DE 0%, #FAD201 55%, #009A44 100%)',
    },
    UG: {
        primary: '#FCDC04',
        secondary: '#D90000',
        accent: '#111111',
        glow: 'rgba(252, 220, 4, 0.3)',
        gradient: 'linear-gradient(135deg, #111111 0%, #FCDC04 50%, #D90000 100%)',
    },
    TZ: {
        primary: '#1EB53A',
        secondary: '#FCD116',
        accent: '#00A3DD',
        glow: 'rgba(30, 181, 58, 0.35)',
        gradient: 'linear-gradient(135deg, #1EB53A 0%, #FCD116 50%, #00A3DD 100%)',
    },
    ZM: {
        primary: '#198A00',
        secondary: '#EF7D00',
        accent: '#DE2010',
        glow: 'rgba(25, 138, 0, 0.35)',
        gradient: 'linear-gradient(135deg, #198A00 0%, #EF7D00 55%, #DE2010 100%)',
    },
    AO: {
        primary: '#CC092F',
        secondary: '#111111',
        accent: '#FFCB00',
        glow: 'rgba(204, 9, 47, 0.35)',
        gradient: 'linear-gradient(135deg, #CC092F 0%, #111111 60%, #FFCB00 100%)',
    },
};

// DRC regional accent overrides — used on the DRC region pages, which
// carry no country_code of their own (keyed by region slug instead).
const DRC_REGION_ACCENTS: Record<string, Partial<CountryTheme>> = {
    kinshasa: { primary: '#0077C8', accent: '#CE1021' },
    lubumbashi: { primary: '#F7D618', accent: '#0077C8' },
    goma: { primary: '#CE1021', accent: '#F7D618' },
};

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
        l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/** Deterministic fallback palette for any country not in CURATED. */
function generateTheme(seed: string): CountryTheme {
    const h = hashString(seed) % 360;
    const primary = hslToHex(h, 70, 50);
    const secondary = hslToHex((h + 40) % 360, 75, 55);
    const accent = hslToHex((h + 200) % 360, 70, 55);
    return {
        primary,
        secondary,
        accent,
        glow: `hsla(${h}, 70%, 55%, 0.35)`,
        gradient: `linear-gradient(135deg, ${primary} 0%, ${secondary} 55%, ${accent} 100%)`,
    };
}

const DEFAULT_THEME: CountryTheme = {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    accent: '#EC4899',
    glow: 'rgba(99, 102, 241, 0.35)',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 55%, #EC4899 100%)',
};

/**
 * Returns a colour theme for a station.
 * @param countryCode ISO alpha-2 country code (e.g. "CD"), if known.
 * @param seedFallback Any stable string (station/channel name) used to
 *   generate a deterministic palette when no country code is available.
 * @param regionSlug Optional DRC region slug for regional accent overrides.
 */
export function getCountryTheme(
    countryCode?: string | null,
    seedFallback?: string | null,
    regionSlug?: string | null,
): CountryTheme {
    const code = (countryCode || '').toUpperCase().trim();

    if (code && CURATED[code]) {
        const base = CURATED[code];
        if (regionSlug && DRC_REGION_ACCENTS[regionSlug]) {
            return { ...base, ...DRC_REGION_ACCENTS[regionSlug] };
        }
        return base;
    }

    if (regionSlug && DRC_REGION_ACCENTS[regionSlug]) {
        return { ...CURATED.CD, ...DRC_REGION_ACCENTS[regionSlug] };
    }

    const seed = code || seedFallback || '';
    if (!seed) return DEFAULT_THEME;
    return generateTheme(seed);
}