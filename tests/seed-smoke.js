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
  recordDiagnostic
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

console.log("seed smoke test passed");
