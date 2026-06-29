import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { StationRecord } from '../lib/types';
import { getFlagEmoji } from '../lib/types';
import { fetchStations } from '../lib/supabase';
import { slugify } from '../lib/channels';

const REGION_ORDER = ['Southern Africa', 'Central Africa', 'East Africa', 'North Africa'];

function groupByRegion(stations: StationRecord[]): Map<string, StationRecord[]> {
  const groups = new Map<string, StationRecord[]>();
  for (const s of stations) {
    const list = groups.get(s.region) || [];
    list.push(s);
    groups.set(s.region, list);
  }
  REGION_ORDER.forEach(r => {
    if (!groups.has(r)) groups.set(r, []);
  });
  return groups;
}

export default function StationGrid() {
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStations().then(data => {
      const filtered = (data as StationRecord[]).filter(s =>
        s.name === 'South Africa' || s.name === 'DR Congo' || s.name === 'Tanzania'
        || s.name === 'Kenya' || s.name === 'Eswatini'
      );
      setStations(filtered);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-text-secondary">No countries configured yet.</p>
      </div>
    );
  }

  const groups = groupByRegion(stations);

  return (
    <div className="space-y-8">
      {REGION_ORDER.map(region => {
        const list = groups.get(region);
        if (!list || list.length === 0) return null;
        return (
          <section key={region}>
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 px-1">
              {region}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center">
              {list.map(station => {
                const flag = station.image_url
                  ? <img src={station.image_url} alt={station.name} className="w-10 h-10 rounded-full object-cover" />
                  : <span className="text-3xl leading-none">{getFlagEmoji(station.country_code)}</span>;
                return (
                  <div key={station.id} className="flex flex-col items-center gap-1.5">
                    <motion.button
                      onClick={() => navigate(`/radio/${slugify(station.name)}`)}
                      whileTap={{ scale: 0.92 }}
                      whileHover={{ scale: 1.05 }}
                      className="relative w-20 h-20 rounded-full bg-surface border border-border flex items-center justify-center shadow-lg cursor-pointer hover:border-primary/50 transition-colors group"
                    >
                      {flag}
                    </motion.button>
                    <span className="text-xs font-medium text-text-primary text-center leading-tight max-w-20 truncate">
                      {station.name}
                    </span>
                    <span className="text-[10px] text-text-secondary text-center leading-none">
                      {station.region}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
