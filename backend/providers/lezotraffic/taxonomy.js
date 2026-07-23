export const INCIDENT_TYPES = {
  embouteillage: { category: 'traffic', subcategory: 'congestion' },
  accident: { category: 'traffic', subcategory: 'accident' },
  collision: { category: 'traffic', subcategory: 'accident' },
  carambolage: { category: 'traffic', subcategory: 'accident' },
  travaux: { category: 'traffic', subcategory: 'road_block' },
  'route_fermée': { category: 'traffic', subcategory: 'road_block' },
  'route_barree': { category: 'traffic', subcategory: 'road_block' },
  'véhicule_en_panne': { category: 'traffic', subcategory: 'incident' },
  panne: { category: 'traffic', subcategory: 'incident' },
  'feux_hs': { category: 'traffic', subcategory: 'incident' },
  feux_tricolores_hs: { category: 'traffic', subcategory: 'incident' },
  animaux: { category: 'traffic', subcategory: 'incident' },
  nid_de_poule: { category: 'traffic', subcategory: 'road_block' },
  dos_d_ane: { category: 'traffic', subcategory: 'incident' },
  urgence: { category: 'emergency', subcategory: 'general' },
  incendie: { category: 'emergency', subcategory: 'fire' },
  feu: { category: 'emergency', subcategory: 'fire' },
  inondation: { category: 'emergency', subcategory: 'flood' },
  glissement: { category: 'emergency', subcategory: 'landslide' },
  éboulement: { category: 'emergency', subcategory: 'landslide' },
  seisme: { category: 'emergency', subcategory: 'earthquake' },
  tempete: { category: 'emergency', subcategory: 'storm' },
  kuluna: { category: 'security', subcategory: 'gang_violence' },
  banditisme: { category: 'security', subcategory: 'banditry' },
  vol: { category: 'security', subcategory: 'theft' },
  agression: { category: 'security', subcategory: 'assault' },
  'contrôle_police': { category: 'security', subcategory: 'police_check' },
  barricade: { category: 'security', subcategory: 'barricade' },
  manifestation: { category: 'security', subcategory: 'protest' },
  grève: { category: 'security', subcategory: 'strike' },
  événement: { category: 'event', subcategory: 'public_gathering' },
  festival: { category: 'event', subcategory: 'festival' },
  sport: { category: 'sports', subcategory: 'event' },
  transport: { category: 'transport', subcategory: 'public_transport' },
  bus: { category: 'transport', subcategory: 'bus' },
  taxi: { category: 'transport', subcategory: 'taxi' },
  train: { category: 'transport', subcategory: 'train' },
};

export const SEVERITY_MAP = {
  high: 2,
  medium: 5,
  low: 8,
};

export function mapIncidentType(frenchType) {
  if (!frenchType) return { category: 'traffic', subcategory: 'incident' };
  const normalized = frenchType.toLowerCase().replace(/[\s_-]+/g, '_').trim();
  return INCIDENT_TYPES[normalized] || { category: 'traffic', subcategory: 'incident' };
}

export function mapSeverity(severity) {
  if (!severity) return 5;
  const normalized = severity.toLowerCase().trim();
  return SEVERITY_MAP[normalized] != null ? SEVERITY_MAP[normalized] : 5;
}
