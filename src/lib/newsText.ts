// Adapter — re-exports from legacy until TTS text processing moves to backend `utils/newsText.js`.
export {
  stripHtml,
  getCategoryIntro,
  newsItemToSpeech,
  newsItemsToSpeechText,
  isLezoTrafficItem,
  getLezoTrafficIntro,
  getLezoTrafficOutro,
  lezoTrafficItemToSpeech,
  lezoTrafficSegmentIntro,
  newsItemsToTranscript,
} from '../_legacy/lib/newsText';
