import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { SmartBin } from '../src/models/SmartBin.js';
import { WasteEvent } from '../src/models/WasteEvent.js';

/**
 * Read-only look at what is actually stored in MongoDB.
 *
 *   npm run db:inspect            summary of both collections
 *   npm run db:inspect -- WB-01   drill into one bin
 *
 * Nothing here writes: it is for checking that the app and the database agree.
 */

const pad = (value, width) => String(value).padStart(width);

async function main() {
  const [, , binCode] = process.argv;

  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${env.mongoUri}\n`);

  const [binCount, eventCount] = await Promise.all([
    SmartBin.countDocuments(),
    WasteEvent.countDocuments(),
  ]);

  console.log(`Collections   smartbins ${binCount}   wasteevents ${eventCount}`);

  const bySource = await WasteEvent.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]);
  console.log(
    `Event sources ${bySource.map((row) => `${row._id}=${row.count}`).join('  ')}` +
      '   (SEED = demo data, GEMINI = real scan, DEMO = no API key)',
  );

  const newest = await WasteEvent.findOne().sort({ createdAt: -1 }).lean();
  const oldest = await WasteEvent.findOne().sort({ createdAt: 1 }).lean();
  console.log(
    `Date range    ${oldest?.createdAt.toISOString().slice(0, 16)} -> ${newest?.createdAt
      .toISOString()
      .slice(0, 16)}`,
  );

  const future = await WasteEvent.countDocuments({ createdAt: { $gt: new Date() } });
  console.log(`Future-dated  ${future}${future ? '  <- should be 0, re-run npm run seed' : ''}\n`);

  if (binCode) {
    await inspectBin(binCode);
  } else {
    await listBins();
  }

  await mongoose.disconnect();
}

async function listBins() {
  const bins = await SmartBin.find().sort({ code: 1 });

  console.log('CODE   FILL   IN BIN   COLLECTED   ITEMS   STATUS');
  for (const bin of bins) {
    console.log(
      `${bin.code}  ${pad(Math.round(bin.currentFillPercentage) + '%', 4)}  ` +
        `${pad(bin.sensors.estimatedWeightKg.toFixed(1) + 'kg', 7)}  ` +
        `${pad(bin.totalWasteKg.toFixed(1) + 'kg', 9)}  ` +
        `${pad(bin.totalEvents, 6)}   ${bin.status}`,
    );
  }

  console.log('\nRun `npm run db:inspect -- WB-01` to drill into one bin.');
}

async function inspectBin(code) {
  const bin = await SmartBin.findOne({ code: code.toUpperCase() });
  if (!bin) {
    console.log(`No bin with code ${code}.`);
    return;
  }

  console.log(`${bin.name}\n${bin.location.address}\n`);
  console.log(`Fill        ${bin.currentFillPercentage}%  (${bin.status})`);
  console.log(`In bin now  ${bin.sensors.estimatedWeightKg} kg of ${bin.capacityKg} kg capacity`);
  console.log(`Collected   ${bin.totalWasteKg} kg across ${bin.totalEvents} items`);
  console.log(`Last emptied ${bin.lastCollectedAt?.toISOString().slice(0, 16)}\n`);

  console.log('Per sub-bin:');
  for (const [key, kg] of Object.entries(bin.wasteByCategoryKg.toObject())) {
    console.log(`  ${key.padEnd(20)} ${pad(kg.toFixed(2) + ' kg', 10)}  ${pad(bin.eventCounts[key], 6)} items`);
  }

  const recent = await WasteEvent.find({ smartBinId: bin._id }).sort({ createdAt: -1 }).limit(8).lean();
  console.log('\nMost recent events:');
  for (const event of recent) {
    console.log(
      `  ${event.createdAt.toISOString().slice(0, 16)}  ${event.item.padEnd(30)} ` +
        `${event.category.padEnd(22)} ${pad(event.estimatedWeightKg, 6)} kg  [${event.source}]`,
    );
  }
  console.log('');
}

main().catch(async (error) => {
  console.error('[db:inspect] failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
