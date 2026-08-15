# Wasste — Smart Waste Sorting System

**An AI-powered smart waste management system that uses computer vision, sensors, and intelligent
recommendations to automatically classify urban waste, monitor city waste patterns, and help
municipalities reduce landfill waste and recover valuable resources.**

Wasste is a network of intelligent public bins. Each bin has one input opening, a camera, sensors,
and four underground sub-bins. When someone drops an item in, the camera photographs it, Gemini
Vision identifies it, the system routes it to the right sub-bin, and the event is recorded. Those
events accumulate into something more valuable than sorting: a live picture of how a city produces
waste, and what it could do about it.

```
RECOGNISE → CLASSIFY → COLLECT DATA → ANALYSE → IDENTIFY OPPORTUNITIES → RECOMMEND → MEASURE IMPACT
```

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Project layout](#project-layout)
- [The four categories](#the-four-categories)
- [How the AI is used](#how-the-ai-is-used)
- [Honesty rules](#honesty-rules)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Demo script](#demo-script)
- [Design notes](#design-notes)
- [Future potential](#future-potential)

---

## What it does

| Page | Route | What it shows |
|---|---|---|
| City overview | `/` | Network-wide metrics, waste trend, distribution, schematic bin map, collection queue, city-level AI analysis, all bins |
| Waste scanner | `/scan` | Upload or photograph an item, classify it with Gemini Vision, record it against a bin |
| Collection route | `/routes` | Today's optimised round built from live fill levels, with time, fuel and CO₂ saved against a fixed round, plus an AI dispatch briefing |
| Analytics | `/analytics` | Waste over time, waste by category, distribution, bin fill levels, landfill diversion, top locations, data table |
| Bin detail | `/bins/:id` | One bin's fill level, sensors, distribution, history, recent items, and its own AI recommendations |

---

## Architecture

```
                    ┌───────────────────┐
                    │  City dashboard   │
                    │  React + Vite     │
                    └─────────┬─────────┘
                              │ REST
                    ┌─────────▼─────────┐
                    │  Express backend  │
                    └─────────┬─────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
  ┌───────────────┐   ┌──────────────┐   ┌────────────────┐
  │ Classification│   │   MongoDB    │   │   Gemini API   │
  │   service     │   │  bins/events │   │ vision + text  │
  └───────┬───────┘   └──────┬───────┘   └────────┬───────┘
          │                  │                    │
          └──────────────────┴────────────────────┘
                              ▼
                   ┌─────────────────────┐
                   │ Sustainability      │
                   │ agent               │
                   │ observe → reason →  │
                   │ recommend           │
                   └──────────┬──────────┘
                              ▼
              Recommendations · Impact · City insights
```

The backend is a single Express app. There are no microservices, no message brokers, no agent
frameworks and no vector database — deliberately.

---

## Quick start

**Requirements:** Node.js 18+ (tested on 22), MongoDB running locally or a MongoDB Atlas URI, and
optionally a [Gemini API key](https://aistudio.google.com/apikey).

### 1. Start MongoDB

```bash
# Local install, Windows
"C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath "C:\data\db"

# Local install, macOS/Linux
mongod --dbpath /usr/local/var/mongodb
```

Or point `MONGODB_URI` at a free MongoDB Atlas cluster.

### 2. Backend

```bash
cd server
npm install
cp .env.example .env      # then add your GEMINI_API_KEY
npm run seed              # 8 bins and ~30 days of waste events
npm run dev               # http://localhost:5000
```

### 3. Frontend

```bash
cd client
npm install
npm run dev               # http://localhost:5173
```

Open <http://localhost:5173>.

### Running without a Gemini key

The app still runs end to end. Classification returns a clearly labelled **demo result** and the
sustainability agent falls back to **rule-based** recommendations computed from the real data. Both
are labelled as such in the UI — Wasste never presents a fallback as an AI result.

### Running without MongoDB

The API starts anyway and every data route answers `503` with a readable message. The frontend shows
an error state with the fix instead of a blank screen.

---

## Environment variables

**`server/.env`** — never exposed to the browser.

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | _(empty)_ | Google Gemini key. Empty = demo mode. |
| `GEMINI_MODEL` | `gemini-3.7-flash` | Model used for vision and reasoning. `gemini-2.5-flash` is no longer available to new API keys. |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/wasste` | Database connection. |
| `PORT` | `5000` | API port. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Comma-separated CORS allowlist. |

**`client/.env`**

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `/api` (Vite proxy) | Base URL of the Wasste API. |

The Gemini key and the Mongo URI exist only on the server. The browser never calls Gemini directly.

---

## Project layout

```
wasste/
├── client/
│   ├── public/                     wasste-mark.svg
│   └── src/
│       ├── components/             Cards, metrics, badges, meters, map, AI insight
│       │   └── charts/             Recharts wrappers with shared axis + tooltip specs
│       ├── pages/                  Dashboard · Scan · Analytics · BinDetail
│       ├── services/api.js         The only place the client touches the network
│       ├── hooks/                  useApi, useAction, useTheme
│       ├── utils/format.js         Number, weight and date formatting
│       ├── data/wasteCategories.js Category order, labels and colours
│       ├── App.jsx
│       └── main.jsx
│
├── server/
│   └── src/
│       ├── config/                 env, db connection, category definitions
│       ├── models/                 SmartBin, WasteEvent
│       ├── services/
│       │   ├── geminiService.js              REST calls to Gemini (vision + reasoning)
│       │   ├── wasteClassificationService.js Validation and persistence
│       │   ├── sustainabilityAgent.js        Observe → reason → recommend
│       │   ├── analyticsService.js           Deterministic aggregation
│       │   └── agentTools.js                 The agent's data-access "tools"
│       ├── controllers/            bins, waste, ai, dashboard
│       ├── routes/                 REST surface
│       ├── utils/                  impact math, weight table, upload guard, JSON repair
│       ├── seed/seed.js            8 demo bins, ~30 days of events
│       ├── app.js
│       └── server.js
│
└── README.md
```

---

## The four categories

Every item resolves to exactly one of these, or to `UNKNOWN`. Gemini is constrained by a response
schema enum, and the backend re-validates anyway — the model cannot invent a fifth sub-bin.

| Code | UI label | Examples |
|---|---|---|
| `LANDFILL` | Landfill | Coffee cups, wrappers, polystyrene, disposable cutlery |
| `PAPER` | Paper Recycling | Newspaper, cardboard, paper bags, clean paper packaging |
| `RECYCLABLE_CONTAINER` | Recyclable Containers | Plastic bottles, cans, glass jars, recyclable plastic packaging |
| `ORGANICS` | Organics | Food scraps, fruit and vegetables, coffee grounds |
| `UNKNOWN` | Unknown | Anything the model cannot place confidently |

An `UNKNOWN` item is logged but never added to a sub-bin. Below 60% confidence the result is flagged
for human review in the UI.

---

## How the AI is used

Wasste is not a chatbot with a waste theme. Gemini does two specific jobs, and the backend does the
rest.

### 1. Vision — recognise and classify

`server/src/services/geminiService.js` sends the uploaded image with a structured system prompt and
a `responseSchema` that pins `category` to an enum. `wasteClassificationService.js` then validates
the response independently: unknown categories collapse to `UNKNOWN`, confidence is clamped to
0–1 (tolerating a model that answers `94` instead of `0.94`), and malformed JSON is recovered by a
brace-matching parser before being rejected.

### 2. Reasoning — interpret and recommend

`sustainabilityAgent.js` implements **observe → reason → recommend** without an agent framework:

```
OBSERVE     agentTools.js calls real backend functions:
              getBinData · getRecentWasteEvents · getWasteStatistics · getFillLevel
              calculateLandfillDiversion · calculateEstimatedImpact · compareWithCity
              getCategoryTrend

REASON      the resulting briefing goes to Gemini with a schema-constrained prompt

RECOMMEND   summary, key finding, 2–4 prioritised actions, resource-recovery opportunities
```

### 3. Route optimisation — solve, then explain

`server/src/services/routeService.js` contains no AI at all. It selects the bins that have earned a
stop, orders them with **nearest-neighbour plus a 2-opt improvement pass** (which untangles the
crossings a greedy route leaves behind), and costs the round: distance, drive time, servicing time,
diesel and CO₂. The saving is measured against the status quo it replaces — a fixed round that
drives to every bin regardless of how full it is.

Only then does Gemini see the finished plan, and its job is to brief the depot supervisor: why this
sequence, why those bins were skipped (justified by each one's days-until-full), and what the crew
should watch for. It is explicitly told never to invent a distance or an emission figure.

A bin at 90% or above is always collected, whatever the threshold — it is about to overflow. So is a
bin whose sensor is offline, because its real level is unknown and a truck has to go and look.

### The division of labour

```
Backend = calculations + truth
Gemini  = reasoning + recommendations
```

**The model never produces a number that reaches the screen.** Totals, diversion rates, CO₂ figures
and monthly projections are all computed in `server/src/utils/impact.js` from stored waste events.
They are passed to Gemini as context so it can explain them, and the API always returns the
backend's own values. If Gemini is unavailable, the agent falls back to deterministic rules over the
same data and says so.

---

## Honesty rules

A sustainability prototype that overstates itself is worse than one that admits its limits. Wasste
labels everything:

| Label | Meaning |
|---|---|
| **Measured** | Derived from recorded waste events and bin readings |
| **Estimated** | A modelled projection using stated assumptions |
| **Simulated sensor data** | This prototype has no hardware; readings are simulated |
| **AI analysis** | Generated by Gemini from the measured data |
| **Rule-based** | Gemini was unavailable; built-in rules produced this |
| **Demo result** | No Gemini key configured; placeholder classification |

The estimation assumptions are not hidden in code comments — they are returned by
`GET /api/health` and documented here:

- **CO₂ avoided per kg diverted:** paper 1.1, containers 1.5, organics 0.5, landfill 0. Rounded
  life-cycle planning figures, not measurements.
- **Avoidable share** (what a reuse/refill programme might prevent): paper 10%, containers 25%,
  organics 15%, landfill 5%. A projection, not observed data.

---

## API reference

Base URL `http://localhost:5000/api`.

### Bins

| Method | Path | Description |
|---|---|---|
| `GET` | `/bins` | All bins with measured impact |
| `GET` | `/bins/:id?days=30` | One bin with category rows, impact, time series, recent events |
| `POST` | `/bins` | Create a bin (`code`, `name`, `location`, `capacityKg`) |
| `POST` | `/bins/:id/sensor` | Push a simulated reading. An empty body lets the bin drift on its own |

### Waste

| Method | Path | Description |
|---|---|---|
| `POST` | `/waste/classify` | `multipart/form-data`: `image` (≤5 MB), optional `binId`, optional `record` |
| `GET` | `/waste/events?binId=&category=&limit=` | Event log |
| `GET` | `/waste/stats?binId=&days=` | Category totals, time series and impact |

### Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/routes/optimize?fillThreshold=70` | Solved collection round. No AI, so it returns instantly |
| `POST` | `/routes/analyze` | The same plan plus Gemini's dispatch briefing |

### AI

| Method | Path | Description |
|---|---|---|
| `POST` | `/ai/analyze` | Body `{ binId?, days? }`. Without `binId` the agent analyses the whole city |
| `GET` | `/ai/recommendations/:binId?days=` | Same analysis for one bin |

### Dashboard & health

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard?days=30` | Everything the city overview needs in one request |
| `GET` | `/health` | Database and Gemini status, category definitions, impact assumptions |

**Example — classify an item**

```bash
curl -X POST http://localhost:5000/api/waste/classify \
  -F "image=@bottle.jpg" \
  -F "binId=<bin id>"
```

```json
{
  "classification": {
    "category": "RECYCLABLE_CONTAINER",
    "categoryLabel": "Recyclable Containers",
    "item": "plastic bottle",
    "confidence": 0.94,
    "reason": "The object appears to be a PET plastic bottle commonly accepted as a recyclable container.",
    "needsReview": false,
    "estimatedWeightKg": 0.03,
    "recommendedBin": "Recyclable Containers"
  },
  "source": "GEMINI",
  "recorded": true
}
```

---

## Data model

### SmartBin

```js
{
  code: 'WB-01',
  name: 'Wasste Bin #01 - Yonge Street',
  location: { latitude, longitude, address, neighbourhood },
  capacityKg: 60,                     // combined usable capacity of the four sub-bins
  currentFillPercentage: 72,          // what is in the bin right now
  status: 'NEEDS_ATTENTION',          // always derived from fill level
  wasteByCategoryKg: { landfill, paper, recyclableContainers, organics },  // lifetime, measured
  eventCounts:       { landfill, paper, recyclableContainers, organics },
  sensors: { lastReadingAt, estimatedWeightKg, temperatureC, source: 'SIMULATED' },
  lastCollectedAt: Date,
  lastUpdated: Date
}
```

Virtuals: `totalWasteKg`, `wasteDistribution` (percentages that always total 100), `totalEvents`.

**Fill level and lifetime total are different things, and they reconcile.** `wasteByCategoryKg` is
everything the bin has ever taken; `currentFillPercentage` is only what has arrived since
`lastCollectedAt`. The seed derives the collection date by walking the event log backwards until it
reaches the target load, so a bin never claims to hold more than it has collected. Yonge Street:
204 kg collected over 30 days, 43 kg in the bin right now, last emptied about eight days ago.

### WasteEvent

```js
{
  smartBinId, category, item, confidence,
  estimatedWeightKg, reason, imageUrl,
  source: 'GEMINI' | 'DEMO' | 'SEED',
  needsReview: Boolean,
  createdAt: Date
}
```

Every classification writes one event. Bin totals are only ever the sum of its events, so every
chart in the app reconciles with the underlying log.

### Status thresholds

| Fill | Status |
|---|---|
| 0–69% | `ACTIVE` |
| 70–89% | `NEEDS_ATTENTION` |
| 90–100% | `FULL` |
| — | `OFFLINE` (no recent sensor reading) |

### Weight estimation

Uploaded images carry no weight, so `server/src/utils/weight.js` maps the recognised item to a
weight from a fixed lookup table (plastic bottle 25 g, cardboard box 150 g, glass bottle 300 g,
apple core 30 g, bagged mixed waste 350 g …) with a per-category fallback. Keeping this in the
backend makes the number deterministic and reproducible instead of something the model invents. A
production bin would use its load cell.

The table matters more than it looks: waste streams are compared **by weight**, so if landfill items
are all modelled as featherweight packaging the city's diversion rate comes out around 90% and the
whole dashboard reads as fiction. Real public bins also receive bagged and food-soaked waste, and
with those included the seeded network lands at a believable **74% diversion**, varying from 62% at
Yonge-Dundas Square to 82% at Kensington Market.

---

## Demo script

1. **City overview** — 8 bins, total collected, landfill diversion, avoidable waste, CO₂ avoided.
   Point out the schematic map and the collection queue.
2. **Pick a bin** — click *Yonge-Dundas Square* (93% full, `FULL`). Show its distribution donut,
   30-day trend, and simulated sensor block.
3. **Scan waste** — go to `/scan`, choose that bin, upload a photo of a plastic bottle,
   press **Analyse waste**. Gemini returns the item, category, confidence and reasoning.
4. **The event is recorded** — the result card links back to the bin. Its item count, collected
   weight and fill level have all moved.
   *(One bottle is ~25 g against a bin that has collected 200 kg, so the percentage split shifts
   slowly by design — the item counter and the recent-classifications feed are where a single scan
   is visible. Nothing is faked to make the demo look better.)*
5. **Run the agent** — press **Analyse sustainability** on the bin page. The agent gathers that
   bin's data, compares it against the city average, and returns prioritised actions plus a monthly
   impact estimate computed by the backend.
6. **City impact** — back on `/`, run the city-wide analysis for the closing view: what is being
   diverted, what could be recovered, and what the city should do next.

To make a bin fill up live, press **Simulate a sensor reading** on its detail page.

---

## Design notes

**Charts.** The four category colours were chosen with a palette validator rather than by eye. They
pass, in both light and dark mode, on the exact surfaces used: the lightness band, a chroma floor,
colour-vision-deficiency separation for every adjacent pair (worst case ΔE 9.1 light / 8.4 dark
against a target of 8), and the normal-vision floor (22.9 / 19.8 against a floor of 15).

That safety depends on the **draw order** — landfill, paper, containers, organics — so series are
never sorted by value, and colour always follows the category rather than its rank. Two of the light
-mode colours sit below 3:1 contrast on the light surface, so every chart ships a legend carrying the
exact kilograms and percentages, and the analytics page has a full data table.

Other rules applied throughout: 2px lines, bars capped at 24px with 4px rounded data-ends, a 2px
surface gap separating touching marks instead of outlines, hairline recessive gridlines, no dual
axes anywhere, and text always in ink tokens rather than the series colour.

**Theme.** Light and dark are both explicitly designed — dark is a re-stepped palette on a dark
surface, not an inverted light one. The toggle is in the header; with no choice stored, the OS
preference wins.

---

## Future potential

The MVP simulates the physical layer. The software is structured so it can be replaced with real
hardware without redesign:

```
Camera → Edge device → Wasste API → Gemini Vision → Classification → Servo sorter → Sub-bin
Ultrasonic sensor → fill level      Load cell → weight      Temperature probe → monitoring
```

`POST /api/bins/:id/sensor` is already the endpoint a real device would post to.

Beyond that: predictive collection scheduling, garbage-truck route optimisation, city-wide waste
heatmaps, waste-generation forecasting, a recovered-materials marketplace, municipal dashboards,
carbon accounting, and computer vision running at the edge instead of in the cloud.

None of these are required for the prototype.
