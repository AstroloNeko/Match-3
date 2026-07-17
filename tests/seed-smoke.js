const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const gamePath = path.join(__dirname, "..", "game.js");
const gameSource = fs.readFileSync(gamePath, "utf8");
const testApiSource = `
globalThis.__testApi = {
  startLevel,
  snapshot: () => JSON.stringify({
    level,
    levelSeed,
    orders,
    queuedOrder,
    items: items.map(({ uid, typeId, variant, row, col, layer, linkedUid }) => ({
      uid, typeId, variant, row, col, layer, linkedUid
    }))
  }),
  report: () => JSON.parse(buildDiagnosticReport()),
  recordDiagnostic,
  generate: (seed, nextLevel) => {
    runSeed = seed;
    startLevel(nextLevel, "menu");
    const goodsByType = {};
    items.filter((item) => item.variant !== "bomb").forEach((item) => {
      goodsByType[item.typeId] = (goodsByType[item.typeId] || 0) + 1;
    });
    return {
      report: JSON.parse(JSON.stringify(generationReport)),
      goodsByType,
      bombCount: items.filter((item) => item.variant === "bomb").length
    };
  },
  generateEndless: (seed, wave) => {
    gameMode = "endless";
    endlessRun = { wave };
    runSeed = seed;
    startLevel(wave, "menu");
    const goodsByType = {};
    items.filter((item) => item.variant !== "bomb").forEach((item) => {
      goodsByType[item.typeId] = (goodsByType[item.typeId] || 0) + 1;
    });
    return {
      report: JSON.parse(JSON.stringify(generationReport)),
      goodsByType,
      bombCount: items.filter((item) => item.variant === "bomb").length,
      traySlots: tray.slots,
      timeLimit: currentConfig.timeLimit
    };
  },
  restockEndless: (seed) => {
    gameMode = "endless";
    endlessRun = { wave: 1 };
    runSeed = seed;
    startLevel(1, "menu");
    const goods = items.filter((item) => item.variant !== "bomb");
    goods.slice(12).forEach((item) => { item.cleared = true; });
    const retainedUids = activeItems().filter((item) => item.variant !== "bomb").map((item) => item.uid);
    startNextEndlessWave();
    const activeUids = activeItems().map((item) => item.uid);
    return {
      wave: endlessRun.wave,
      retained: retainedUids.every((uid) => activeUids.includes(uid)),
      uniqueIds: new Set(activeUids).size === activeUids.length,
      shelfGoods: activeItems().filter((item) => item.variant !== "bomb").length,
      traySlots: tray.slots
    };
  }
};
`;

function createClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    toggle: (name) => values.has(name) ? values.delete(name) : values.add(name),
    contains: (name) => values.has(name)
  };
}

function createElement(id = "") {
  return {
    id,
    textContent: "",
    innerHTML: "",
    disabled: false,
    style: {},
    classList: createClassList(),
    children: [],
    addEventListener() {},
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    remove() {},
    select() {},
    setPointerCapture() {}
  };
}

function createContext(seed, level) {
  const gradient = { addColorStop() {} };
  const drawingContext = new Proxy({}, {
    get(target, property) {
      if (property === "createLinearGradient") return () => gradient;
      if (property === "measureText") return (text) => ({ width: String(text).length * 10 });
      return target[property] || (() => {});
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    }
  });
  const elements = new Map();
  const document = {
    body: createElement("body"),
    getElementById(id) {
      if (!elements.has(id)) {
        const element = createElement(id);
        if (id === "game") {
          element.width = 720;
          element.height = 1080;
          element.getContext = () => drawingContext;
          element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 720, height: 1080 });
        }
        elements.set(id, element);
      }
      return elements.get(id);
    },
    createElement
  };
  const href = `https://example.test/Match-3/?seed=${encodeURIComponent(seed)}&level=${level}`;
  const storage = new Map();
  const sandbox = {
    URL,
    URLSearchParams,
    Uint32Array,
    console,
    crypto: require("node:crypto").webcrypto,
    document,
    window: { location: { href, search: new URL(href).search } },
    navigator: { clipboard: { writeText: async () => {} } },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    performance: { now: () => 1000 },
    requestAnimationFrame() {},
    setTimeout() {},
    clearTimeout() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(`${gameSource}\n${testApiSource}`, sandbox, { filename: "game.js" });
  return sandbox.__testApi;
}

const first = createContext("FIXED-SEED", 4);
const second = createContext("FIXED-SEED", 4);
assert.equal(first.snapshot(), second.snapshot(), "same seed and level must create the same board");

first.startLevel(4, "menu");
const restarted = first.snapshot();
first.startLevel(4, "menu");
assert.equal(first.snapshot(), restarted, "restarting a level must reset the same random sequence");

const different = createContext("OTHER-SEED", 4);
assert.notEqual(first.snapshot(), different.snapshot(), "different seeds should create different boards");

first.recordDiagnostic("test-event", "test diagnostic");
const report = first.report();
assert.equal(report.seed, "FIXED-SEED");
assert.equal(report.level, 4);
assert.equal(report.events[0].code, "test-event");
assert.match(report.url, /seed=FIXED-SEED/);
assert.equal(report.generation.valid, true);

let maxAttempts = 0;
let repairedLinkPairs = 0;
let repairedFrozenItems = 0;
for (let index = 0; index < 120; index += 1) {
  const generated = first.generate(`BATCH-${index}`, 2 + (index % 11));
  assert.equal(
    generated.report.valid,
    true,
    `generated board ${index} must have a playable path (${generated.report.reason}, attempts=${generated.report.attempts}, tray=${generated.report.tray ?? 0})`
  );
  assert.ok(generated.report.attempts >= 1 && generated.report.attempts <= 12, `generated board ${index} must respect retry bounds`);
  maxAttempts = Math.max(maxAttempts, generated.report.attempts);
  repairedLinkPairs += generated.report.removedLinkPairs;
  repairedFrozenItems += generated.report.removedFrozen;
  Object.values(generated.goodsByType).forEach((count) => {
    assert.equal(count % 3, 0, `generated board ${index} must preserve triple inventory`);
  });
  assert.ok(generated.bombCount <= 3, `generated board ${index} must respect the bomb cap`);
}

for (let wave = 1; wave <= 18; wave += 1) {
  const generated = first.generateEndless(`ENDLESS-${wave}`, wave);
  assert.equal(generated.report.valid, true, `endless wave ${wave} must have a playable path`);
  Object.values(generated.goodsByType).forEach((count) => {
    assert.equal(count % 3, 0, `endless wave ${wave} must preserve triple inventory`);
  });
  assert.ok(generated.bombCount >= 1 && generated.bombCount <= 3, `endless wave ${wave} must replenish capped bombs`);
  assert.equal(generated.traySlots, 11, `endless wave ${wave} must start with 11 tray slots`);
  assert.equal(generated.timeLimit, 0, `endless wave ${wave} must disable the total timer`);
}

const restocked = first.restockEndless("ENDLESS-RESTOCK");
assert.equal(restocked.wave, 2, "endless restock must advance the wave counter");
assert.equal(restocked.retained, true, "endless restock must retain the previous shelf tail");
assert.equal(restocked.uniqueIds, true, "endless restock must preserve unique item ids");
assert.ok(restocked.shelfGoods > 12, "endless restock must append goods before the shelf empties");
assert.equal(restocked.traySlots, 11, "endless restock must preserve the 11-slot tray");

console.log(`seed smoke test passed (120 campaign boards + 18 endless waves, max attempts ${maxAttempts}, removed link pairs ${repairedLinkPairs}, removed frozen ${repairedFrozenItems})`);
