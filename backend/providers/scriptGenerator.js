/**
 * Unified Script Generator
 * Provider-agnostic AI script generator for all event types.
 * Takes normalized events and produces broadcast-ready scripts.
 *
 * Placeholders:
 *   {title}          – event title
 *   {summary}        – event summary (truncated)
 *   {provider}       – provider name (lezotraffic, rss, etc.)
 *   {city}           – city name
 *   {province}       – province name
 *   {location}       – city, province, country combined
 *   {incident_type}  – subcategory / incident type label
 *   {severity}       – severity label (high/medium/low)
 */

const SCRIPT_TEMPLATES = {
  fr: {
    critical: {
      emergency: "Alerte d'urgence. {title}. {summary}. {location_suffix}Suivez les instructions des autorités.",
      traffic: "{provider_prefix}Alerte critique trafic. {title}. {summary}. {location_suffix}Circulation perturbée. Évitez la zone.",
      security: "{provider_prefix}Alerte sécurité. {title}. {summary}. {location_suffix}Restez vigilants.",
      news: "Flash info urgent. {title}. {summary}.",
      weather: "Alerte météo critique. {title}. {summary}. {location_suffix}Prenez des précautions immédiates.",
      default: "Alerte critique. {title}. {summary}. {location_suffix}",
    },
    high: {
      emergency: "Mise à jour urgence. {title}. {summary}. {location_suffix}Restez informés.",
      traffic: "{provider_prefix}Mise à jour trafic. {title}. {summary}. {location_suffix}Prudence recommandée.",
      security: "{provider_prefix}Information sécurité. {title}. {summary}. {location_suffix}Vigilance requise.",
      news: "Information importante. {title}. {summary}.",
      weather: "Alerte météo. {title}. {summary}. {location_suffix}Vigilance requise.",
      default: "Mise à jour importante. {title}. {summary}. {location_suffix}",
    },
    medium: {
      emergency: "Note urgence. {title}. {summary}.",
      traffic: "{provider_prefix}Information trafic. {title}. {summary}. {location_suffix}",
      security: "{provider_prefix}Note sécurité. {title}. {summary}. {location_suffix}",
      news: "Aux informations. {title}. {summary}.",
      weather: "Prévisions météo. {title}. {summary}.",
      default: "Information. {title}. {summary}. {location_suffix}",
    },
    low: {
      emergency: "Note urgence. {title}.",
      traffic: "{provider_prefix}Note trafic. {title}. {location_suffix}",
      security: "Note sécurité. {title}. {location_suffix}",
      news: "Note. {title}.",
      weather: "Météo. {title}.",
      default: "Note. {title}. {location_suffix}",
    },
  },
  en: {
    critical: {
      emergency: "Critical alert. {title}. {summary}. {location_suffix}Follow official instructions.",
      traffic: "{provider_prefix}Critical traffic alert. {title}. {summary}. {location_suffix}Expect severe delays. Avoid the area.",
      security: "{provider_prefix}Security alert. {title}. {summary}. {location_suffix}Stay alert.",
      news: "Breaking news urgent. {title}. {summary}.",
      weather: "Severe weather warning. {title}. {summary}. {location_suffix}Take immediate precautions.",
      default: "Critical alert. {title}. {summary}. {location_suffix}",
    },
    high: {
      emergency: "Emergency update. {title}. {summary}. {location_suffix}Stay informed.",
      traffic: "{provider_prefix}Traffic update. {title}. {summary}. {location_suffix}Exercise caution.",
      security: "{provider_prefix}Security update. {title}. {summary}. {location_suffix}Vigilance required.",
      news: "Important update. {title}. {summary}.",
      weather: "Weather alert. {title}. {summary}. {location_suffix}Vigilance required.",
      default: "Important update. {title}. {summary}. {location_suffix}",
    },
    medium: {
      emergency: "Emergency note. {title}. {summary}.",
      traffic: "{provider_prefix}Traffic information. {title}. {summary}. {location_suffix}",
      security: "{provider_prefix}Security note. {title}. {summary}. {location_suffix}",
      news: "News update. {title}. {summary}.",
      weather: "Weather forecast. {title}. {summary}.",
      default: "Update. {title}. {summary}. {location_suffix}",
    },
    low: {
      emergency: "Emergency note. {title}.",
      traffic: "{provider_prefix}Traffic note. {title}. {location_suffix}",
      security: "Security note. {title}. {location_suffix}",
      news: "News note. {title}.",
      weather: "Weather note. {title}.",
      default: "Note. {title}. {location_suffix}",
    },
  },
  sw: {
    critical: {
      emergency: "Tahadhari muhimu. {title}. {summary}. {location_suffix}Fuata maelekezo ya rasmi.",
      traffic: "{provider_prefix}Tahadhari muhimu ya trafiki. {title}. {summary}. {location_suffix}Tengeneza msongamano. Epuka eneo.",
      security: "{provider_prefix}Tahadhari ya usalama. {title}. {summary}. {location_suffix}Kuwa macho.",
      news: "Habari muhimu za haraka. {title}. {summary}.",
      weather: "Tahadhari ya hali ya hewa. {title}. {summary}. {location_suffix}Chukua tahadhari.",
      default: "Tahadhari muhimu. {title}. {summary}. {location_suffix}",
    },
    high: {
      emergency: "Sasisho la dharura. {title}. {summary}. {location_suffix}Endelea kufuatilia.",
      traffic: "{provider_prefix}Sasisho la trafiki. {title}. {summary}. {location_suffix}Kuwa makini.",
      security: "{provider_prefix}Sasisho la usalama. {title}. {summary}. {location_suffix}Kuwa tayari.",
      news: "Sasisho muhimu. {title}. {summary}.",
      weather: "Tahadhari ya hali ya hewa. {title}. {summary}. {location_suffix}Kuwa tayari.",
      default: "Sasisho muhimu. {title}. {summary}. {location_suffix}",
    },
    medium: {
      emergency: "Nota ya dharura. {title}. {summary}.",
      traffic: "{provider_prefix}Maelezo ya trafiki. {title}. {summary}. {location_suffix}",
      security: "{provider_prefix}Nota ya usalama. {title}. {summary}. {location_suffix}",
      news: "Sasisho ya habari. {title}. {summary}.",
      weather: "Utabiri wa hali ya hewa. {title}. {summary}.",
      default: "Sasisho. {title}. {summary}. {location_suffix}",
    },
    low: {
      emergency: "Nota ya dharura. {title}.",
      traffic: "{provider_prefix}Nota ya trafiki. {title}. {location_suffix}",
      security: "Nota ya usalama. {title}. {location_suffix}",
      news: "Nota ya habari. {title}.",
      weather: "Nota ya hali ya hewa. {title}.",
      default: "Nota. {title}. {location_suffix}",
    },
  },
  ln: {
    critical: {
      emergency: "Limbisi ya monene. {title}. {summary}. {location_suffix}Tinda malamu ya ba mbulamatari.",
      traffic: "{provider_prefix}Limbisi ya monene ya kokota. {title}. {summary}. {location_suffix}Kokota mingi. Epuka mboka.",
      security: "{provider_prefix}Limbisi ya monene ya kosala. {title}. {summary}. {location_suffix}Kenda kitoko.",
      news: "Nzela ya sika ya mbala. {title}. {summary}.",
      weather: "Limbisi ya mbula. {title}. {summary}. {location_suffix}Tinda kitoko.",
      default: "Limbisi ya monene. {title}. {summary}. {location_suffix}",
    },
    high: {
      emergency: "Sasita ya mbulamatari. {title}. {summary}. {location_suffix}Kenda koyoka.",
      traffic: "{provider_prefix}Sasita ya kokota. {title}. {summary}. {location_suffix}Tinda kitoko.",
      security: "{provider_prefix}Sasita ya kosala. {title}. {summary}. {location_suffix}Kenda koyoka.",
      news: "Sasita ya monene. {title}. {summary}.",
      weather: "Limbisi ya mbula. {title}. {summary}. {location_suffix}Kenda koyoka.",
      default: "Sasita ya monene. {title}. {summary}. {location_suffix}",
    },
    medium: {
      emergency: "Nzela ya mbulamatari. {title}. {summary}.",
      traffic: "{provider_prefix}Nzela ya kokota. {title}. {summary}. {location_suffix}",
      security: "{provider_prefix}Nzela ya kosala. {title}. {summary}. {location_suffix}",
      news: "Nzela ya mbala. {title}. {summary}.",
      weather: "Nzela ya mbula. {title}. {summary}.",
      default: "Sasita. {title}. {summary}. {location_suffix}",
    },
    low: {
      emergency: "Nzela ya mbulamatari. {title}.",
      traffic: "{provider_prefix}Nzela ya kokota. {title}. {location_suffix}",
      security: "Nzela ya kosala. {title}. {location_suffix}",
      news: "Nzela ya mbala. {title}.",
      weather: "Nzela ya mbula. {title}.",
      default: "Nzela. {title}. {location_suffix}",
    },
  },
};

// ── Provider display names ────────────────────────────────────────────────
const PROVIDER_DISPLAY = {
  lezotraffic: { fr: 'Depuis LezoTraffic, ', en: 'From LezoTraffic, ', sw: 'Kutoka LezoTraffic, ', ln: 'Ku LezoTraffic, ' },
};

/**
 * Determine priority level from event priority.
 */
function getPriorityLevel(priority) {
  if (priority <= 2) return 'critical';
  if (priority <= 4) return 'high';
  if (priority <= 6) return 'medium';
  return 'low';
}

/**
 * Get template for an event.
 */
function getTemplate(event, language) {
  const priorityLevel = getPriorityLevel(event.priority);
  const category = event.category || 'default';

  const languageTemplates = SCRIPT_TEMPLATES[language] || SCRIPT_TEMPLATES.en;
  const priorityTemplates = languageTemplates[priorityLevel] || languageTemplates.medium;
  const template = priorityTemplates[category] || priorityTemplates.default;

  return template;
}

/**
 * Replace placeholders in template with event data.
 */
function fillTemplate(template, event) {
  let filled = template;

  // Core fields
  filled = filled.replace(/\{title\}/g, event.title || '');
  const summary = (event.summary || '').substring(0, 200);
  filled = filled.replace(/\{summary\}/g, summary);

  // Location
  const locationParts = [event.city, event.province, event.country].filter(Boolean);
  const location = locationParts.join(', ');
  filled = filled.replace(/\{location\}/g, location || '');

  // City / province individual
  filled = filled.replace(/\{city\}/g, event.city || '');
  filled = filled.replace(/\{province\}/g, event.province || '');

  // Incident type / severity
  filled = filled.replace(/\{incident_type\}/g, event.subcategory || event.category || '');
  filled = filled.replace(/\{severity\}/g, getSeverityLabel(event.priority));

  // Provider prefix — only for traffic/security categories
  const lang = event._language || 'fr';
  const providerKey = event.provider || '';
  const isTrafficOrSecurity = event.category === 'traffic' || event.category === 'security' || event.category === 'transport';
  if (isTrafficOrSecurity && PROVIDER_DISPLAY[providerKey]) {
    filled = filled.replace(/\{provider_prefix\}/g, PROVIDER_DISPLAY[providerKey][lang] || '');
  } else {
    filled = filled.replace(/\{provider_prefix\}/g, '');
  }

  // Location suffix — formatted location string
  if (location) {
    const locPrefix = lang === 'fr' ? 'À ' : lang === 'en' ? 'In ' : lang === 'sw' ? 'Katika ' : 'Na ';
    filled = filled.replace(/\{location_suffix\}/g, `${locPrefix}${location}. `);
  } else {
    filled = filled.replace(/\{location_suffix\}/g, '');
  }

  // Time
  const time = event.created_at ? new Date(event.created_at).toLocaleTimeString() : '';
  filled = filled.replace(/\{time\}/g, time);

  // Clean up double spaces and trailing dots
  filled = filled.replace(/\s+/g, ' ').replace(/\.\./g, '.').trim();

  return filled;
}

/**
 * Map numeric priority to human-readable severity label.
 */
function getSeverityLabel(priority) {
  if (priority <= 2) return 'high';
  if (priority <= 5) return 'medium';
  return 'low';
}

/**
 * Generate a script for a single event.
 * @param {Object} event - Normalized event (from events table or normalizer)
 * @param {string} language - Target language code (fr, en, sw, ln)
 * @returns {string} Generated script text
 */
export function generateEventScript(event, language = 'fr') {
  if (event.category === 'geo') return '';
  const enriched = { ...event, _language: language };
  const template = getTemplate(enriched, language);
  return fillTemplate(template, enriched);
}

/**
 * Generate scripts for multiple events.
 */
export function generateEventScripts(events, language = 'fr') {
  return events.map(event => generateEventScript(event, language));
}

/**
 * Generate a combined script for multiple events (bulletin format).
 */
export function generateCombinedScript(events, language = 'fr') {
  if (events.length === 0) return '';

  const sorted = [...events].sort((a, b) => a.priority - b.priority);
  const scripts = sorted.map(event => generateEventScript(event, language));

  return scripts.join('. ');
}

/**
 * Generate a broadcast script object.
 */
export function generateBroadcastScript(events, language = 'fr') {
  const scripts = generateEventScripts(events, language);
  const combined = generateCombinedScript(events, language);

  return {
    events: events.map((e, i) => ({
      id: e.id,
      provider: e.provider,
      category: e.category,
      subcategory: e.subcategory,
      priority: e.priority,
      city: e.city,
      province: e.province,
      script: scripts[i],
    })),
    combined,
    language,
    event_count: events.length,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Generate a bulletin intro text for a channel.
 * @param {string} language - Channel language (fr, en, sw, ln)
 * @param {string} stationName - Station name
 * @param {number} eventCount - Number of items in the bulletin
 * @returns {string} Bulletin intro text
 */
export function generateBulletinIntro(language = 'fr', stationName = 'Radio Lezo', eventCount = 0) {
  const intros = {
    fr: `${stationName}. Bulletin d'information. ${eventCount} actualités à traiter.`,
    en: `${stationName}. News bulletin. ${eventCount} stories to cover.`,
    sw: `${stationName}. Ripoti ya habari. ${eventCount} habari za kushughulikia.`,
    ln: `${stationName}. Tatomi ya monene. ${eventCount} nzela ya kosala.`,
  };
  return intros[language] || intros.en;
}

/**
 * Generate a station ID text.
 * @param {string} language - Channel language
 * @param {string} stationName - Station name
 * @returns {string} Station ID text
 */
export function generateStationIdText(language = 'fr', stationName = 'Radio Lezo') {
  const texts = {
    fr: `Vous écoutez ${stationName}. Restez à l'écoute.`,
    en: `You're listening to ${stationName}. Stay tuned.`,
    sw: `Unasikiliza ${stationName}. Endelea kusikiliza.`,
    ln: `Oyo ke ${stationName}. Kenda kosenga.`,
  };
  return texts[language] || texts.en;
}

/**
 * Generate a welcome intro text for when a listener starts the stream.
 * @param {string} language - Channel language
 * @param {string} stationName - Station name
 * @returns {string} Welcome text
 */
export function generateWelcomeText(language = 'fr', stationName = 'Radio Lezo') {
  const texts = {
    fr: `Bienvenue sur ${stationName}. Votre station d'information en continu.`,
    en: `Welcome to ${stationName}. Your continuous news station.`,
    sw: `Karibu ${stationName}. Kituo chako cha habari.`,
    ln: `Bienvenue na ${stationName}. Embo ya sika na yo.`,
  };
  return texts[language] || texts.en;
}

/**
 * Generate a time announcement text.
 * @param {string} language - Channel language
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @returns {string} Time announcement text
 */
export function generateTimeAnnouncement(language = 'fr', hour, minute) {
  const pad = String(minute).padStart(2, '0');
  const texts = {
    fr: `Il est ${hour} heures${minute > 0 ? ` et ${minute} minutes` : ''}.`,
    en: `The time is ${hour}:${pad}.`,
    sw: `Saa ni ${hour}:${pad}.`,
    ln: `Saa ke ${hour}:${pad}.`,
  };
  return texts[language] || texts.en;
}

/**
 * Generate an apology/transition line when interrupting a music track for a bulletin.
 * @param {string} language - Channel language
 * @param {string} stationName - Station name
 * @returns {string} Apology text
 */
export function generateBulletinApology(language = 'fr', stationName = 'Radio Lezo') {
  const lines = {
    fr: `Nous interrompons cette musique pour un bulletin d'information de ${stationName}.`,
    en: `We interrupt this music for a news bulletin from ${stationName}.`,
    sw: `Tunakatisha muziki huu kwa ripoti ya habari kutoka ${stationName}.`,
    ln: `Tozongisa miziki oyo mpo na tatomi ya sika ya ${stationName}.`,
  };
  return lines[language] || lines.en;
}

/**
 * Generate a traffic segment intro line.
 * @param {string} language - Channel language
 * @param {string} stationName - Station name
 * @returns {string} Traffic intro text
 */
export function generateTrafficIntro(language = 'fr', stationName = 'Radio Lezo') {
  const lines = {
    fr: `Maintenant, un point sur le trafic avec ${stationName}.`,
    en: `Now, a traffic update from ${stationName}.`,
    sw: `Sasa, taarifa ya trafiki kutoka ${stationName}.`,
    ln: `Sikawa, sasita ya kokota na ${stationName}.`,
  };
  return lines[language] || lines.en;
}

/**
 * Generate a news segment intro line.
 * @param {string} language - Channel language
 * @param {string} stationName - Station name
 * @returns {string} News intro text
 */
export function generateNewsIntro(language = 'fr', stationName = 'Radio Lezo') {
  const lines = {
    fr: `Passons maintenant à l'actualité sur ${stationName}.`,
    en: `Now for the news on ${stationName}.`,
    sw: `Sasa habari kutoka ${stationName}.`,
    ln: `Sikawa nzela ya sika na ${stationName}.`,
  };
  return lines[language] || lines.en;
}

/**
 * Generate a weather segment intro line.
 * @param {string} language - Channel language
 * @param {string} stationName - Station name
 * @returns {string} Weather intro text
 */
export function generateWeatherIntro(language = 'fr', stationName = 'Radio Lezo') {
  const lines = {
    fr: `Et maintenant, la météo sur ${stationName}.`,
    en: `And now, the weather on ${stationName}.`,
    sw: `Na sasa, hali ya hewa kutoka ${stationName}.`,
    ln: `Mpe sikawa, mbula na ${stationName}.`,
  };
  return lines[language] || lines.en;
}

/**
 * Generate a music track intro line (what's coming up next).
 * @param {string} language - Channel language
 * @param {string} trackName - Name of the track
 * @param {string} stationName - Station name
 * @returns {string} Music intro text
 */
export function generateMusicIntro(language = 'fr', trackName = '', stationName = 'Radio Lezo', artist = '') {
  const byArtist = artist ? ` par ${artist}` : '';
  const lines = {
    fr: `Et voici, ${trackName}${byArtist}, sur ${stationName}. Profitez bien de ce moment musical.`,
    en: `Now playing ${trackName}${byArtist}, here on ${stationName}. Enjoy this next track.`,
    sw: `Sasa tunacheza ${trackName}${byArtist}, hapa ${stationName}. Furahia wimbo huu.`,
    ln: `Sikawa tobeti ${trackName}${byArtist}, awa ${stationName}. Sepela na nzembo oyo.`,
  };
  return lines[language] || lines.en;
}

/**
 * Generate a music track outro/commentary line.
 * @param {string} language - Channel language
 * @param {string} trackName - Name of the track
 * @param {string} stationName - Station name
 * @returns {string} Music outro text
 */
export function generateMusicOutro(language = 'fr', trackName = '', stationName = 'Radio Lezo') {
  const lines = {
    fr: `C'était ${trackName} sur ${stationName}. Restez à l'écoute.`,
    en: `That was ${trackName} on ${stationName}. Stay tuned.`,
    sw: `Hiyo ilikuwa ${trackName} kwenye ${stationName}. Endelea kusikiliza.`,
    ln: `Wana ke ${trackName} na ${stationName}. Kenda koyoka.`,
  };
  return lines[language] || lines.en;
}

/**
 * Generate a bulletin outro script.
 */
export function generateBulletinOutro(language = 'fr', stationName = 'Radio Lezo') {
  const lines = {
    fr: `C'étaient les informations. Restez à l'écoute sur ${stationName}.`,
    en: `That's the latest news. Stay with ${stationName}.`,
    sw: `Hiyo ni habari za mwisho. Endelea na ${stationName}.`,
    ln: `Ese sango ya siku oyo. Kenda na ${stationName}.`,
  };
  return lines[language] || lines.en;
}

/**
 * Generate a "no traffic updates" announcement.
 * Used when LezoTraffic check returns empty.
 */
export function generateNoTrafficAnnouncement(language = 'fr', stationName = 'Radio Lezo') {
  const lines = {
    fr: `Vérification du trafic avec ${stationName}. Pas de nouveaux incidents signalés. Passons aux actualités.`,
    en: `Checking traffic with ${stationName}. No new incidents reported. Moving to the news.`,
    sw: `Inakagua trafiki na ${stationName}. Hakuna matukio mapya yaliyotangazwa. Tukaende kwenye habari.`,
    ln: `Tokosala kokota na ${stationName}. Nayeba ya sika moko te. Tokenda na sango.`,
  };
  return lines[language] || lines.en;
}

/**
 * Generate a traffic check intro (before checking LezoTraffic).
 */
export function generateTrafficCheckIntro(language = 'fr', stationName = 'Radio Lezo') {
  const lines = {
    fr: `Vérifions le trafic avec ${stationName}.`,
    en: `Let's check traffic with ${stationName}.`,
    sw: `Tukaguanye trafiki na ${stationName}.`,
    ln: `Tokosala kokota na ${stationName}.`,
  };
  return lines[language] || lines.en;
}

/**
 * Generate a "no news updates" announcement.
 * Used when news check returns empty.
 */
export function generateNoNewsAnnouncement(language = 'fr', stationName = 'Radio Lezo') {
  const lines = {
    fr: `Vous êtes à jour sur les actualités avec ${stationName}. Pas de nouveaux développements pour le moment.`,
    en: `You're up to date on the news with ${stationName}. No new developments at this time.`,
    sw: `Upo sasa kwenye habari na ${stationName}. Hakuna mapinduzi mapya kwa sasa.`,
    ln: `Oyo esengi na sango na ${stationName}. Nayeba ya sika moko te sɛsɛ.`,
  };
  return lines[language] || lines.en;
}

/**
 * Generate a "no weather updates" announcement.
 * Used when weather check returns empty.
 */
export function generateNoWeatherAnnouncement(language = 'fr', stationName = 'Radio Lezo') {
  const lines = {
    fr: `Les prévisions météo restent inchangées pour ${stationName}. Nous y reviendrons plus tard.`,
    en: `Weather conditions remain unchanged for ${stationName}. We'll check again later.`,
    sw: `Hali ya hewa bado ni sawa kwa ${stationName}. Tutaangalia tena baadaye.`,
    ln: `Mbula ezali oyo te na ${stationName}. Tokosala dinga.`,
  };
  return lines[language] || lines.en;
}

/**
 * Validate that a language is supported.
 */
export function isLanguageSupported(language) {
  return SCRIPT_TEMPLATES.hasOwnProperty(language);
}

/**
 * Get supported languages.
 */
export function getSupportedLanguages() {
  return Object.keys(SCRIPT_TEMPLATES);
}

/**
 * Add or update a template.
 */
export function setTemplate(language, priorityLevel, category, template) {
  if (!SCRIPT_TEMPLATES[language]) SCRIPT_TEMPLATES[language] = {};
  if (!SCRIPT_TEMPLATES[language][priorityLevel]) SCRIPT_TEMPLATES[language][priorityLevel] = {};
  SCRIPT_TEMPLATES[language][priorityLevel][category] = template;
}

export {
  getTemplate,
  fillTemplate,
  getPriorityLevel,
  getSeverityLabel,
  SCRIPT_TEMPLATES,
};
