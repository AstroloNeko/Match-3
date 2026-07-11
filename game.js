const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const levelText = document.getElementById("levelText");
const itemsText = document.getElementById("itemsText");
const timeText = document.getElementById("timeText");
const overlay = document.getElementById("overlay");
const modalKicker = document.getElementById("modalKicker");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const primaryBtn = document.getElementById("primaryBtn");
const secondaryBtn = document.getElementById("secondaryBtn");
const restartBtn = document.getElementById("restartBtn");
const hintBtn = document.getElementById("hintBtn");
const reviveBtn = document.getElementById("reviveBtn");
const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
const continueBtn = document.getElementById("continueBtn");
const rogueBtn = document.getElementById("rogueBtn");
const tutorialBtn = document.getElementById("tutorialBtn");
const tutorialPanel = document.getElementById("tutorialPanel");
const difficultyOverlay = document.getElementById("difficultyOverlay");
const difficultyBtn = document.getElementById("difficultyBtn");
const bestScoreText = document.getElementById("bestScoreText");
const bestLevelText = document.getElementById("bestLevelText");
const lastRunText = document.getElementById("lastRunText");
const modalRecord = document.getElementById("modalRecord");
const seedBtn = document.getElementById("seedBtn");
const seedText = document.getElementById("seedText");
const diagnosticsBtn = document.getElementById("diagnosticsBtn");
const diagnosticCount = document.getElementById("diagnosticCount");
const diagnosticsOverlay = document.getElementById("diagnosticsOverlay");
const diagnosticsSeed = document.getElementById("diagnosticsSeed");
const diagnosticsSummary = document.getElementById("diagnosticsSummary");
const diagnosticList = document.getElementById("diagnosticList");
const copyReportBtn = document.getElementById("copyReportBtn");
const closeDiagnosticsBtn = document.getElementById("closeDiagnosticsBtn");
const modalDiagnosticsBtn = document.getElementById("modalDiagnosticsBtn");
const pauseBtn = document.getElementById("pauseBtn");
const pauseOverlay = document.getElementById("pauseOverlay");
const resumeBtn = document.getElementById("resumeBtn");
const pauseTutorialBtn = document.getElementById("pauseTutorialBtn");
const pauseTutorialPanel = document.getElementById("pauseTutorialPanel");
const upgradeOverlay = document.getElementById("upgradeOverlay");
const upgradeChoices = document.getElementById("upgradeChoices");

const W = canvas.width;
const H = canvas.height;
const shelf = { x: 40, y: 226, w: 640, h: 900, rows: 6, cols: 7 };
const tray = { x: 54, y: 1190, w: 612, h: 128, slots: 7 };
const BASE_TRAY_SLOTS = 9;
const MAX_TRAY_SLOTS = 11;
const ORDER_COUNT = 4;
const LEADERBOARD_KEY = "match3ShelfLeaderboard";
const SAVE_KEY = "match3ShelfActiveGameV1";
const ROGUE_SAVE_KEY = "match3ShelfRogueRunV1";
const MAX_BOMBS_PER_LEVEL = 3;
const EMERGENCY_THAW_COOLDOWN = 1.15;
let cellW = shelf.w / shelf.cols;
let cellH = shelf.h / shelf.rows;

function levelConfig(levelNumber) {
  const tier = Math.min(levelNumber, 12);
  if (levelNumber === 1) {
    return {
      rows: 5,
      cols: 6,
      typeCount: 3,
      timeLimit: 108,
      refillTarget: 18,
      baseTriples: 4,
      obstruction: 0.08,
      rushChance: 0,
      bulkChance: 0,
      dualChance: 0,
      rushPatience: 32,
      bonusItemChance: 0.04,
      frozenItemChance: 0,
      bombItemChance: 0,
      linkedItemChance: 0,
      freezeMatches: 1
    };
  }

  const spike = tier - 1;
  const rows = spike < 3 ? 10 : spike < 6 ? 12 : spike < 9 ? 13 : 14;
  const cols = 8;
  const capacity = rows * cols;
  return {
    rows,
    cols,
    typeCount: Math.min(5 + Math.floor(spike / 2), itemTypes.length),
    timeLimit: Math.max(48, 78 - spike * 2),
    refillTarget: Math.min(Math.floor(capacity * (0.82 + spike * 0.018)), capacity + 16),
    baseTriples: Math.min(14 + spike * 4, 42),
    obstruction: 0.34 + Math.min(spike, 10) * 0.055,
    rushChance: Math.min(0.34 + spike * 0.045, 0.68),
    bulkChance: Math.min(0.18 + spike * 0.04, 0.5),
    dualChance: Math.min(0.14 + spike * 0.04, 0.46),
    rushPatience: Math.max(13, 26 - spike * 1.1),
    bonusItemChance: Math.min(0.06 + spike * 0.012, 0.18),
    frozenItemChance: Math.min(0.08 + spike * 0.018, 0.24),
    bombItemChance: Math.min(0.035 + spike * 0.012, 0.14),
    linkedItemChance: Math.min(0.1 + spike * 0.022, 0.3),
    freezeMatches: 1
  };
}

const itemTypes = [
  { id: "cup", label: "杯", color: "#d62839", icon: "C" },
  { id: "plant", label: "植", color: "#48a868", icon: "P" },
  { id: "book", label: "书", color: "#3f82d7", icon: "B" },
  { id: "ball", label: "球", color: "#f2b84b", icon: "O" },
  { id: "box", label: "盒", color: "#9c6ade", icon: "X" },
  { id: "lamp", label: "灯", color: "#c026d3", icon: "L" },
  { id: "star", label: "星", color: "#18a7a2", icon: "S" },
  { id: "shoe", label: "鞋", color: "#7b8794", icon: "U" },
  { id: "cake", label: "糕", color: "#d96c9f", icon: "K" },
  { id: "milk", label: "奶", color: "#5aa7e8", icon: "M" },
  { id: "toy", label: "玩", color: "#5fbf7f", icon: "T" },
  { id: "soap", label: "皂", color: "#46b5c8", icon: "Z" }
];

let level = 1;
let items = [];
let trayItems = [];
let orders = [];
let queuedOrder = null;
let completedOrders = 0;
let score = 0;
let runScore = 0;
let combo = 0;
let currentConfig = levelConfig(1);
let timeLeft = 75;
let lastTick = 0;
let state = "menu";
let nextUid = 1;
let nextOrderId = 1;
let message = "";
let messageUntil = 0;
let bombDrag = null;
let bombsCreated = 0;
let emergencyThawTimer = 0;
let pendingShipment = null;
let deliveryFlights = [];
let trackableShelfRows = new Set();
let clearedShelfRows = new Map();
let clearanceSweep = null;
let hoverItemUid = null;
let pulseItems = new Set();
let shakeItems = new Set();
let confetti = [];
let runSeed = "";
let levelSeed = "";
let randomState = 1;
let diagnosticEvents = [];
let requestedStartLevel = 1;
let diagnosticsPreviousState = "playing";
let generationReport = null;
let pausePreviousState = "playing";
let lastAutoSaveAt = 0;
let gameMode = "campaign";
let rogueRun = { floor: 1, upgrades: [] };

const rogueUpgrades = [
  { id: "slot", name: "扩建仓位", description: "本局后续楼层的卡槽永久 +1。" },
  { id: "bomb", name: "爆破补给", description: "每层货架额外生成 1 枚炸弹。" },
  { id: "star", name: "星级服务", description: "星标货的时间奖励额外 +2 秒。" },
  { id: "cold", name: "冷链升级", description: "冷链货出货时额外奖励 3 秒。" },
  { id: "clock", name: "弹性排班", description: "每层开始时额外获得 12 秒。" },
  { id: "insurance", name: "急单保险", description: "每层第一次急单超时不扣时间。" }
];
let rogueInsuranceReady = false;

function rogueUpgradeCount(id) {
  return gameMode === "rogue" ? rogueRun.upgrades.filter((upgradeId) => upgradeId === id).length : 0;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function generateRunSeed() {
  try {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0].toString(36).toUpperCase().padStart(7, "0");
  } catch (error) {
    return (Date.now() >>> 0).toString(36).toUpperCase().padStart(7, "0");
  }
}

function normalizeSeed(value) {
  const normalized = String(value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  return normalized || generateRunSeed();
}

function initializeLevelRandom(levelNumber) {
  levelSeed = `${runSeed}-${levelNumber}`;
  randomState = hashSeed(levelSeed) || 0x6d2b79f5;
}

function gameRandom() {
  randomState += 0x6d2b79f5;
  let value = randomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(gameRandom() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function choice(array) {
  return array[Math.floor(gameRandom() * array.length)];
}

function availableTypes() {
  const count = currentConfig.typeCount;
  return itemTypes.slice(0, count).map((type) => type.id);
}

function itemType(typeId) {
  return itemTypes.find((item) => item.id === typeId);
}

function defaultLeaderboard() {
  return {
    bestScore: 0,
    bestLevel: 1,
    lastScore: 0,
    lastLevel: 1
  };
}

function loadLeaderboard() {
  try {
    return { ...defaultLeaderboard(), ...JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "{}") };
  } catch (error) {
    return defaultLeaderboard();
  }
}

function saveLeaderboard(data) {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(data));
  } catch (error) {
    // Local storage can be unavailable in privacy modes; the game should still run.
  }
}

function formatScore(value) {
  return Math.max(0, Math.round(value)).toLocaleString("zh-CN");
}

function updateLeaderboardPanel() {
  const board = loadLeaderboard();
  if (bestScoreText) bestScoreText.textContent = formatScore(board.bestScore);
  if (bestLevelText) bestLevelText.textContent = board.bestLevel;
  if (lastRunText) lastRunText.textContent = `${formatScore(board.lastScore)} / ${board.lastLevel}关`;
}

function recordRunResult(levelReached, totalScore) {
  const board = loadLeaderboard();
  const scoreValue = Math.max(0, Math.round(totalScore));
  const levelValue = Math.max(1, levelReached);
  const isBestScore = scoreValue > board.bestScore;
  const isBestLevel = levelValue > board.bestLevel;
  const nextBoard = {
    bestScore: Math.max(board.bestScore, scoreValue),
    bestLevel: Math.max(board.bestLevel, levelValue),
    lastScore: scoreValue,
    lastLevel: levelValue
  };
  saveLeaderboard(nextBoard);
  updateLeaderboardPanel();
  return { board: nextBoard, isBestScore, isBestLevel };
}

function renderModalRecord(totalScore, levelReached, result) {
  if (!modalRecord) return;
  const badge = result.isBestScore || result.isBestLevel ? "新纪录" : "本局";
  modalRecord.classList.remove("is-hidden");
  modalRecord.innerHTML = `
    <div>
      <p class="label">${badge}</p>
      <strong>${formatScore(totalScore)}</strong>
    </div>
    <div>
      <p class="label">到达关卡</p>
      <strong>${levelReached}</strong>
    </div>
    <div>
      <p class="label">历史最佳</p>
      <strong>${formatScore(result.board.bestScore)}</strong>
    </div>
  `;
}

function activeItems() {
  return items.filter((item) => !item.cleared);
}

function selectableItems() {
  return activeItems().filter((item) => !isBlocked(item));
}

function remainingItemCount() {
  const activeGoods = activeItems().filter((item) => item.variant !== "bomb").length;
  const trayGoods = trayItems.filter((item) => item.variant !== "bomb").length;
  const packedGoods = pendingShipment?.shippedItems.filter((item) => item.variant !== "bomb").length || 0;
  return activeGoods + trayGoods + packedGoods;
}

function remainingTypeCounts() {
  const counts = new Map();
  [...activeItems(), ...trayItems].forEach((item) => {
    if (item.variant === "bomb") return;
    counts.set(item.typeId, (counts.get(item.typeId) || 0) + 1);
  });
  return counts;
}

function hasAnyPossibleTriple() {
  return [...remainingTypeCounts().values()].some((count) => count >= 3);
}

function cleanupStrayGoods() {
  if (clearanceSweep || remainingItemCount() === 0 || hasAnyPossibleTriple()) return false;
  const cleaned = remainingItemCount();
  recordDiagnostic("tail-cleanup", "尾货无法成组，触发清仓", { cleaned });
  const goods = activeItems()
    .filter((item) => item.variant !== "bomb")
    .map((item, index) => ({ ...itemCenter(item), typeId: item.typeId, delay: index * 24 }));
  trayItems.forEach((item, index) => {
    if (item.variant === "bomb") return;
    goods.push({ ...trayItemCenter(index), typeId: item.typeId, delay: goods.length * 24 });
  });
  items.forEach((item) => {
    item.cleared = true;
  });
  trayItems = [];
  score += cleaned * 12;
  beginClearanceSweep(goods, cleaned);
  updateClearedShelfRows();
  toast(`尾货打包清仓 ${cleaned} 件`);
  return true;
}

function checkClearWin() {
  if (pendingShipment) return false;
  if (cleanupStrayGoods()) return true;
  if (remainingItemCount() === 0 && state === "playing") {
    items.forEach((item) => {
      item.cleared = true;
    });
    trayItems = [];
    updateClearedShelfRows();
    beginClearanceSweep([], 0);
    return true;
  }
  return false;
}

function configureShelf(config) {
  shelf.rows = config.rows;
  shelf.cols = config.cols;
  cellW = shelf.w / shelf.cols;
  cellH = shelf.h / shelf.rows;
}

function orderTypeIds(order) {
  return order.lines.map((line) => line.typeId);
}

function allOrderTypeIds() {
  return orders.flatMap(orderTypeIds);
}

function createOrder(preferredType) {
  const types = availableTypes();
  const current = new Set(allOrderTypeIds());
  const options = types.filter((typeId) => !current.has(typeId));
  const primary = preferredType || choice(options.length ? options : types);
  const roll = gameRandom();
  let kind = "normal";
  if (roll < currentConfig.dualChance) {
    kind = "dual";
  } else if (roll < currentConfig.dualChance + currentConfig.bulkChance) {
    kind = "bulk";
  } else if (roll < currentConfig.dualChance + currentConfig.bulkChance + currentConfig.rushChance) {
    kind = "rush";
  }

  const lines = [{ typeId: primary, needed: kind === "bulk" ? 6 : 3, progress: 0 }];
  if (kind === "dual") {
    const secondaryOptions = types.filter((typeId) => typeId !== primary);
    lines.push({ typeId: choice(secondaryOptions), needed: 3, progress: 0 });
  }

  return {
    id: nextOrderId++,
    kind,
    lines,
    patience: kind === "rush" ? currentConfig.rushPatience : null,
    maxPatience: kind === "rush" ? currentConfig.rushPatience : null
  };
}

function createItem(typeId, placement, options = {}) {
  const variant = options.variant || chooseItemVariant();
  if (variant === "bomb") bombsCreated += 1;
  return {
    uid: `item-${nextUid++}`,
    typeId,
    variant,
    frozenMatches: 0,
    linkedUid: null,
    row: placement.row,
    col: placement.col,
    layer: placement.layer,
    z: nextUid,
    cleared: false,
    solutionGroup: options.solutionGroup ?? null,
    protectedFromSpecial: Boolean(options.protectedFromSpecial)
  };
}

function chooseItemVariant() {
  const roll = gameRandom();
  if (roll < currentConfig.frozenItemChance) return "frozen";
  if (roll < currentConfig.frozenItemChance + currentConfig.bonusItemChance) return "bonus";
  return "normal";
}

function applyLinkedPairs(candidates) {
  const pool = shuffle(candidates
    .filter((item) => item.variant === "normal" && !item.linkedUid && !item.protectedFromSpecial))
    .sort((a, b) => (a.solutionGroup ?? 999) - (b.solutionGroup ?? 999));
  const pairTarget = Math.floor(pool.length * currentConfig.linkedItemChance);
  const pairCount = Math.floor(pairTarget / 2);
  for (let pairIndex = 0; pairIndex < pairCount && pool.length >= 2; pairIndex += 1) {
    const first = pool.shift();
    let mateIndex = pool.findIndex((item) =>
      item.typeId !== first.typeId && Math.abs((item.solutionGroup ?? 0) - (first.solutionGroup ?? 0)) <= 2
    );
    if (mateIndex < 0) {
      mateIndex = pool.findIndex((item) => Math.abs((item.solutionGroup ?? 0) - (first.solutionGroup ?? 0)) <= 2);
    }
    if (mateIndex < 0) mateIndex = 0;
    const [second] = pool.splice(mateIndex, 1);
    first.variant = "linked";
    second.variant = "linked";
    first.linkedUid = second.uid;
    second.linkedUid = first.uid;
  }
}

function normalizeGeneratedSpecials(candidates) {
  const byGroup = new Map();
  candidates.forEach((item) => {
    if (!byGroup.has(item.solutionGroup)) byGroup.set(item.solutionGroup, []);
    byGroup.get(item.solutionGroup).push(item);
  });
  byGroup.forEach((group) => {
    let keptFrozen = false;
    group.forEach((item) => {
      if (item.variant !== "frozen") return;
      if (!keptFrozen) {
        keptFrozen = true;
      } else {
        item.variant = "normal";
      }
    });
  });
}

function makePlacements(count) {
  const cells = [];
  for (let row = 0; row < shelf.rows; row += 1) {
    for (let col = 0; col < shelf.cols; col += 1) {
      cells.push({ row, col, layer: 0 });
    }
  }

  const middle = cells.filter((cell) => cell.row > 0 && cell.row < shelf.rows - 1 && cell.col > 0 && cell.col < shelf.cols - 1);
  const base = shuffle(cells).slice(0, Math.min(count, cells.length));
  const extra = shuffle([...middle, ...middle].map((cell) => ({ ...cell }))).slice(0, Math.max(0, count - base.length));
  const placements = [...base, ...extra];

  const lifted = shuffle(placements.filter((cell) => cell.row > 0 && cell.row < shelf.rows - 1 && cell.col > 0 && cell.col < shelf.cols - 1));
  const rawLiftCount = Math.min(lifted.length, Math.floor(count * currentConfig.obstruction));
  const liftCount = Math.floor(rawLiftCount / 3) * 3;
  const layerTwoCount = count > shelf.rows * shelf.cols * 0.72 ? Math.floor((liftCount * 0.25) / 3) * 3 : 0;
  lifted.slice(0, liftCount).forEach((cell, index) => {
    cell.layer = index < layerTwoCount ? 2 : 1;
  });

  return shuffle(placements);
}

function emptyShelfPlacements() {
  const occupied = new Set(activeItems().map((item) => `${item.row}:${item.col}:${item.layer}`));
  const base = [];
  const upper = [];
  for (let row = 0; row < shelf.rows; row += 1) {
    for (let col = 0; col < shelf.cols; col += 1) {
      const baseKey = `${row}:${col}:0`;
      const upperKey = `${row}:${col}:1`;
      if (!occupied.has(baseKey)) {
        base.push({ row, col, layer: 0 });
      } else if (!occupied.has(upperKey)) {
        upper.push({ row, col, layer: 1 });
      }
    }
  }
  return [...shuffle(base), ...shuffle(upper)];
}

function returnItemToShelf(item) {
  if (!item || item.variant === "bomb") return false;
  const placement = emptyShelfPlacements()[0];
  if (!placement) return false;
  const restored = {
    ...item,
    row: placement.row,
    col: placement.col,
    layer: placement.layer,
    z: nextUid++,
    cleared: false,
    linkedUid: null,
    frozenMatches: 0,
    variant: item.frozenMatches > 0 ? "frozen" : item.variant === "linked" ? "normal" : item.variant
  };
  items.push(restored);
  return true;
}

function buildTripleTypePlan(pool) {
  const groupCounts = new Map();
  pool.forEach((typeId) => groupCounts.set(typeId, (groupCounts.get(typeId) || 0) + 1));
  groupCounts.forEach((count, typeId) => groupCounts.set(typeId, Math.floor(count / 3)));

  const priorityGroups = [];
  orders.forEach((order) => {
    order.lines.forEach((line) => {
      const requestedGroups = Math.floor(line.needed / 3);
      for (let index = 0; index < requestedGroups && (groupCounts.get(line.typeId) || 0) > 0; index += 1) {
        priorityGroups.push(line.typeId);
        groupCounts.set(line.typeId, groupCounts.get(line.typeId) - 1);
      }
    });
  });

  const remainingGroups = [];
  groupCounts.forEach((count, typeId) => {
    for (let index = 0; index < count; index += 1) remainingGroups.push(typeId);
  });
  const orderedGroups = [...shuffle(priorityGroups), ...shuffle(remainingGroups)];
  return {
    orderedGroups,
    typeIds: orderedGroups.flatMap((typeId) => [typeId, typeId, typeId]),
    protectedGroupCount: priorityGroups.length
  };
}

function makeBombPlacements(goods, bombCount) {
  if (!bombCount) return [];
  const maxLayerByCell = new Map();
  goods.forEach((item) => {
    const key = `${item.row}:${item.col}`;
    maxLayerByCell.set(key, Math.max(maxLayerByCell.get(key) ?? -1, item.layer));
  });
  const candidates = [];
  for (let row = 0; row < shelf.rows; row += 1) {
    for (let col = 0; col < shelf.cols; col += 1) {
      const key = `${row}:${col}`;
      const layer = (maxLayerByCell.get(key) ?? -1) + 1;
      if (layer <= 3) candidates.push({ row, col, layer });
    }
  }
  const middle = candidates.filter((placement) =>
    placement.row > 0 && placement.row < shelf.rows - 1 && placement.col > 0 && placement.col < shelf.cols - 1
  );
  const preferred = middle.length >= bombCount ? middle : candidates;
  return shuffle(preferred).slice(0, bombCount);
}

function candidateItemBlocked(candidate, active) {
  return active.some((other) => {
    if (other.uid === candidate.uid || other.layer <= candidate.layer) return false;
    return Math.abs(other.row - candidate.row) <= 1 && Math.abs(other.col - candidate.col) <= 1;
  });
}

function validateGeneratedBoard(candidateItems) {
  const active = candidateItems.map((item) => ({ ...item }));
  let simulatedTray = [];
  const certificate = [];
  const initialOrderNeeds = new Map();
  orders.forEach((order) => order.lines.forEach((line) => {
    initialOrderNeeds.set(line.typeId, (initialOrderNeeds.get(line.typeId) || 0) + line.needed);
  }));
  let guard = active.length * 8 + 80;

  function unclearedItems() {
    return active.filter((item) => !item.cleared);
  }

  function remainingTypeTotals() {
    const totals = new Map();
    [...unclearedItems(), ...simulatedTray].forEach((item) => {
      if (item.variant === "bomb") return;
      totals.set(item.typeId, (totals.get(item.typeId) || 0) + 1);
    });
    return totals;
  }

  function outstandingOrderNeed() {
    return [...initialOrderNeeds.values()].some((amount) => amount > 0);
  }

  function findShippableTriple() {
    const byType = new Map();
    simulatedTray.forEach((item) => {
      if (item.variant === "bomb" || item.frozenMatches > 0) return;
      if (!byType.has(item.typeId)) byType.set(item.typeId, []);
      byType.get(item.typeId).push(item);
    });
    return [...byType.entries()].find(([typeId, group]) =>
      group.length >= 3 && (!outstandingOrderNeed() || (initialOrderNeeds.get(typeId) || 0) > 0)
    );
  }

  while (guard > 0) {
    guard -= 1;
    const currentActive = unclearedItems();
    const selectable = currentActive.filter((item) => !candidateItemBlocked(item, currentActive));
    selectable.filter((item) => item.variant === "bomb").forEach((item) => {
      item.cleared = true;
      certificate.push({ action: "collect-bomb", uid: item.uid });
    });

    const triple = findShippableTriple();
    if (triple) {
      const [typeId, group] = triple;
      const shippedUids = new Set(group.slice(0, 3).map((item) => item.uid));
      simulatedTray = simulatedTray.filter((item) => !shippedUids.has(item.uid));
      simulatedTray.forEach((item) => {
        if (item.frozenMatches > 0) {
          item.frozenMatches -= 1;
          if (item.frozenMatches === 0) item.variant = "cold";
        }
      });
      if ((initialOrderNeeds.get(typeId) || 0) > 0) {
        initialOrderNeeds.set(typeId, Math.max(0, initialOrderNeeds.get(typeId) - 3));
      }
      certificate.push({ action: "ship-triple", typeId, trayAfter: simulatedTray.length });
      continue;
    }

    const totals = remainingTypeTotals();
    const anyTripleRemaining = [...totals.values()].some((count) => count >= 3);
    if (!anyTripleRemaining && !outstandingOrderNeed()) {
      return { valid: true, reason: "tail-cleanup", certificate, remaining: [...totals.values()].reduce((sum, count) => sum + count, 0) };
    }
    if (!unclearedItems().some((item) => item.variant !== "bomb") && !simulatedTray.length) {
      return { valid: true, reason: "cleared", certificate, remaining: 0 };
    }

    const allowedTypes = outstandingOrderNeed()
      ? new Set([...initialOrderNeeds.entries()].filter(([, amount]) => amount > 0).map(([typeId]) => typeId))
      : new Set([...totals.entries()].filter(([, count]) => count >= 3).map(([typeId]) => typeId));
    const selectableGoods = selectable
      .filter((item) => item.variant !== "bomb" && !item.cleared)
      .sort((a, b) => (a.solutionGroup ?? 999) - (b.solutionGroup ?? 999));
    const nextItem = selectableGoods.find((item) => allowedTypes.has(item.typeId));

    if (!nextItem) {
      const frozenTrayItems = simulatedTray.filter((item) => item.frozenMatches > 0);
      if (frozenTrayItems.length) {
        frozenTrayItems.forEach((item) => {
          item.frozenMatches = 0;
          item.variant = "cold";
        });
        certificate.push({ action: "emergency-thaw", count: frozenTrayItems.length });
        continue;
      }
      return {
        valid: false,
        reason: outstandingOrderNeed() ? "initial-order-path-blocked" : "no-selectable-order-path",
        certificate,
        remaining: [...totals.values()].reduce((sum, count) => sum + count, 0),
        selectable: selectableGoods.length,
        tray: simulatedTray.length,
        trayUids: simulatedTray.map((item) => item.uid)
      };
    }

    const bundle = [nextItem];
    if (nextItem.linkedUid) {
      const mate = active.find((item) => !item.cleared && item.uid === nextItem.linkedUid);
      if (mate) bundle.push(mate);
    }
    if (simulatedTray.length + bundle.length > BASE_TRAY_SLOTS) {
      return {
        valid: false,
        reason: "tray-overflow",
        certificate,
        remaining: [...totals.values()].reduce((sum, count) => sum + count, 0),
        tray: simulatedTray.length,
        bundle: bundle.length,
        trayUids: simulatedTray.map((item) => item.uid)
      };
    }
    bundle.forEach((item) => {
      item.cleared = true;
      simulatedTray.push({
        ...item,
        frozenMatches: item.variant === "frozen" ? currentConfig.freezeMatches : 0
      });
    });
    certificate.push({ action: "pick", uids: bundle.map((item) => item.uid), trayAfter: simulatedTray.length });

    if (simulatedTray.length >= BASE_TRAY_SLOTS && !findShippableTriple()) {
      return {
        valid: false,
        reason: "tray-full-no-match",
        certificate,
        remaining: [...remainingTypeTotals().values()].reduce((sum, count) => sum + count, 0),
        tray: simulatedTray.length,
        trayUids: simulatedTray.map((item) => item.uid)
      };
    }
  }

  return {
    valid: false,
    reason: "simulation-guard",
    certificate,
    remaining: unclearedItems().length,
    tray: simulatedTray.length,
    trayUids: simulatedTray.map((item) => item.uid)
  };
}

function repairGeneratedCandidate(candidateItems, initialValidation) {
  let validation = initialValidation;
  let removedLinkPairs = 0;
  let removedFrozen = 0;

  for (let repair = 0; repair < candidateItems.length && !validation.valid; repair += 1) {
    const trayUids = new Set(validation.trayUids || []);
    const linkedItem = candidateItems.find((item) =>
      item.variant === "linked" && item.linkedUid && (trayUids.has(item.uid) || trayUids.has(item.linkedUid))
    );
    if (linkedItem) {
      const mate = candidateItems.find((item) => item.uid === linkedItem.linkedUid);
      linkedItem.variant = "normal";
      linkedItem.linkedUid = null;
      if (mate) {
        mate.variant = "normal";
        mate.linkedUid = null;
      }
      removedLinkPairs += 1;
      validation = validateGeneratedBoard(candidateItems);
      continue;
    }

    const frozenItem = candidateItems.find((item) => item.variant === "frozen" && trayUids.has(item.uid));
    if (frozenItem) {
      frozenItem.variant = "normal";
      removedFrozen += 1;
      validation = validateGeneratedBoard(candidateItems);
      continue;
    }

    const fallbackLinked = candidateItems.find((item) => item.variant === "linked" && item.linkedUid);
    if (fallbackLinked) {
      const mate = candidateItems.find((item) => item.uid === fallbackLinked.linkedUid);
      fallbackLinked.variant = "normal";
      fallbackLinked.linkedUid = null;
      if (mate) {
        mate.variant = "normal";
        mate.linkedUid = null;
      }
      removedLinkPairs += 1;
      validation = validateGeneratedBoard(candidateItems);
      continue;
    }
    const fallbackFrozen = candidateItems.find((item) => item.variant === "frozen");
    if (fallbackFrozen) {
      fallbackFrozen.variant = "normal";
      removedFrozen += 1;
      validation = validateGeneratedBoard(candidateItems);
      continue;
    }
    break;
  }

  return { validation, removedLinkPairs, removedFrozen };
}

function buildInitialItems() {
  const types = availableTypes();
  const pool = [];

  orders.forEach((order) => {
    order.lines.forEach((line) => {
      for (let i = 0; i < line.needed; i += 1) pool.push(line.typeId);
    });
  });

  const extraTriples = Math.max(
    currentConfig.baseTriples,
    Math.floor((currentConfig.refillTarget - pool.length) / 3)
  );
  for (let i = 0; i < extraTriples; i += 1) {
    const orderTypes = allOrderTypeIds();
    const typeId = i < 3 ? orderTypes[i % orderTypes.length] : types[i % types.length];
    pool.push(typeId, typeId, typeId);
  }

  const plan = buildTripleTypePlan(pool);
  const baseBombCount = currentConfig.bombItemChance > 0
    ? Math.min(MAX_BOMBS_PER_LEVEL, Math.floor(plan.typeIds.length * currentConfig.bombItemChance))
    : 0;
  const bombCount = Math.min(MAX_BOMBS_PER_LEVEL, baseBombCount + rogueUpgradeCount("bomb"));
  let candidateItems = [];
  let validation = null;
  let repairSummary = { removedLinkPairs: 0, removedFrozen: 0 };
  let attempts = 0;
  for (attempts = 1; attempts <= 12; attempts += 1) {
    nextUid = 1;
    bombsCreated = 0;
    const placements = shuffle(makePlacements(plan.typeIds.length)).sort((a, b) => b.layer - a.layer);
    const goods = plan.typeIds.map((typeId, index) => createItem(typeId, placements[index], {
      solutionGroup: Math.floor(index / 3),
      protectedFromSpecial: index < plan.protectedGroupCount * 3,
      variant: index < plan.protectedGroupCount * 3 ? "normal" : undefined
    }));
    normalizeGeneratedSpecials(goods);
    applyLinkedPairs(goods);
    const bombPlacements = makeBombPlacements(goods, bombCount);
    const bombs = bombPlacements.map((placement) => createItem(choice(types), placement, { variant: "bomb" }));
    candidateItems = [...goods, ...bombs];
    validation = validateGeneratedBoard(candidateItems);
    repairSummary = repairGeneratedCandidate(candidateItems, validation);
    validation = repairSummary.validation;
    if (validation.valid) break;
  }
  items = candidateItems;
  generationReport = {
    ...validation,
    groups: plan.orderedGroups.length,
    protectedGroups: plan.protectedGroupCount,
    bombs: bombCount,
    attempts: Math.min(attempts, 12),
    removedLinkPairs: repairSummary.removedLinkPairs,
    removedFrozen: repairSummary.removedFrozen
  };
  if (!generationReport.valid) {
    recordDiagnostic("generator-fallback", "生成器未找到完整结构路径", { reason: generationReport.reason });
  }
}

function clearActiveSave() {
  try {
    localStorage.removeItem(gameMode === "rogue" ? ROGUE_SAVE_KEY : SAVE_KEY);
  } catch (error) {
    // Storage can be unavailable in private browsing or embedded previews.
  }
  refreshContinueButton();
}

function readActiveSave() {
  try {
    const saves = [SAVE_KEY, ROGUE_SAVE_KEY]
      .map((key) => JSON.parse(localStorage.getItem(key) || "null"))
      .filter((saved) => saved?.version === 1 && Array.isArray(saved.items) && Array.isArray(saved.orders));
    return saves.sort((a, b) => b.savedAt - a.savedAt)[0] || null;
  } catch (error) {
    return null;
  }
}

function refreshContinueButton() {
  const saved = readActiveSave();
  continueBtn.disabled = !saved;
  continueBtn.title = saved ? `继续第 ${saved.level} 关` : "暂无可继续的关卡";
  continueBtn.textContent = saved ? `继续 L${saved.level}` : "继续";
}

function saveActiveGame() {
  if (state !== "playing" && state !== "paused") return;
  const snapshot = {
    version: 1,
    savedAt: Date.now(),
    level,
    runSeed,
    randomState,
    items,
    trayItems,
    traySlots: tray.slots,
    orders,
    queuedOrder,
    completedOrders,
    score,
    runScore,
    combo,
    timeLeft,
    nextUid,
    nextOrderId,
    bombsCreated,
    emergencyThawTimer,
    pendingShipment,
    trackableShelfRows: [...trackableShelfRows],
    clearedShelfRows: [...clearedShelfRows.entries()],
    diagnosticEvents,
    generationReport,
    gameMode,
    rogueRun,
    rogueInsuranceReady
  };
  try {
    localStorage.setItem(gameMode === "rogue" ? ROGUE_SAVE_KEY : SAVE_KEY, JSON.stringify(snapshot));
    refreshContinueButton();
  } catch (error) {
    // Keep the game playable when storage quota or browser policy blocks saves.
  }
}

function restoreActiveGame() {
  const saved = readActiveSave();
  if (!saved) {
    refreshContinueButton();
    return false;
  }
  level = Math.max(1, saved.level || 1);
  gameMode = saved.gameMode === "rogue" ? "rogue" : "campaign";
  rogueRun = saved.rogueRun || { floor: level, upgrades: [] };
  rogueInsuranceReady = Boolean(saved.rogueInsuranceReady);
  runSeed = normalizeSeed(saved.runSeed);
  initializeLevelRandom(level);
  randomState = saved.randomState || randomState;
  currentConfig = levelConfig(level);
  configureShelf(currentConfig);
  items = saved.items;
  trayItems = saved.trayItems || [];
  tray.slots = Math.max(BASE_TRAY_SLOTS, Math.min(MAX_TRAY_SLOTS, saved.traySlots || BASE_TRAY_SLOTS));
  orders = saved.orders;
  queuedOrder = saved.queuedOrder || null;
  completedOrders = saved.completedOrders || 0;
  score = saved.score || 0;
  runScore = saved.runScore || 0;
  combo = saved.combo || 0;
  timeLeft = Math.max(1, saved.timeLeft || currentConfig.timeLimit);
  nextUid = saved.nextUid || 1;
  nextOrderId = saved.nextOrderId || 1;
  bombsCreated = saved.bombsCreated || 0;
  emergencyThawTimer = saved.emergencyThawTimer || 0;
  pendingShipment = saved.pendingShipment || null;
  if (pendingShipment) pendingShipment.createdAt = performance.now();
  trackableShelfRows = new Set(saved.trackableShelfRows || activeItems().map((item) => item.row));
  clearedShelfRows = new Map(saved.clearedShelfRows || []);
  diagnosticEvents = saved.diagnosticEvents || [];
  generationReport = saved.generationReport || null;
  deliveryFlights = [];
  clearanceSweep = null;
  pulseItems = new Set();
  shakeItems = new Set();
  confetti = [];
  bombDrag = null;
  hoverItemUid = null;
  message = "";
  messageUntil = 0;
  state = "playing";
  lastTick = performance.now();
  startOverlay.classList.add("is-hidden");
  overlay.classList.add("is-hidden");
  difficultyOverlay.classList.add("is-hidden");
  updateHud();
  updateLeaderboardPanel();
  toast(`已继续第 ${level} 关`);
  return true;
}

function startLevel(nextLevel = level, startState = "playing") {
  if (nextLevel === 1) {
    runScore = 0;
  }
  level = nextLevel;
  initializeLevelRandom(level);
  currentConfig = levelConfig(level);
  configureShelf(currentConfig);
  state = startState;
  overlay.classList.add("is-hidden");
  difficultyOverlay.classList.add("is-hidden");
  trayItems = [];
  tray.slots = Math.min(MAX_TRAY_SLOTS, BASE_TRAY_SLOTS + rogueUpgradeCount("slot"));
  orders = [];
  queuedOrder = null;
  completedOrders = 0;
  score = 0;
  combo = 0;
  nextUid = 1;
  nextOrderId = 1;
  bombsCreated = 0;
  emergencyThawTimer = 0;
  pendingShipment = null;
  deliveryFlights = [];
  trackableShelfRows = new Set();
  clearedShelfRows = new Map();
  clearanceSweep = null;
  pulseItems = new Set();
  shakeItems = new Set();
  confetti = [];
  bombDrag = null;
  hoverItemUid = null;
  timeLeft = currentConfig.timeLimit + rogueUpgradeCount("clock") * 12;
  rogueInsuranceReady = gameMode === "rogue" && rogueUpgradeCount("insurance") > 0;
  message = "";
  messageUntil = 0;
  diagnosticEvents = [];
  generationReport = null;

  for (let i = 0; i < ORDER_COUNT; i += 1) {
    orders.push(createOrder());
  }
  buildInitialItems();
  trackableShelfRows = new Set(activeItems().map((item) => item.row));
  queuedOrder = createOrderFromStock(preferredRefillType());
  stabilizeBoard();
  updateHud();
  updateLeaderboardPanel();
  if (state === "playing") saveActiveGame();
}

function countTypes(source) {
  const counts = {};
  source.forEach((item) => {
    if (item.variant === "bomb") return;
    counts[item.typeId] = (counts[item.typeId] || 0) + 1;
  });
  return counts;
}

function captureBoardDiagnostic() {
  return {
    remaining: remainingItemCount(),
    tray: `${trayUsedSlots()}/${tray.slots}`,
    selectable: selectableItems().length,
    covered: activeItems().filter((item) => isBlocked(item)).length,
    frozenTray: trayItems.filter((item) => item.frozenMatches > 0).length,
    generation: generationReport ? {
      valid: generationReport.valid,
      reason: generationReport.reason,
      groups: generationReport.groups,
      steps: generationReport.certificate.length,
      bombs: generationReport.bombs,
      attempts: generationReport.attempts,
      removedLinkPairs: generationReport.removedLinkPairs,
      removedFrozen: generationReport.removedFrozen
    } : null,
    shelfTypes: countTypes(activeItems()),
    trayTypes: countTypes(trayItems),
    orders: orders.map((order) => ({
      kind: order.kind,
      needs: order.lines.map((line) => `${line.typeId}:${Math.max(0, line.needed - line.progress)}`)
    }))
  };
}

function updateDiagnosticBadge() {
  if (seedText) seedText.textContent = `${runSeed} · L${level}`;
  if (diagnosticCount) diagnosticCount.textContent = diagnosticEvents.length;
}

function recordDiagnostic(code, label, details = {}) {
  const snapshot = captureBoardDiagnostic();
  const signature = `${code}:${snapshot.remaining}:${snapshot.tray}:${snapshot.selectable}:${snapshot.covered}:${snapshot.frozenTray}:${JSON.stringify(snapshot.orders)}`;
  if (diagnosticEvents[0]?.signature === signature) return;
  diagnosticEvents.unshift({
    code,
    label,
    details,
    signature,
    elapsed: Math.max(0, Math.round((currentConfig.timeLimit - Math.min(currentConfig.timeLimit, timeLeft)) * 10) / 10),
    snapshot
  });
  diagnosticEvents = diagnosticEvents.slice(0, 12);
  updateDiagnosticBadge();
}

function buildReproductionUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("seed", runSeed);
  url.searchParams.set("level", String(level));
  return url.toString();
}

function buildDiagnosticReport() {
  return JSON.stringify({
    version: "seed-diagnostics-v1",
    seed: runSeed,
    level,
    levelSeed,
    url: buildReproductionUrl(),
    generation: generationReport,
    current: captureBoardDiagnostic(),
    events: diagnosticEvents.map(({ signature, ...event }) => event)
  }, null, 2);
}

function renderDiagnosticsPanel() {
  const current = captureBoardDiagnostic();
  diagnosticsSeed.textContent = `${runSeed} · 第 ${level} 关`;
  const generationText = current.generation
    ? ` · 路径${current.generation.valid ? "通过" : "失败"} ${current.generation.groups}组/${current.generation.steps}步 · 尝试${current.generation.attempts} · 修复链${current.generation.removedLinkPairs}/冰${current.generation.removedFrozen}`
    : "";
  diagnosticsSummary.textContent = `剩余 ${current.remaining} 件 · 卡槽 ${current.tray} · 可点 ${current.selectable} · 遮挡 ${current.covered} · 冻结 ${current.frozenTray}${generationText}`;
  diagnosticList.replaceChildren();
  if (!diagnosticEvents.length) {
    const empty = document.createElement("li");
    empty.textContent = "尚未触发兜底或异常状态";
    diagnosticList.appendChild(empty);
    return;
  }
  diagnosticEvents.forEach((event) => {
    const entry = document.createElement("li");
    entry.textContent = `${event.elapsed}s · ${event.label} · 剩余${event.snapshot.remaining} · 槽${event.snapshot.tray} · 可点${event.snapshot.selectable}`;
    diagnosticList.appendChild(entry);
  });
}

async function copyDebugText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMessage);
  } catch (error) {
    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.style.position = "fixed";
    fallback.style.opacity = "0";
    document.body.appendChild(fallback);
    fallback.select();
    const copied = document.execCommand("copy");
    fallback.remove();
    toast(copied ? successMessage : "复制失败，请从诊断面板记录种子");
  }
}

function openDiagnostics() {
  diagnosticsPreviousState = state;
  if (state === "playing") state = "paused";
  renderDiagnosticsPanel();
  diagnosticsOverlay.classList.remove("is-hidden");
}

function closeDiagnostics() {
  diagnosticsOverlay.classList.add("is-hidden");
  if (state === "paused") state = diagnosticsPreviousState === "playing" ? "playing" : diagnosticsPreviousState;
}

function openPauseMenu() {
  if (state !== "playing") return;
  pausePreviousState = state;
  state = "paused";
  saveActiveGame();
  pauseTutorialPanel.classList.add("is-hidden");
  pauseOverlay.classList.remove("is-hidden");
}

function closePauseMenu() {
  pauseOverlay.classList.add("is-hidden");
  if (state === "paused") state = pausePreviousState;
}

function updateHud() {
  levelText.textContent = level;
  itemsText.textContent = remainingItemCount();
  timeText.textContent = Math.ceil(timeLeft);
  reviveBtn.textContent = tray.slots >= MAX_TRAY_SLOTS ? "已满级" : "卡槽+1";
  reviveBtn.disabled = tray.slots >= MAX_TRAY_SLOTS && state === "playing";
  reviveBtn.classList.toggle("is-hidden", state !== "playing" || tray.slots >= MAX_TRAY_SLOTS);
  updateDiagnosticBadge();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawText(text, x, y, size, color = "#22313f", weight = 700, align = "center") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#fffaf0");
  gradient.addColorStop(1, "#f4ead8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  drawText(gameMode === "rogue" ? `肉鸽货架 · ${rogueRun.floor}/6` : "订单货架", W / 2, 42, 38, "#22313f", 800);
  drawText(`订单三消，剩余货物 ${remainingItemCount()} 件，货架 ${shelf.cols}x${shelf.rows}`, W / 2, 76, 19, "#6b7886", 500);
  drawQueuedOrder();
  drawOrders();
}

function orderKindLabel(order) {
  if (order.kind === "rush") return "急单";
  if (order.kind === "bulk") return "大单";
  if (order.kind === "dual") return "双品";
  return "订单";
}

function orderRewardLabel(order) {
  if (order.kind === "rush") return "+10秒";
  if (order.kind === "bulk") return tray.slots < MAX_TRAY_SLOTS ? "+1槽" : "+8秒";
  if (order.kind === "dual") return activeItems().some((item) => item.linkedUid) ? "解链" : "+7秒";
  return "+5秒";
}

function drawQueuedOrder() {
  if (!queuedOrder) return;
  const w = queuedOrder.lines.length > 1 ? 310 : 260;
  const h = 28;
  const x = W / 2 - w / 2;
  const y = 91;
  roundRect(x, y, w, h, 8);
  ctx.fillStyle = "#eef2f5";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#aeb8c2";
  ctx.stroke();

  drawText("下一单", x + 15, y + h / 2, 13, "#5f6c78", 800, "left");
  drawText(orderKindLabel(queuedOrder), x + 66, y + h / 2, 13, queuedOrder.kind === "rush" ? "#d94f43" : "#5f6c78", 800, "left");
  drawText(orderRewardLabel(queuedOrder), x + 105, y + h / 2, 12, "#16825d", 800, "left");
  queuedOrder.lines.forEach((line, index) => {
    const type = itemType(line.typeId);
    const lineX = x + 158 + index * 72;
    drawMiniItem(type, lineX, y + h / 2, 21);
    drawText(`x${line.needed}`, lineX + 17, y + h / 2, 13, "#34414d", 800, "left");
  });
}

function drawOrders() {
  orders.forEach((order, index) => {
    const primaryType = itemType(order.lines[0].typeId);
    const bounds = orderCardBounds(index);
    const elapsed = order.enteredAt ? performance.now() - order.enteredAt : 999;
    const enterProgress = Math.min(1, elapsed / 260);
    const enterEase = 1 - Math.pow(1 - enterProgress, 3);
    const queueX = W / 2 - bounds.w / 2;
    const x = queueX + (bounds.x - queueX) * enterEase;
    const y = bounds.y - (1 - enterEase) * 24;
    const cardW = bounds.w;
    const h = bounds.h;
    const canReceivePending = pendingShipment?.orderIds.includes(order.id);
    ctx.save();
    ctx.globalAlpha = 0.35 + enterEase * 0.65;
    roundRect(x, y, cardW, 86, 14);
    ctx.fillStyle = canReceivePending ? "#fff8d8" : "#ffffff";
    ctx.fill();
    ctx.lineWidth = canReceivePending ? 6 : 3;
    ctx.strokeStyle = canReceivePending ? "#f2b84b" : order.kind === "rush" ? "#e85d4f" : primaryType.color;
    ctx.stroke();

    if (canReceivePending) {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -performance.now() / 90;
      roundRect(x + 5, y + 5, cardW - 10, h - 10, 10);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#d99518";
      ctx.stroke();
      ctx.restore();
    }

    const label = order.kind === "rush" ? "急单" : order.kind === "bulk" ? "大单" : order.kind === "dual" ? "双品" : "订单";
    drawText(label, x + 16, y + 20, 16, order.kind === "rush" ? "#e85d4f" : "#6b7886", 800, "left");
    drawText(orderRewardLabel(order), x + cardW - 14, y + 37, 11, "#16825d", 800, "right");

    if (order.kind === "rush") {
      const ratio = Math.max(0, order.patience / order.maxPatience);
      roundRect(x + cardW - 72, y + 14, 52, 10, 5);
      ctx.fillStyle = "#f1e8dc";
      ctx.fill();
      roundRect(x + cardW - 72, y + 14, 52 * ratio, 10, 5);
      ctx.fillStyle = ratio < 0.35 ? "#e85d4f" : "#48a868";
      ctx.fill();
    }

    order.lines.forEach((line, lineIndex) => {
      const type = itemType(line.typeId);
      const step = order.lines.length > 1 ? 62 : 0;
      const itemX = order.lines.length > 1 ? x + 31 + lineIndex * step : x + 42;
      const textX = itemX + 30;
      drawMiniItem(type, itemX, y + 57, 32);
      drawText(`${line.progress}/${line.needed}`, textX, y + 57, 20, "#22313f", 900);
    });
    ctx.restore();
  });

}

function orderCardBounds(index) {
  const gap = 10;
  const w = (W - 84 - gap * (ORDER_COUNT - 1)) / ORDER_COUNT;
  const startX = (W - w * ORDER_COUNT - gap * (ORDER_COUNT - 1)) / 2;
  const x = startX + index * (w + gap);
  const y = 122;
  const h = 86;
  return { x, y, w, h, left: x, right: x + w, top: y, bottom: y + h };
}

function drawMiniItem(type, x, y, size) {
  roundRect(x - size / 2, y - size / 2, size, size, 11);
  ctx.fillStyle = type.color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.stroke();
  drawText(type.label, x, y, size * 0.36, "#ffffff", 900);
}

function updateClearedShelfRows() {
  const occupiedRows = new Set(activeItems().map((item) => item.row));
  trackableShelfRows.forEach((row) => {
    if (occupiedRows.has(row)) {
      clearedShelfRows.delete(row);
    } else if (!clearedShelfRows.has(row)) {
      clearedShelfRows.set(row, performance.now());
    }
  });
}

function shelfRowVisibility(row, now) {
  const clearedAt = clearedShelfRows.get(row);
  if (clearedAt === undefined) return 1;
  const progress = Math.min(1, Math.max(0, (now - clearedAt) / 440));
  return Math.pow(1 - progress, 2);
}

function drawShelf(now = performance.now()) {
  roundRect(shelf.x - 18, shelf.y - 22, shelf.w + 36, shelf.h + 42, 20);
  ctx.fillStyle = "#d8aa72";
  ctx.fill();

  roundRect(shelf.x, shelf.y, shelf.w, shelf.h, 16);
  ctx.fillStyle = "#f7d397";
  ctx.fill();

  ctx.lineWidth = 8;
  for (let r = 1; r < shelf.rows; r += 1) {
    const y = shelf.y + r * cellH;
    const visibility = shelfRowVisibility(r - 1, now);
    const halfWidth = (shelf.w * visibility) / 2;
    ctx.strokeStyle = `rgba(159, 109, 61, ${visibility})`;
    ctx.beginPath();
    ctx.moveTo(shelf.x + shelf.w / 2 - halfWidth, y);
    ctx.lineTo(shelf.x + shelf.w / 2 + halfWidth, y);
    ctx.stroke();
  }

  ctx.lineWidth = 3;
  for (let row = 0; row < shelf.rows; row += 1) {
    const visibility = shelfRowVisibility(row, now);
    const rowCenter = shelf.y + row * cellH + cellH / 2;
    const halfHeight = Math.max(0, (cellH / 2 - 8) * visibility);
    ctx.strokeStyle = `rgba(159, 109, 61, ${0.38 * visibility})`;
    for (let c = 1; c < shelf.cols; c += 1) {
      const x = shelf.x + c * cellW;
      ctx.beginPath();
      ctx.moveTo(x, rowCenter - halfHeight);
      ctx.lineTo(x, rowCenter + halfHeight);
      ctx.stroke();
    }
  }

  clearedShelfRows.forEach((clearedAt, row) => {
    const elapsed = now - clearedAt;
    if (elapsed < 520) {
      const alpha = Math.sin(Math.min(1, elapsed / 520) * Math.PI) * 0.16;
      ctx.fillStyle = `rgba(72, 168, 104, ${alpha})`;
      ctx.fillRect(shelf.x + 4, shelf.y + row * cellH + 4, shelf.w - 8, cellH - 8);
    }
  });
}

function itemCenter(item) {
  const layerOffset = item.layer * 12;
  return {
    x: shelf.x + item.col * cellW + cellW / 2 + layerOffset,
    y: shelf.y + item.row * cellH + cellH / 2 - layerOffset
  };
}

function itemSize(item) {
  const base = Math.min(72, Math.min(cellW, cellH) * 0.9);
  return base + item.layer * 2;
}

function itemBounds(item) {
  const center = itemCenter(item);
  const size = itemSize(item);
  return {
    left: center.x - size / 2,
    right: center.x + size / 2,
    top: center.y - size / 2,
    bottom: center.y + size / 2
  };
}

function pointInBounds(point, bounds, padding = 0) {
  return (
    point.x >= bounds.left - padding &&
    point.x <= bounds.right + padding &&
    point.y >= bounds.top - padding &&
    point.y <= bounds.bottom + padding
  );
}

function isBlocked(item) {
  return activeItems().some((other) => {
    if (other.uid === item.uid || other.layer <= item.layer) return false;
    return Math.abs(other.row - item.row) <= 1 && Math.abs(other.col - item.col) <= 1;
  });
}

function itemDrawOrder(a, b) {
  return a.layer - b.layer || a.row - b.row || a.col - b.col || a.z - b.z;
}

function itemHitOrder(a, b) {
  return itemDrawOrder(b, a);
}

function drawBombItem(item, x, y, size, alpha = 1) {
  const blocked = item.inTray ? false : isBlocked(item);
  const pulsing = pulseItems.has(item.uid);
  const hoverWobble = hoverItemUid === item.uid;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + (hoverWobble ? Math.sin(performance.now() / 58) * 3 : 0), y);
  ctx.scale(pulsing || hoverWobble ? 1.08 : 1, pulsing || hoverWobble ? 1.08 : 1);

  ctx.shadowColor = "rgba(34, 49, 63, 0.24)";
  ctx.shadowBlur = blocked ? 6 : 18;
  ctx.shadowOffsetY = blocked ? 3 : 8;
  roundRect(-size / 2, -size / 2, size, size, 16);
  ctx.fillStyle = blocked ? "#9aa4ae" : "#2b3138";
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.lineWidth = 5;
  ctx.strokeStyle = blocked ? "rgba(255,255,255,0.42)" : "#ffd35a";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, size * 0.08, size * 0.23, 0, Math.PI * 2);
  ctx.fillStyle = blocked ? "#6b747d" : "#111820";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#ffd35a";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 0.06, -size * 0.13);
  ctx.quadraticCurveTo(size * 0.2, -size * 0.32, size * 0.36, -size * 0.22);
  ctx.strokeStyle = "#ffd35a";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.stroke();

  drawText("BOMB", 0, -size * 0.28, size * 0.2, "#ffd35a", 900);
  drawText("!", 0, size * 0.08, size * 0.34, "#ffffff", 900);

  if (blocked) {
    drawText("锁", size * 0.28, -size * 0.28, size * 0.22, "#ffffff", 900);
  }

  ctx.restore();
}

function drawItem(item, x, y, size, alpha = 1) {
  if (item.variant === "bomb") {
    drawBombItem(item, x, y, size, alpha);
    return;
  }

  const type = itemType(item.typeId);
  const blocked = item.inTray ? false : isBlocked(item);
  const frozen = item.frozenMatches > 0;
  const pulsing = pulseItems.has(item.uid);
  const shaking = shakeItems.has(item.uid);
  const hoverWobble = hoverItemUid === item.uid && item.variant !== "normal";
  const shake = shaking || hoverWobble ? Math.sin(performance.now() / (hoverWobble ? 58 : 36)) * (hoverWobble ? 3 : 5) : 0;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + shake, y);
  ctx.scale(pulsing || hoverWobble ? 1.1 : 1, pulsing || hoverWobble ? 1.1 : 1);

  const specialGlow = item.variant === "bonus" || item.variant === "cold";
  ctx.shadowColor = item.variant === "bonus" && !blocked
    ? "rgba(242, 184, 75, 0.42)"
    : item.variant === "cold" && !blocked
      ? "rgba(70, 181, 200, 0.46)"
      : "rgba(34, 49, 63, 0.18)";
  ctx.shadowBlur = specialGlow && !blocked ? 22 : blocked ? 6 : 14;
  ctx.shadowOffsetY = blocked ? 3 : 8;
  roundRect(-size / 2, -size / 2, size, size, 16);
  ctx.fillStyle = blocked ? "#aeb7c2" : type.color;
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.lineWidth = blocked ? 4 : 5;
  ctx.strokeStyle = blocked
    ? "rgba(72, 84, 96, 0.44)"
    : item.variant === "bonus"
      ? "#ffe27a"
      : item.variant === "cold"
        ? "#8be5f0"
      : item.variant === "bomb"
        ? "#22313f"
        : item.variant === "linked"
          ? "#9c6ade"
          : frozen || item.variant === "frozen"
            ? "#aee8ff"
            : "rgba(255,255,255,0.75)";
  ctx.stroke();

  ctx.fillStyle = blocked ? "rgba(255,255,255,0.52)" : "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.arc(0, -size * 0.08, size * 0.25, 0, Math.PI * 2);
  ctx.fill();

  drawText(type.icon, 0, size * 0.21, size * 0.3, "#ffffff", 900);
  drawText(type.label, 0, -size * 0.08, size * 0.28, blocked ? "#66717d" : type.color, 900);

  if (blocked) {
    drawText("锁", size * 0.26, -size * 0.27, size * 0.22, "#ffffff", 900);
  }

  if (!blocked && item.variant && item.variant !== "normal") {
    const badge = item.variant === "bonus" ? "+" : item.variant === "cold" ? "冷" : item.variant === "bomb" ? "!" : item.variant === "linked" ? "链" : "冰";
    const badgeColor =
      item.variant === "bonus" ? "#f2b84b" : item.variant === "cold" ? "#1599aa" : item.variant === "bomb" ? "#22313f" : item.variant === "linked" ? "#9c6ade" : "#3f82d7";
    ctx.beginPath();
    ctx.arc(size * 0.31, -size * 0.31, size * 0.17, 0, Math.PI * 2);
    ctx.fillStyle = badgeColor;
    ctx.fill();
    drawText(badge, size * 0.31, -size * 0.31, size * 0.2, "#ffffff", 900);
  }

  if (!blocked && item.variant === "bonus") {
    ctx.save();
    ctx.rotate(-0.18);
    drawText("STAR", -size * 0.16, -size * 0.34, size * 0.18, "#ffe27a", 900);
    ctx.restore();
  }

  if (!blocked && item.variant === "cold") {
    drawText("COLD", -size * 0.13, -size * 0.34, size * 0.16, "#baf6ff", 900);
  }

  if (frozen) {
    roundRect(-size / 2 + 5, -size / 2 + 5, size - 10, size - 10, 12);
    ctx.fillStyle = "rgba(135, 217, 255, 0.5)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
    ctx.stroke();
    drawText("ICE", 0, -size * 0.08, size * 0.22, "#ffffff", 900);
    drawText(`${item.frozenMatches}`, 0, size * 0.2, size * 0.26, "#ffffff", 900);
  }

  ctx.restore();
}

function drawItems() {
  activeItems()
    .slice()
    .sort(itemDrawOrder)
    .forEach((item) => {
      const center = itemCenter(item);
      drawItem(item, center.x, center.y, itemSize(item), isBlocked(item) ? 0.68 : 1);
    });
}

function drawLinkedChains() {
  const active = activeItems();
  const byUid = new Map(active.map((item) => [item.uid, item]));
  const drawn = new Set();

  active.forEach((item) => {
    if (item.variant !== "linked" || !item.linkedUid || drawn.has(item.uid)) return;
    const mate = byUid.get(item.linkedUid);
    if (!mate) return;

    drawn.add(item.uid);
    drawn.add(mate.uid);

    const a = itemCenter(item);
    const b = itemCenter(mate);
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -performance.now() / 55;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(156, 106, 222, 0.78)";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);

    [a, b].forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#9c6ade";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    });
    ctx.restore();
  });
}

function drawTray() {
  const slotW = tray.w / tray.slots;
  const bombItems = trayItems.filter((item) => item.variant === "bomb");
  let topBombIndex = -1;
  trayItems.forEach((item, index) => {
    if (item.variant === "bomb") topBombIndex = index;
  });
  roundRect(tray.x, tray.y, tray.w, tray.h, 22);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#d9d0c0";
  ctx.stroke();

  for (let i = 0; i < tray.slots; i += 1) {
    const x = tray.x + i * slotW + 8;
    roundRect(x, tray.y + 18, slotW - 16, tray.h - 36, 14);
    ctx.fillStyle = "#f4f7fa";
    ctx.fill();
    ctx.strokeStyle = "#dde4ec";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawTrayLinkedChains();

  if (bombItems.length) {
    roundRect(tray.x + tray.w - 184, tray.y - 46, 170, 40, 18);
    ctx.fillStyle = "rgba(34, 49, 63, 0.82)";
    ctx.fill();
    drawText(`炸弹 x${bombItems.length}`, tray.x + tray.w - 100, tray.y - 26, 18, "#ffd35a", 900);
  }

  trayItems.forEach((item, index) => {
    if (bombDrag && bombDrag.index === index) return;
    if (item.variant === "bomb" && index !== topBombIndex) return;
    const center = trayItemCenter(index);
    const trayItemSize = item.variant === "bomb" ? 46 : Math.min(56, slotW - 14);
    drawItem({ ...item, layer: 0, inTray: true }, center.x, center.y, trayItemSize);
  });

  if (bombDrag) {
    drawItem({ ...bombDrag.item, layer: 0, inTray: true }, bombDrag.x, bombDrag.y, 60, 0.92);
  }
}

function drawTrayLinkedChains() {
  const byUid = new Map(trayItems.map((item, index) => [item.uid, { item, index }]));
  const drawn = new Set();
  trayItems.forEach((item, index) => {
    if (item.variant !== "linked" || !item.linkedUid || drawn.has(item.uid)) return;
    const mateEntry = byUid.get(item.linkedUid);
    if (!mateEntry || mateEntry.item.variant !== "linked") return;
    drawn.add(item.uid);
    drawn.add(mateEntry.item.uid);

    const firstCount = trayItems.filter(
      (entry) => entry.typeId === item.typeId && entry.variant !== "bomb" && entry.frozenMatches <= 0
    ).length;
    const secondCount = trayItems.filter(
      (entry) => entry.typeId === mateEntry.item.typeId && entry.variant !== "bomb" && entry.frozenMatches <= 0
    ).length;
    const armed = item.typeId !== mateEntry.item.typeId
      && firstCount >= 3
      && secondCount >= 3
      && Boolean(orderForType(item.typeId))
      && Boolean(orderForType(mateEntry.item.typeId));
    const a = trayItemCenter(index);
    const b = trayItemCenter(mateEntry.index);

    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -performance.now() / (armed ? 38 : 65);
    ctx.lineWidth = armed ? 5 : 3;
    ctx.strokeStyle = armed ? "rgba(242, 184, 75, 0.96)" : "rgba(156, 106, 222, 0.7)";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();

    if (armed) {
      drawText("双发", (a.x + b.x) / 2, (a.y + b.y) / 2 - 12, 12, "#9a6500", 900);
    }
  });
}

function drawMessages(now) {
  if (message && now < messageUntil) {
    const messageY = tray.y - 62;
    roundRect(94, messageY, 532, 52, 26);
    ctx.fillStyle = "rgba(34, 49, 63, 0.86)";
    ctx.fill();
    const messageSize = message.length > 28 ? 14 : message.length > 22 ? 16 : message.length > 17 ? 18 : 22;
    drawText(message, W / 2, messageY + 26, messageSize, "#ffffff", 700);
  }
}

function drawConfetti() {
  confetti.forEach((dot) => {
    ctx.fillStyle = dot.color;
    ctx.globalAlpha = dot.life;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function beginClearanceSweep(goods, cleaned) {
  if (clearanceSweep) return;
  clearanceSweep = {
    goods,
    cleaned,
    startedAt: performance.now(),
    duration: cleaned > 0 ? Math.min(1120, 760 + goods.length * 18) : 520
  };
  state = "clearing";
}

function updateClearanceSweep(now) {
  if (!clearanceSweep || now - clearanceSweep.startedAt < clearanceSweep.duration) return;
  clearanceSweep = null;
  win();
}

function drawClearanceSweep(now) {
  if (!clearanceSweep || clearanceSweep.cleaned === 0) return;
  const elapsed = now - clearanceSweep.startedAt;
  const crateX = W / 2;
  const crateY = shelf.y + shelf.h * 0.62;
  const reveal = Math.min(1, elapsed / 180);

  ctx.save();
  ctx.globalAlpha = reveal;
  ctx.shadowColor = "rgba(62, 43, 22, 0.3)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  roundRect(crateX - 92, crateY - 38, 184, 90, 12);
  ctx.fillStyle = "#d99a4d";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#8c5928";
  ctx.stroke();
  ctx.fillStyle = "#f0bd6f";
  ctx.fillRect(crateX - 12, crateY - 35, 24, 84);
  drawText(`尾货清仓 x${clearanceSweep.cleaned}`, crateX, crateY + 17, 19, "#4f351d", 900);
  ctx.restore();

  clearanceSweep.goods.forEach((good) => {
    const travelDuration = clearanceSweep.duration * 0.68;
    const progress = Math.min(1, Math.max(0, (elapsed - good.delay) / travelDuration));
    if (progress >= 1) return;
    const eased = 1 - Math.pow(1 - progress, 3);
    const x = good.x + (crateX - good.x) * eased;
    const baseY = good.y + (crateY - 22 - good.y) * eased;
    const y = baseY - Math.sin(Math.PI * eased) * 58;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - eased) * 2.4);
    drawMiniItem(itemType(good.typeId), x, y, 36 - eased * 12);
    ctx.restore();
  });
}

function drawShipmentCrate(now) {
  if (!pendingShipment) return;
  const type = itemType(pendingShipment.typeId);
  const age = Math.max(0, now - pendingShipment.createdAt);
  const pop = Math.min(1, age / 170);
  const eased = 1 - Math.pow(1 - pop, 3);
  const w = 236;
  const h = 74;
  const x = W / 2 - w / 2;
  const y = 210 + (1 - eased) * 18;

  ctx.save();
  ctx.globalAlpha = eased;
  ctx.shadowColor = "rgba(62, 43, 22, 0.28)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  roundRect(x, y, w, h, 12);
  ctx.fillStyle = "#f3c77d";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#a86f2f";
  ctx.stroke();

  ctx.fillStyle = "#d89a4c";
  ctx.fillRect(x + w / 2 - 13, y + 2, 26, h - 4);
  ctx.fillStyle = "rgba(255,255,255,0.34)";
  ctx.fillRect(x + w / 2 - 5, y + 2, 10, h - 4);

  [-22, 0, 22].forEach((offset) => drawMiniItem(type, x + 48 + offset, y + 38, 30));
  drawText(`${type.label}货 x3`, x + 142, y + 28, 20, "#4f351d", 900);
  drawText("点击金色订单发货", x + 142, y + 51, 14, "#76512c", 700);
  ctx.restore();
}

function launchDeliveryFlight(typeId, orderId, fromPending = false) {
  const orderIndex = orders.findIndex((order) => order.id === orderId);
  if (orderIndex < 0) return;
  const target = orderCardBounds(orderIndex);
  deliveryFlights.push({
    typeId,
    fromX: W / 2,
    fromY: fromPending ? 247 : tray.y + 22,
    toX: target.x + target.w / 2,
    toY: target.y + target.h / 2,
    startedAt: performance.now(),
    duration: 360
  });
}

function drawDeliveryFlights(now) {
  deliveryFlights = deliveryFlights.filter((flight) => {
    const progress = (now - flight.startedAt) / flight.duration;
    if (progress >= 1) return false;
    const t = Math.max(0, progress);
    const eased = 1 - Math.pow(1 - t, 3);
    const x = flight.fromX + (flight.toX - flight.fromX) * eased;
    const baseY = flight.fromY + (flight.toY - flight.fromY) * eased;
    const y = baseY - Math.sin(Math.PI * eased) * 72;
    const scale = 1 - eased * 0.35;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - eased) * 1.8);
    ctx.translate(x, y);
    ctx.rotate((flight.toX - flight.fromX) * eased * 0.0018);
    drawMiniItem(itemType(flight.typeId), 0, 0, 42 * scale);
    ctx.restore();
    return true;
  });
}

function render(now = performance.now()) {
  drawBackground();
  drawShelf(now);
  drawLinkedChains();
  drawItems();
  drawShipmentCrate(now);
  drawTray();
  drawConfetti();
  drawDeliveryFlights(now);
  drawClearanceSweep(now);
  drawMessages(now);
}

function queueMatchCheck(delay = 100) {
  setTimeout(() => {
    if (state === "playing") checkMatches();
  }, delay);
}

function updateOrders(dt) {
  if (pendingShipment) return;
  orders.forEach((order) => {
    if (order.kind !== "rush" || state !== "playing") return;
    order.patience -= dt;
    if (order.patience <= 0) {
      if (rogueInsuranceReady) {
        rogueInsuranceReady = false;
        toast("急单保险生效，本次免罚");
      } else {
        timeLeft = Math.max(0, timeLeft - 8);
        toast("急单超时，扣 8 秒");
      }
      replaceOrder(order);
      stabilizeBoard();
      queueMatchCheck();
    }
  });
}

function updateEmergencyThaw(dt) {
  if (!shouldEmergencyThaw()) {
    emergencyThawTimer = 0;
    return;
  }
  emergencyThawTimer += dt;
  if (emergencyThawTimer >= EMERGENCY_THAW_COOLDOWN) {
    emergencyThawTimer = 0;
    recordDiagnostic("emergency-thaw", "订单无可用三消，触发残局融冰");
    thawFrozenStep("emergency");
  }
}

function gameLoop(now) {
  if (!lastTick) lastTick = now;
  const dt = Math.min(0.05, (now - lastTick) / 1000);
  lastTick = now;

  if (state === "playing") {
    timeLeft -= dt;
    updateOrders(dt);
    updateEmergencyThaw(dt);
    if (timeLeft <= 0) {
      timeLeft = 0;
      fail("顾客等太久了");
    }
    updateHud();
    if (now - lastAutoSaveAt >= 1000) {
      lastAutoSaveAt = now;
      saveActiveGame();
    }
  } else if (state === "clearing") {
    updateClearanceSweep(now);
  }

  confetti = confetti
    .map((dot) => ({
      ...dot,
      x: dot.x + dot.vx,
      y: dot.y + dot.vy,
      vy: dot.vy + 0.09,
      life: dot.life - 0.018
    }))
    .filter((dot) => dot.life > 0);

  render(now);
  requestAnimationFrame(gameLoop);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H
  };
}

function hitPendingOrder(point) {
  if (!pendingShipment) return null;
  for (let index = 0; index < orders.length; index += 1) {
    const order = orders[index];
    if (!pendingShipment.orderIds.includes(order.id)) continue;
    if (pointInBounds(point, orderCardBounds(index))) return order;
  }
  return null;
}

function hitItem(point) {
  const candidates = activeItems().slice().sort(itemHitOrder);
  for (const item of candidates) {
    if (pointInBounds(point, itemBounds(item), 6)) return item;
  }
  return null;
}

function trayItemCenter(index) {
  const slotW = tray.w / tray.slots;
  const item = trayItems[index];
  if (item?.variant === "bomb") {
    return {
      x: tray.x + tray.w - 44,
      y: tray.y - 26
    };
  }

  const itemIndex = trayItems.slice(0, index).filter((entry) => entry.variant !== "bomb").length;
  return {
    x: tray.x + itemIndex * slotW + slotW / 2,
    y: tray.y + tray.h / 2
  };
}

function hitTrayItem(point) {
  for (let index = trayItems.length - 1; index >= 0; index -= 1) {
    const center = trayItemCenter(index);
    const item = trayItems[index];
    const halfW = item.variant === "bomb" ? 30 : 36;
    const halfH = item.variant === "bomb" ? 30 : 42;
    if (Math.abs(point.x - center.x) <= halfW && Math.abs(point.y - center.y) <= halfH) {
      return { item: trayItems[index], index };
    }
  }
  return null;
}

function trayUsedSlots() {
  return trayItems.filter((item) => item.variant !== "bomb").length;
}

function hasTrayBomb() {
  return trayItems.some((item) => item.variant === "bomb");
}

function bundleUsedSlots(bundle) {
  return bundle.filter((item) => item.variant !== "bomb").length;
}

function checkTrayCapacity(projectedUsed = trayUsedSlots()) {
  if (projectedUsed < tray.slots) return false;
  if (hasTrayBomb()) {
    toast("暂存槽满了，先拖炸弹清一个");
    return false;
  }
  fail("暂存槽满了");
  return true;
}

function useBombOnTray(targetIndex) {
  if (!bombDrag || targetIndex === bombDrag.index || !trayItems[targetIndex]) {
    bombDrag = null;
    return;
  }

  const targetItem = trayItems[targetIndex];
  if (targetItem.linkedUid) {
    const mate = trayItems.find((item) => item.uid === targetItem.linkedUid);
    if (mate) {
      mate.linkedUid = null;
      if (mate.variant === "linked") mate.variant = "normal";
    }
  }
  const first = Math.max(bombDrag.index, targetIndex);
  const second = Math.min(bombDrag.index, targetIndex);
  trayItems.splice(first, 1);
  trayItems.splice(second, 1);
  returnItemToShelf(targetItem);
  updateClearedShelfRows();
  score += 12;
  toast("炸弹把目标退回货架");
  bombDrag = null;
  checkMatches();
  checkClearWin();
  stabilizeBoard();
  updateHud();
}

function orderForType(typeId) {
  return ordersForType(typeId)[0];
}

function ordersForType(typeId) {
  return orders
    .filter((order) => order.lines.some((line) => line.typeId === typeId && line.progress < line.needed))
    .sort((a, b) => orderMatchPriority(b, typeId) - orderMatchPriority(a, typeId));
}

function orderMatchPriority(order, typeId) {
  const line = order.lines.find((entry) => entry.typeId === typeId && entry.progress < entry.needed);
  const urgency =
    order.kind === "rush" && order.maxPatience
      ? 90 + (1 - Math.max(0, order.patience) / order.maxPatience) * 35
      : 0;
  const partial = line && line.progress > 0 ? 45 : 0;
  const kind =
    order.kind === "dual"
      ? 34
      : order.kind === "bulk"
        ? 24
        : order.kind === "rush"
          ? 20
          : 0;
  const nearDone = line ? (line.progress / line.needed) * 18 : 0;
  return urgency + partial + kind + nearDone;
}

function isOrderComplete(order) {
  return order.lines.every((line) => line.progress >= line.needed);
}

function addToTray(item) {
  const bundle = [item];
  if (item.linkedUid) {
    const mate = activeItems().find((entry) => entry.uid === item.linkedUid);
    if (mate) bundle.push(mate);
  }

  const projectedUsed = trayUsedSlots() + bundleUsedSlots(bundle);
  if (projectedUsed > tray.slots) {
    checkTrayCapacity(projectedUsed);
    return;
  }

  bundle.forEach((entry) => {
    entry.cleared = true;
    const trayItem = { ...entry, scale: 1 };
    if (trayItem.variant === "frozen") {
      trayItem.frozenMatches = currentConfig.freezeMatches;
      toast(`冰冻货需要 ${trayItem.frozenMatches} 次消除解冻`);
    }
    trayItems.push(trayItem);
  });
  updateClearedShelfRows();

  if (bundle.length > 1) {
    toast("捆绑货一起进槽了");
  }
  checkMatches();
  checkClearWin();
  stabilizeBoard();
  updateHud();

  if (state === "playing") checkTrayCapacity();
}

function removeTrayTriple(typeId, preferredUid = null) {
  const eligible = trayItems.filter(
    (item) => item.typeId === typeId && item.variant !== "bomb" && item.frozenMatches <= 0
  );
  if (eligible.length < 3) return [];

  const selected = [];
  const preferred = preferredUid ? eligible.find((item) => item.uid === preferredUid) : null;
  if (preferred) selected.push(preferred);
  eligible.forEach((item) => {
    if (selected.length < 3 && item.uid !== preferredUid) selected.push(item);
  });
  const selectedUids = new Set(selected.map((item) => item.uid));
  trayItems = trayItems.filter((item) => !selectedUids.has(item.uid));
  return selected;
}

function armedLinkedItemForType(typeId) {
  return trayItems.find((item) => {
    if (item.typeId !== typeId || item.variant !== "linked" || !item.linkedUid || item.frozenMatches > 0) return false;
    const mate = trayItems.find((entry) => entry.uid === item.linkedUid && entry.frozenMatches <= 0);
    if (!mate || mate.typeId === typeId || !orderForType(mate.typeId)) return false;
    const mateCount = trayItems.filter(
      (entry) => entry.typeId === mate.typeId && entry.variant !== "bomb" && entry.frozenMatches <= 0
    ).length;
    return mateCount >= 3;
  });
}

function normalizeDanglingTrayLinks() {
  const trayUids = new Set(trayItems.map((item) => item.uid));
  trayItems.forEach((item) => {
    if (item.variant === "linked" && item.linkedUid && !trayUids.has(item.linkedUid)) {
      item.variant = "normal";
      item.linkedUid = null;
    }
  });
}

function triggerLinkedFollowup(shippedItems) {
  for (const shippedItem of shippedItems) {
    if (shippedItem.variant !== "linked" || !shippedItem.linkedUid) continue;
    const mate = trayItems.find(
      (item) => item.uid === shippedItem.linkedUid && item.variant === "linked" && item.frozenMatches <= 0
    );
    if (!mate) continue;
    const targetOrder = orderForType(mate.typeId);
    if (!targetOrder) continue;
    const followupItems = removeTrayTriple(mate.typeId, mate.uid);
    if (followupItems.length < 3) continue;

    launchDeliveryFlight(mate.typeId, targetOrder.id);
    thawFrozenByMatch();
    resolveShipment(mate.typeId, followupItems, targetOrder.id, "chain");
    return true;
  }
  return false;
}

function checkMatches() {
  if (pendingShipment) return false;
  const counts = new Map();
  trayItems.forEach((item) => {
    if (item.frozenMatches > 0) return;
    if (item.variant === "bomb") return;
    counts.set(item.typeId, (counts.get(item.typeId) || 0) + 1);
  });

  let hasBlockedTriple = false;
  for (const [typeId, count] of counts) {
    if (count >= 3) {
      const matchingOrders = ordersForType(typeId);
      if (!matchingOrders.length) {
        hasBlockedTriple = true;
        continue;
      }
      const armedLinkedItem = armedLinkedItemForType(typeId);
      const removedItems = removeTrayTriple(typeId, armedLinkedItem?.uid || null);
      if (matchingOrders.length > 1) {
        pendingShipment = {
          typeId,
          shippedItems: removedItems,
          orderIds: matchingOrders.map((order) => order.id),
          createdAt: performance.now()
        };
        toast(`三件${itemType(typeId).label}已装箱，点选要交付的订单`);
      } else {
        launchDeliveryFlight(typeId, matchingOrders[0].id);
        thawFrozenByMatch();
        resolveShipment(typeId, removedItems, matchingOrders[0].id);
        triggerLinkedFollowup(removedItems);
        normalizeDanglingTrayLinks();
      }
      return true;
    }
  }
  if (hasBlockedTriple) toast("暂时没有这个订单，先卡在槽里");
  if (hasBlockedTriple) recordDiagnostic("order-mismatch", "卡槽已有三消，但当前订单不接收");
  return false;
}

function dispatchPendingShipment(orderId) {
  if (!pendingShipment || !pendingShipment.orderIds.includes(orderId)) return false;
  const order = orders.find((entry) => entry.id === orderId);
  if (!order || !order.lines.some((line) => line.typeId === pendingShipment.typeId && line.progress < line.needed)) {
    return false;
  }

  const shipment = pendingShipment;
  launchDeliveryFlight(shipment.typeId, orderId, true);
  pendingShipment = null;
  thawFrozenByMatch();
  resolveShipment(shipment.typeId, shipment.shippedItems, orderId);
  triggerLinkedFollowup(shipment.shippedItems);
  normalizeDanglingTrayLinks();
  queueMatchCheck(140);
  updateHud();
  return true;
}

function hasFrozenTrayItems() {
  return trayItems.some((item) => item.frozenMatches > 0);
}

function availableUnfrozenCounts() {
  const counts = new Map();
  [...activeItems(), ...trayItems].forEach((item) => {
    if (item.variant === "bomb") return;
    if (item.frozenMatches > 0) return;
    if (item.variant === "frozen") return;
    counts.set(item.typeId, (counts.get(item.typeId) || 0) + 1);
  });
  return counts;
}

function canCompleteAnyCurrentOrderWithoutThaw() {
  const counts = availableUnfrozenCounts();
  return orders.some((order) =>
    order.lines.some((line) => line.progress < line.needed && (counts.get(line.typeId) || 0) >= 3)
  );
}

function shouldEmergencyThaw() {
  return hasFrozenTrayItems() && !canCompleteAnyCurrentOrderWithoutThaw();
}

function thawFrozenStep(source = "match") {
  let thawed = 0;
  trayItems.forEach((item) => {
    if (item.frozenMatches > 0) {
      item.frozenMatches -= 1;
      if (item.frozenMatches === 0) {
        item.variant = "cold";
        thawed += 1;
      }
    }
  });
  if (thawed > 0) {
    const thawTimeBonus = thawed * (source === "emergency" ? 1 : 2);
    score += thawed * (source === "emergency" ? 18 : 35);
    timeLeft += thawTimeBonus;
    toast(source === "emergency" ? `残局融冰 ${thawed} 个 +${thawTimeBonus}s` : `解冻 ${thawed} 个冷链货 +${thawTimeBonus}s`);
    setTimeout(() => {
      if (state === "playing") checkMatches();
    }, 120);
  }
  return thawed;
}

function thawFrozenByMatch() {
  thawFrozenStep("match");
}

function releaseOneLinkedPair() {
  const first = activeItems().find((item) => item.linkedUid);
  if (!first) return false;
  const second = activeItems().find((item) => item.uid === first.linkedUid);
  const released = second ? [first, second] : [first];
  released.forEach((item) => {
    item.variant = "normal";
    item.linkedUid = null;
    pulseItems.add(item.uid);
  });
  setTimeout(() => released.forEach((item) => pulseItems.delete(item.uid)), 1100);
  return true;
}

function meltOneShelfFrozen() {
  const frozenItem = activeItems().find((item) => item.variant === "frozen");
  if (!frozenItem) return false;
  frozenItem.variant = "cold";
  frozenItem.frozenMatches = 0;
  pulseItems.add(frozenItem.uid);
  setTimeout(() => pulseItems.delete(frozenItem.uid), 1100);
  return true;
}

function applyShipmentSpecialRewards(shippedItems) {
  const bonusCount = shippedItems.filter((item) => item.variant === "bonus").length;
  const coldCount = shippedItems.filter((item) => item.variant === "cold").length;
  const rewards = [];

  if (bonusCount > 0) {
    const bonusTime = bonusCount * (3 + rogueUpgradeCount("star") * 2);
    timeLeft += bonusTime;
    rewards.push(bonusCount > 1 ? `星标x${bonusCount}+${bonusTime}秒` : "星标+3秒");
  }

  if (coldCount > 0) {
    timeLeft += 3 + rogueUpgradeCount("cold") * 3;
    if (meltOneShelfFrozen()) {
      rewards.push("冷链+3秒融冰");
    } else {
      timeLeft += 2;
      rewards.push("冷链+5秒");
    }
  }

  return { text: rewards.join(" "), bonusCount, coldCount };
}

function applyOrderCompletionReward(order, shipmentRewardText = "") {
  let rewardText = "";
  if (order.kind === "rush") {
    timeLeft += 10;
    rewardText = "急单 +10秒";
  } else if (order.kind === "bulk") {
    if (tray.slots < MAX_TRAY_SLOTS) {
      tray.slots += 1;
      rewardText = `大单扩槽 ${tray.slots}/${MAX_TRAY_SLOTS}`;
    } else {
      timeLeft += 8;
      rewardText = "满槽转 +8秒";
    }
  } else if (order.kind === "dual") {
    if (releaseOneLinkedPair()) {
      rewardText = "双品解链";
    } else {
      timeLeft += 7;
      rewardText = "无链转 +7秒";
    }
  } else {
    timeLeft += 5;
    rewardText = "普通单 +5秒";
  }

  if (shipmentRewardText) rewardText += ` ${shipmentRewardText}`;
  return rewardText;
}

function resolveShipment(typeId, shippedItems = [], targetOrderId = null, shipmentSource = "normal") {
  const order = targetOrderId
    ? orders.find((entry) => entry.id === targetOrderId)
    : orderForType(typeId);
  const shipmentRewards = applyShipmentSpecialRewards(shippedItems);
  burst(typeId);

  if (order) {
    const line = order.lines.find((entry) => entry.typeId === typeId && entry.progress < entry.needed);
    line.progress = Math.min(line.needed, line.progress + 3);
    score += 45 + level * 8 + combo * 8;

    if (isOrderComplete(order)) {
      combo += 1;
      completedOrders += 1;
      const bonus = order.kind === "rush" ? 80 : order.kind === "dual" ? 65 : order.kind === "bulk" ? 55 : 35;
      score += 90 + bonus + combo * 15 + shipmentRewards.bonusCount * 45 + shipmentRewards.coldCount * 30;
      const rewardText = applyOrderCompletionReward(order, shipmentRewards.text);
      const completionText = shipmentSource === "chain"
        ? `连锁双发·完成${itemType(typeId).label}订单`
        : combo > 1
          ? `连单 x${combo}`
          : `完成 ${itemType(typeId).label}订单`;
      toast(`${completionText} · ${rewardText}`);
      replaceOrder(order);
      queueMatchCheck();
    } else {
      const specialText = shipmentRewards.text ? ` · ${shipmentRewards.text}` : "";
      const chainText = shipmentSource === "chain" ? "连锁双发·" : "";
      toast(`${chainText}${itemType(typeId).label}已出货，还差一项${specialText}`);
    }
  } else {
    combo = 0;
    score += 25;
    timeLeft = Math.max(0, timeLeft - Math.min(4, 1 + Math.floor(level / 3)));
    toast("散货出库，顾客有点急了");
  }

  checkClearWin();
}

function replaceOrder(doneOrder) {
  const index = orders.findIndex((order) => order.id === doneOrder.id);
  if (index === -1) return null;
  const nextOrder = queuedOrder || createOrderFromStock(preferredRefillType(), doneOrder.id);
  if (!nextOrder) {
    recordDiagnostic("order-exhausted", "剩余库存不足以生成新订单");
    orders.splice(index, 1);
    checkClearWin();
    return null;
  }
  queuedOrder = null;
  nextOrder.enteredAt = performance.now();
  orders[index] = nextOrder;
  queuedOrder = createOrderFromStock(preferredRefillType());
  return orders[index];
}

function remainingStockCounts() {
  const counts = new Map();
  [...activeItems(), ...trayItems].forEach((item) => {
    if (item.variant === "bomb") return;
    counts.set(item.typeId, (counts.get(item.typeId) || 0) + 1);
  });
  return counts;
}

function reservedOrderCounts(excludeOrderId = null) {
  const reserved = new Map();
  [...orders, queuedOrder].filter(Boolean).forEach((order) => {
    if (order.id === excludeOrderId) return;
    order.lines.forEach((line) => {
      const remaining = Math.max(0, line.needed - line.progress);
      if (remaining > 0) {
        reserved.set(line.typeId, (reserved.get(line.typeId) || 0) + remaining);
      }
    });
  });
  return reserved;
}

function availableStockCounts(excludeOrderId = null) {
  const counts = remainingStockCounts();
  const reserved = reservedOrderCounts(excludeOrderId);
  reserved.forEach((amount, typeId) => {
    counts.set(typeId, Math.max(0, (counts.get(typeId) || 0) - amount));
  });
  return counts;
}

function createOrderFromStock(preferredType, excludeOrderId = null) {
  const counts = availableStockCounts(excludeOrderId);
  const current = new Set(
    orders
      .filter((order) => order.id !== excludeOrderId)
      .flatMap(orderTypeIds)
  );
  const enoughForNormal = [...counts.entries()]
    .filter(([typeId, count]) => count >= 3 && !current.has(typeId))
    .map(([typeId]) => typeId);
  const fallbackNormal = [...counts.entries()].filter(([, count]) => count >= 3).map(([typeId]) => typeId);
  const normalOptions = enoughForNormal.length ? enoughForNormal : fallbackNormal;
  if (!normalOptions.length) return null;

  const preferredUsable = preferredType && normalOptions.includes(preferredType);
  const primary = preferredUsable ? preferredType : choice(normalOptions);
  const roll = gameRandom();
  let kind = "normal";
  if (roll < currentConfig.dualChance) {
    const secondaryOptions = normalOptions.filter((typeId) => typeId !== primary);
    if (secondaryOptions.length) kind = "dual";
  } else if (roll < currentConfig.dualChance + currentConfig.bulkChance && (counts.get(primary) || 0) >= 6) {
    kind = "bulk";
  } else if (roll < currentConfig.dualChance + currentConfig.bulkChance + currentConfig.rushChance) {
    kind = "rush";
  }

  const lines = [{ typeId: primary, needed: kind === "bulk" ? 6 : 3, progress: 0 }];
  if (kind === "dual") {
    lines.push({ typeId: choice(normalOptions.filter((typeId) => typeId !== primary)), needed: 3, progress: 0 });
  }

  return {
    id: nextOrderId++,
    kind,
    lines,
    patience: kind === "rush" ? currentConfig.rushPatience : null,
    maxPatience: kind === "rush" ? currentConfig.rushPatience : null
  };
}

function preferredRefillType() {
  const selectable = selectableItems();
  const trayCounts = new Map();
  trayItems.forEach((item) => {
    if (item.variant === "bomb") return;
    trayCounts.set(item.typeId, (trayCounts.get(item.typeId) || 0) + 1);
  });

  for (const [typeId, count] of trayCounts) {
    if (count > 0 && selectable.some((item) => item.typeId === typeId)) {
      return typeId;
    }
  }

  const activeOrderTypes = new Set(allOrderTypeIds());
  const availableStock = availableStockCounts();
  const certifiedType = generationReport?.certificate
    .filter((step) => step.action === "ship-triple")
    .map((step) => step.typeId)
    .find((typeId) => !activeOrderTypes.has(typeId) && (availableStock.get(typeId) || 0) >= 3);
  if (certifiedType) return certifiedType;

  return selectable.length ? choice(selectable).typeId : choice(availableTypes());
}

function stabilizeBoard() {
  const selectable = selectableItems();
  if (!selectable.length) {
    const top = activeItems().slice().sort(itemHitOrder)[0];
    if (top) {
      recordDiagnostic("forced-uncover", "货架无可点击商品，自动降低遮挡", { item: top.uid });
      top.layer = Math.max(0, top.layer - 1);
    }
  }
}

function wantedType() {
  const counts = new Map();
  trayItems.forEach((item) => {
    if (item.variant === "bomb") return;
    counts.set(item.typeId, (counts.get(item.typeId) || 0) + 1);
  });

  for (const [typeId, count] of counts) {
    if (count === 2) return typeId;
  }

  for (const [typeId, count] of counts) {
    if (count === 1 && orderForType(typeId)) return typeId;
  }

  return orders[0]?.lines[0].typeId;
}

function burst(typeId) {
  const type = itemType(typeId);
  for (let i = 0; i < 24; i += 1) {
    confetti.push({
      x: W / 2 + (Math.random() - 0.5) * 260,
      y: tray.y + 44 + Math.random() * 50,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 5,
      size: 4 + Math.random() * 6,
      color: type.color,
      life: 1
    });
  }
}

function toast(text) {
  message = text;
  messageUntil = performance.now() + 950;
}

function showRogueUpgradeChoices() {
  const choices = shuffle([...rogueUpgrades]).slice(0, 3);
  upgradeChoices.replaceChildren();
  choices.forEach((upgrade) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "upgradeChoice";
    button.innerHTML = `<strong>${upgrade.name}</strong><span>${upgrade.description}</span>`;
    button.addEventListener("click", () => {
      rogueRun.upgrades.push(upgrade.id);
      rogueRun.floor += 1;
      upgradeOverlay.classList.add("is-hidden");
      advanceToLevel(rogueRun.floor);
    });
    upgradeChoices.appendChild(button);
  });
  upgradeOverlay.classList.remove("is-hidden");
}

function win() {
  state = "won";
  if (gameMode === "rogue" && rogueRun.floor < 6) {
    clearActiveSave();
    showRogueUpgradeChoices();
    return;
  }
  clearActiveSave();
  const totalScore = runScore + score;
  const result = recordRunResult(level, totalScore);
  const rogueFinished = gameMode === "rogue";
  showModal(
    rogueFinished ? "肉鸽试验场" : "通关",
    rogueFinished ? "六层试炼完成" : "货柜清空",
    rogueFinished ? `本局获得 ${rogueRun.upgrades.length} 项强化，完成全部六层。` : `完成 ${completedOrders} 单，清空全部货物。下一关货架更大、遮挡更重。`,
    rogueFinished ? "返回首页" : "下一关"
  );
  renderModalRecord(totalScore, level, result);
}

function fail(reason) {
  if (state !== "playing") return;
  recordDiagnostic("failure", `失败：${reason}`);
  state = "failed";
  clearActiveSave();
  const totalScore = runScore + score;
  const result = recordRunResult(level, totalScore);
  showModal("失败", reason, "可以重开，也可以模拟一次激励广告增加 1 个卡槽。", "看广告扩槽");
  renderModalRecord(totalScore, level, result);
}

function showModal(kicker, title, body, primaryLabel) {
  modalKicker.textContent = kicker;
  modalTitle.textContent = title;
  modalBody.textContent = body;
  primaryBtn.textContent = primaryLabel;
  secondaryBtn.textContent = "重开";
  if (modalRecord) modalRecord.classList.add("is-hidden");
  overlay.classList.remove("is-hidden");
}

function advanceToLevel(nextLevel) {
  runScore += score;
  startLevel(nextLevel);
}

function rewardSlot() {
  const canAddSlot = tray.slots < MAX_TRAY_SLOTS;
  overlay.classList.add("is-hidden");
  if (canAddSlot) {
    tray.slots += 1;
    toast(`模拟广告结束，卡槽 +1（${tray.slots}/${MAX_TRAY_SLOTS}）`);
  } else {
    toast("卡槽已满级，奖励 20 秒");
  }
  if (state === "failed") {
    state = "playing";
    timeLeft = Math.max(timeLeft, canAddSlot ? 12 : 20);
  } else if (!canAddSlot) {
    timeLeft += 20;
  }
  updateHud();
}

function showHint() {
  if (state !== "playing") return;
  stabilizeBoard();
  const selectable = selectableItems();
  const target = wantedType();
  const hinted =
    selectable.filter((item) => item.typeId === target).length
      ? selectable.filter((item) => item.typeId === target)
      : selectable.filter((item) => item.variant === "bonus" || item.variant === "cold" || item.variant === "bomb");
  pulseItems = new Set((hinted.length ? hinted : selectable.slice(0, 2)).map((item) => item.uid));
  toast(target ? `优先拿 ${itemType(target).label}` : "优先拿特殊货或解开遮挡");
  setTimeout(() => {
    pulseItems = new Set();
  }, 1200);
}

function shakeBlocked(item) {
  shakeItems.add(item.uid);
  toast("被上层货物挡住了");
  setTimeout(() => {
    shakeItems.delete(item.uid);
  }, 360);
}

canvas.addEventListener("pointerdown", (event) => {
  if (state !== "playing") return;
  const point = canvasPoint(event);
  if (pendingShipment) {
    const order = hitPendingOrder(point);
    if (order) {
      dispatchPendingShipment(order.id);
    } else {
      toast("先点选高亮订单，安排这箱货的去向");
    }
    return;
  }
  const trayHit = hitTrayItem(point);
  if (trayHit?.item.variant === "bomb") {
    bombDrag = { item: trayHit.item, index: trayHit.index, x: point.x, y: point.y };
    if (canvas.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }
    toast("拖动炸弹到要清除的卡上");
    return;
  }

  const item = hitItem(point);
  if (!item) return;

  if (isBlocked(item)) {
    shakeBlocked(item);
    return;
  }

  addToTray(item);
});

canvas.addEventListener("pointermove", (event) => {
  const point = canvasPoint(event);
  if (!bombDrag && state === "playing") {
    const trayHit = hitTrayItem(point);
    const item = trayHit?.item || hitItem(point);
    hoverItemUid = item?.uid || null;
  }
  if (!bombDrag) return;
  bombDrag.x = Math.max(32, Math.min(W - 32, point.x));
  bombDrag.y = Math.max(32, Math.min(H - 32, point.y));
});

canvas.addEventListener("pointerleave", () => {
  hoverItemUid = null;
});

canvas.addEventListener("pointerup", (event) => {
  if (!bombDrag) return;
  const target = hitTrayItem(canvasPoint(event));
  useBombOnTray(target ? target.index : -1);
});

canvas.addEventListener("pointercancel", () => {
  bombDrag = null;
});

pauseBtn.addEventListener("click", openPauseMenu);
resumeBtn.addEventListener("click", closePauseMenu);
restartBtn.addEventListener("click", () => {
  pauseOverlay.classList.add("is-hidden");
  startLevel(level);
});
hintBtn.addEventListener("click", () => {
  closePauseMenu();
  showHint();
});
reviveBtn.addEventListener("click", () => {
  closePauseMenu();
  rewardSlot();
});
pauseTutorialBtn.addEventListener("click", () => {
  pauseTutorialPanel.classList.toggle("is-hidden");
});
document.addEventListener?.("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!diagnosticsOverlay.classList.contains("is-hidden")) {
    closeDiagnostics();
  } else if (!pauseOverlay.classList.contains("is-hidden")) {
    closePauseMenu();
  } else {
    openPauseMenu();
  }
});
document.addEventListener?.("visibilitychange", () => {
  if (document.hidden) saveActiveGame();
});
startBtn.addEventListener("click", () => {
  gameMode = "campaign";
  clearActiveSave();
  if (!startupParams.has("seed")) {
    runSeed = generateRunSeed();
    requestedStartLevel = 1;
  }
  startOverlay.classList.add("is-hidden");
  startLevel(requestedStartLevel);
});
rogueBtn.addEventListener("click", () => {
  gameMode = "rogue";
  clearActiveSave();
  runSeed = generateRunSeed();
  rogueRun = { floor: 1, upgrades: [] };
  runScore = 0;
  startOverlay.classList.add("is-hidden");
  startLevel(1);
});
continueBtn.addEventListener("click", restoreActiveGame);
tutorialBtn.addEventListener("click", () => {
  tutorialPanel.classList.toggle("is-hidden");
});

primaryBtn.addEventListener("click", () => {
  if (state === "won") {
    if (gameMode === "rogue") {
      overlay.classList.add("is-hidden");
      state = "menu";
      startOverlay.classList.remove("is-hidden");
      refreshContinueButton();
    } else if (level === 1) {
      overlay.classList.add("is-hidden");
      difficultyOverlay.classList.remove("is-hidden");
    } else {
      advanceToLevel(level + 1);
    }
  } else {
    rewardSlot();
  }
});

secondaryBtn.addEventListener("click", () => startLevel(level));
difficultyBtn.addEventListener("click", () => advanceToLevel(2));

seedBtn.addEventListener("click", () => copyDebugText(buildReproductionUrl(), "复现链接已复制"));
diagnosticsBtn.addEventListener("click", openDiagnostics);
modalDiagnosticsBtn.addEventListener("click", openDiagnostics);
closeDiagnosticsBtn.addEventListener("click", closeDiagnostics);
copyReportBtn.addEventListener("click", () => copyDebugText(buildDiagnosticReport(), "复现信息已复制"));

const startupParams = new URLSearchParams(window.location.search);
runSeed = normalizeSeed(startupParams.get("seed"));
requestedStartLevel = Math.max(1, Math.min(99, Number.parseInt(startupParams.get("level") || "1", 10) || 1));
if (requestedStartLevel > 1) startBtn.textContent = `开始第 ${requestedStartLevel} 关`;
startLevel(requestedStartLevel, "menu");
refreshContinueButton();
requestAnimationFrame(gameLoop);
