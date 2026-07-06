export default {
  provider: 'lezotraffic',
  supportsRealtime: false,
  supportsPolling: true,
  supportsPagination: true,
  supportsIncrementalSync: true,
  supportsGeoFiltering: true,
  supportsLanguage: ['fr'],
  supportedEndpoints: [
    'incidents',
    'accidents',
    'routes',
    'transports',
    'provinces',
    'destinations',
    'radios',
  ],
};
