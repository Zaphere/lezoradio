/**
 * Check provider registry status
 */

import registry from './providers/providerRegistry.js';

async function checkProviderStatus() {
  console.log('Checking provider registry status...\n');

  const allProviders = registry.getAll();
  console.log(`Total registered providers: ${allProviders.length}`);

  allProviders.forEach(provider => {
    console.log(`\nProvider: ${provider.providerId}`);
    console.log(`  Enabled: ${provider.enabled}`);
    console.log(`  Has config: ${!!provider.config}`);
    if (provider.config) {
      console.log(`  Config keys: ${Object.keys(provider.config).join(', ')}`);
    }
  });

  const enabledProviders = registry.getEnabled();
  console.log(`\nEnabled providers: ${enabledProviders.length}`);
  enabledProviders.forEach(provider => {
    console.log(`  - ${provider.providerId}`);
  });
}

checkProviderStatus();
