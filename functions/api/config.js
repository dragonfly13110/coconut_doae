import { CONFIG } from '../../src/core.js';
import { json, methodNotAllowed } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  return json({
    loginAccounts: CONFIG.loginAccounts || CONFIG.provinces,
    dataProvinces: CONFIG.provinces,
    totalRounds: CONFIG.totalRounds,
    maxPlots: CONFIG.maxPlots,
    bunchesPerPlot: CONFIG.bunchesPerPlot,
    roundDates: CONFIG.roundDates,
    demoMode: env.DEMO_MODE === 'true',
  });
}
