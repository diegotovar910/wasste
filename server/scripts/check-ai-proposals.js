/**
 * Exercises the AI-proposal plumbing with FAKE Gemini payloads.
 *
 *   npm run check:proposals
 *
 * No API call is made and no credits are spent. The point is to prove that a
 * malformed, incomplete or hostile proposal from the model can never produce a
 * bad route or an illegal parameter set.
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import {
  planCollectionRoute,
  evaluateProposedOrder,
  sanitiseRecommendedSettings,
} from '../src/services/routeService.js';

await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });

const plan = await planCollectionRoute({});
const solverOrder = plan.stops.map((s) => s.code);
console.log('Ruta del solver   :', solverOrder.join(' → '), `= ${plan.optimised.distanceKm} km`);

const cases = [
  { name: 'reordenada (fullest first)', order: ['WB-03', 'WB-08', 'WB-05', 'WB-01', 'WB-07'] },
  { name: 'misma que el solver', order: solverOrder },
  { name: 'invertida', order: [...solverOrder].reverse() },
  { name: 'con codigo inexistente', order: ['WB-99', 'WB-03', 'WB-08', 'WB-05', 'WB-01', 'WB-07'] },
  { name: 'incompleta (faltan 2)', order: ['WB-03', 'WB-08', 'WB-05'] },
  { name: 'con duplicados', order: ['WB-03', 'WB-03', 'WB-08', 'WB-05', 'WB-01', 'WB-07'] },
  { name: 'minusculas y espacios', order: [' wb-03 ', 'wb-08', 'wb-05', 'wb-01', 'wb-07'] },
  { name: 'vacia', order: [] },
  { name: 'basura', order: ['no', 'existe'] },
];

console.log('\n--- propuestas de ruta ---');
for (const test of cases) {
  const result = evaluateProposedOrder(plan, test.order);
  if (!result) {
    console.log(`  ${test.name.padEnd(30)} -> null (sin paradas validas)`);
    continue;
  }
  console.log(
    `  ${test.name.padEnd(30)} -> ${result.stops.map((s) => s.code).join(' ')}  ` +
      `${result.cost.distanceKm}km  delta ${result.comparison.distanceDeltaKm >= 0 ? '+' : ''}${result.comparison.distanceDeltaKm}km  ` +
      `${result.comparison.verdict}${result.repaired ? '  [REPARADA]' : ''}`,
  );
}

console.log('\n--- saneado de parametros propuestos ---');
const settingCases = [
  { name: 'validos', raw: { fillThreshold: 85, maxShiftMinutes: 600, objective: 'URGENCY' } },
  { name: 'fuera de rango', raw: { fillThreshold: 500, maxStops: -3, payloadKg: 999999 } },
  { name: 'enum invalido', raw: { mode: 'TELEPORT', objective: 'VIBES' } },
  { name: 'tipos erroneos', raw: { fillThreshold: 'mucho', includeOffline: 'si', maxStops: null } },
  { name: 'hora invalida', raw: { departureTime: '99:99' } },
  { name: 'hora valida', raw: { departureTime: '05:30' } },
  { name: 'vacio', raw: {} },
  { name: 'null', raw: null },
];

for (const test of settingCases) {
  const { settings, changes } = sanitiseRecommendedSettings(test.raw, plan.params);
  console.log(
    `  ${test.name.padEnd(18)} -> cambios: ${changes.length ? changes.map((c) => `${c.key}:${c.from}→${c.to}`).join(', ') : '(ninguno)'}`,
  );
  // The merged settings must always be a legal parameter set.
  const bad = [];
  if (settings.fillThreshold < 0 || settings.fillThreshold > 100) bad.push('fillThreshold');
  if (settings.maxStops < 0 || settings.maxStops > 50) bad.push('maxStops');
  if (settings.payloadKg < 0) bad.push('payloadKg');
  if (!['COLLECTION', 'URGENT', 'MAINTENANCE'].includes(settings.mode)) bad.push('mode');
  if (bad.length) console.log(`     !! parametros ilegales: ${bad.join(', ')}`);
}

await mongoose.disconnect();
