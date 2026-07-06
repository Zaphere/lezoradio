/**
 * Unified Script Generator
 * Provider-agnostic AI script generator for all event types
 * Takes normalized events and produces broadcast-ready scripts
 */

/**
 * Script templates for different categories, priorities, and languages
 */
const SCRIPT_TEMPLATES = {
  fr: {
    critical: {
      emergency: "Alerte d'urgence. {title}. {summary}. Suivez les instructions des autorités.",
      traffic: "Alerte critique. {title}. {summary}. Circulation perturbée. Évitez la zone.",
      news: "Flash info urgent. {title}. {summary}.",
      weather: "Alerte météo critique. {title}. {summary}. Prenez des précautions immédiates.",
      default: "Alerte critique. {title}. {summary}.",
    },
    high: {
      emergency: "Mise à jour urgence. {title}. {summary}. Restez informés.",
      traffic: "Mise à jour trafic. {title}. {summary}. Prudence recommandée.",
      news: "Information importante. {title}. {summary}.",
      weather: "Alerte météo. {title}. {summary}. Vigilance requise.",
      default: "Mise à jour importante. {title}. {summary}.",
    },
    medium: {
      emergency: "Note urgence. {title}. {summary}.",
      traffic: "Information trafic. {title}. {summary}.",
      news: "Aux informations. {title}. {summary}.",
      weather: "Prévisions météo. {title}. {summary}.",
      default: "Information. {title}. {summary}.",
    },
    low: {
      emergency: "Note urgence. {title}.",
      traffic: "Note trafic. {title}.",
      news: "Note. {title}.",
      weather: "Météo. {title}.",
      default: "Note. {title}.",
    },
  },
  en: {
    critical: {
      emergency: "Critical alert. {title}. {summary}. Follow official instructions.",
      traffic: "Critical alert. {title}. {summary}. Expect severe delays. Avoid the area.",
      news: "Breaking news urgent. {title}. {summary}.",
      weather: "Severe weather warning. {title}. {summary}. Take immediate precautions.",
      default: "Critical alert. {title}. {summary}.",
    },
    high: {
      emergency: "Emergency update. {title}. {summary}. Stay informed.",
      traffic: "Traffic update. {title}. {summary}. Exercise caution.",
      news: "Important update. {title}. {summary}.",
      weather: "Weather alert. {title}. {summary}. Vigilance required.",
      default: "Important update. {title}. {summary}.",
    },
    medium: {
      emergency: "Emergency note. {title}. {summary}.",
      traffic: "Traffic information. {title}. {summary}.",
      news: "News update. {title}. {summary}.",
      weather: "Weather forecast. {title}. {summary}.",
      default: "Update. {title}. {summary}.",
    },
    low: {
      emergency: "Emergency note. {title}.",
      traffic: "Traffic note. {title}.",
      news: "News note. {title}.",
      weather: "Weather note. {title}.",
      default: "Note. {title}.",
    },
  },
  sw: {
    critical: {
      emergency: " Tahadhari muhimu. {title}. {summary}. Fuata maelekezo ya rasmi.",
      traffic: "Tahadhari muhimu. {title}. {summary}. Tengeneza msongamano. Epuka eneo.",
      news: "Habari muhimu za haraka. {title}. {summary}.",
      weather: "Tahadhari ya hali ya hewa. {title}. {summary}. Chukua tahadhari.",
      default: "Tahadhari muhimu. {title}. {summary}.",
    },
    high: {
      emergency: "Sasisho la dharura. {title}. {summary}. Endelea kufuatilia.",
      traffic: "Sasisho la msongamano. {title}. {summary}. Kuwa makini.",
      news: "Sasisho muhimu. {title}. {summary}.",
      weather: "Tahadhari ya hali ya hewa. {title}. {summary}. Kuwa tayari.",
      default: "Sasisho muhimu. {title}. {summary}.",
    },
    medium: {
      emergency: "Nota ya dharura. {title}. {summary}.",
      traffic: "Maelezo ya msongamano. {title}. {summary}.",
      news: "Sasisho ya habari. {title}. {summary}.",
      weather: "Utabiri wa hali ya hewa. {title}. {summary}.",
      default: "Sasisho. {title}. {summary}.",
    },
    low: {
      emergency: "Nota ya dharura. {title}.",
      traffic: "Nota ya msongamano. {title}.",
      news: "Nota ya habari. {title}.",
      weather: "Nota ya hali ya hewa. {title}.",
      default: "Nota. {title}.",
    },
  },
  ln: {
    critical: {
      emergency: "Limbisi ya monene. {title}. {summary}. Tinda malamu ya ba mbulamatari.",
      traffic: "Limbisi ya monene. {title}. {summary}. Kokota mingi. Epuka mboka.",
      news: "Nzela ya sika ya mbala. {title}. {summary}.",
      weather: "Limbisi ya mbula. {title}. {summary}. Tinda kitoko.",
      default: "Limbisi ya monene. {title}. {summary}.",
    },
    high: {
      emergency: "Sasita ya mbulamatari. {title}. {summary}. Kenda koyoka.",
      traffic: "Sasita ya kokota. {title}. {summary}. Tinda kitoko.",
      news: "Sasita ya monene. {title}. {summary}.",
      weather: "Limbisi ya mbula. {title}. {summary}. Kenda koyoka.",
      default: "Sasita ya monene. {title}. {summary}.",
    },
    medium: {
      emergency: "Nzela ya mbulamatari. {title}. {summary}.",
      traffic: "Nzela ya kokota. {title}. {summary}.",
      news: "Nzela ya mbala. {title}. {summary}.",
      weather: "Nzela ya mbula. {title}. {summary}.",
      default: "Sasita. {title}. {summary}.",
    },
    low: {
      emergency: "Nzela ya mbulamatari. {title}.",
      traffic: "Nzela ya kokota. {title}.",
      news: "Nzela ya mbala. {title}.",
      weather: "Nzela ya mbula. {title}.",
      default: "Nzela. {title}.",
    },
  },
};

/**
 * Determine priority level from event priority
 * @param {number} priority - Event priority (1-10)
 * @returns {string} Priority level (critical, high, medium, low)
 */
function getPriorityLevel(priority) {
  if (priority <= 2) return 'critical';
  if (priority <= 4) return 'high';
  if (priority <= 6) return 'medium';
  return 'low';
}

/**
 * Get template for an event
 * @param {Object} event - Normalized event
 * @param {string} language - Target language
 * @returns {string} Template string
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
 * Replace placeholders in template with event data
 * @param {string} template - Template string
 * @param {Object} event - Normalized event
 * @returns {string} Filled template
 */
function fillTemplate(template, event) {
  let filled = template;
  
  // Replace title
  filled = filled.replace('{title}', event.title || '');
  
  // Replace summary (truncate if too long)
  const summary = (event.summary || '').substring(0, 200);
  filled = filled.replace('{summary}', summary);
  
  // Replace location if available
  const location = [event.city, event.province, event.country]
    .filter(Boolean)
    .join(', ');
  filled = filled.replace('{location}', location || '');
  
  // Replace time if available
  const time = event.created_at ? new Date(event.created_at).toLocaleTimeString() : '';
  filled = filled.replace('{time}', time);
  
  return filled;
}

/**
 * Generate a script for a single event
 * @param {Object} event - Normalized event
 * @param {string} language - Target language (default: 'fr')
 * @returns {string} Generated script
 */
function generateEventScript(event, language = 'fr') {
  const template = getTemplate(event, language);
  return fillTemplate(template, event);
}

/**
 * Generate scripts for multiple events
 * @param {Array<Object>} events - Array of normalized events
 * @param {string} language - Target language (default: 'fr')
 * @returns {Array<string>} Array of generated scripts
 */
function generateEventScripts(events, language = 'fr') {
  return events.map(event => generateEventScript(event, language));
}

/**
 * Generate a combined script for multiple events
 * @param {Array<Object>} events - Array of normalized events
 * @param {string} language - Target language (default: 'fr')
 * @returns {string} Combined script
 */
function generateCombinedScript(events, language = 'fr') {
  if (events.length === 0) {
    return '';
  }
  
  // Sort by priority (lower = higher priority)
  const sortedEvents = [...events].sort((a, b) => a.priority - b.priority);
  
  // Generate individual scripts
  const scripts = sortedEvents.map(event => generateEventScript(event, language));
  
  // Combine with appropriate separators
  const separator = language === 'fr' ? '. ' : '. ';
  return scripts.join(separator);
}

/**
 * Generate a broadcast script object
 * @param {Array<Object>} events - Array of normalized events
 * @param {string} language - Target language (default: 'fr')
 * @returns {Object} Broadcast script object
 */
function generateBroadcastScript(events, language = 'fr') {
  const scripts = generateEventScripts(events, language);
  const combined = generateCombinedScript(events, language);
  
  return {
    events: events.map(e => ({
      id: e.id,
      provider: e.provider,
      category: e.category,
      priority: e.priority,
      script: generateEventScript(e, language),
    })),
    combined,
    language,
    event_count: events.length,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Validate that a language is supported
 * @param {string} language - Language code
 * @returns {boolean} True if supported
 */
function isLanguageSupported(language) {
  return SCRIPT_TEMPLATES.hasOwnProperty(language);
}

/**
 * Get supported languages
 * @returns {Array<string>} Array of supported language codes
 */
function getSupportedLanguages() {
  return Object.keys(SCRIPT_TEMPLATES);
}

/**
 * Add or update a template
 * @param {string} language - Language code
 * @param {string} priorityLevel - Priority level
 * @param {string} category - Event category
 * @param {string} template - Template string
 */
function setTemplate(language, priorityLevel, category, template) {
  if (!SCRIPT_TEMPLATES[language]) {
    SCRIPT_TEMPLATES[language] = {};
  }
  if (!SCRIPT_TEMPLATES[language][priorityLevel]) {
    SCRIPT_TEMPLATES[language][priorityLevel] = {};
  }
  SCRIPT_TEMPLATES[language][priorityLevel][category] = template;
}

export {
  generateEventScript,
  generateEventScripts,
  generateCombinedScript,
  generateBroadcastScript,
  getTemplate,
  fillTemplate,
  getPriorityLevel,
  isLanguageSupported,
  getSupportedLanguages,
  setTemplate,
  SCRIPT_TEMPLATES,
};
