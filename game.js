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

const W = canvas.width;
const H = canvas.height;
const shelf = { x: 54, y: 238, w: 612, h: 520, rows: 5, cols: 6 };
const tray = { x: 54, y: 825, w: 612, h: 122, slots: 7 };
const BASE_TRAY_SLOTS = 7;
const MAX_TRAY_SLOTS = 9;
const ORDER_COUNT = 3;
const cellW = shelf.w / shelf.cols;
const cellH = shelf.h / shelf.rows;

function levelConfig(levelNumber) {
  const tier = Math.min(levelNumber, 12);
  return {
    typeCount: Math.min(4 + Math.floor(tier / 2), itemTypes.length),
    targetOrders: 6 + levelNumber + Math.floor(tier / 2),
    timeLimit: Math.max(54, 92 - tier * 3),
    refillTarget: Math.min(24 + tier * 2, 40),
    baseTriples: Math.min(5 + tier, 13),
    obstruction: 0.14 + Math.min(tier, 8) * 0.035,
    directorStrength: Math.max(0.35, 0.78 - tier * 0.045),
    rushChance: levelNumber < 2 ? 0 : Math.min(0.12 + tier * 0.035, 0.42),
    bulkChance: levelNumber < 3 ? 0 : Math.min(0.08 + tier * 0.025, 0.32),
    dualChance: levelNumber < 4 ? 0 : Math.min(0.06 + tier * 0.025, 0.28),
    rushPatience: Math.max(18, 34 - tier)
  };
}

const itemTypes = [
  { id: "cup", label: "杯", color: "#e85d4f", icon: "C" },
  { id: "plant", label: "植", color: "#48a868", icon: "P" },
  { id: "book", label: "书", color: "#3f82d7", icon: "B" },
  { id: "ball", label: "球", color: "#f2b84b", icon: "O" },
  { id: "box", label: "盒", color: "#9c6ade", icon: "X" },
  { id: "lamp", label: "灯", color: "#f27a3f", icon: "L" },
  { id: "star", label: "星", color: "#18a7a2", icon: "S" },
  { id: "shoe", label: "鞋", color: "#7b8794", icon: "U" }
];

let level = 1;
let items = [];
let trayItems = [];
let orders = [];
let completedOrders = 0;
let targetOrders = 8;
let score = 0;
let combo = 0;
let currentConfig = levelConfig(1);
let timeLeft = 75;
let lastTick = 0;
let state = "playing";
let nextUid = 1;
let nextOrderId = 1;
let message = "";
let messageUntil = 0;
let pulseItems = new Set();
let shakeItems = new Set();
let confetti = [];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function choice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function availableTypes() {
  const count = currentConfig.typeCount;
  return itemTypes.slice(0, count).map((type) => type.id);
}

function itemType(typeId) {
  return itemTypes.find((item) => item.id === typeId);
}

function activeItems() {
  return items.filter((item) => !item.cleared);
}

function selectableItems() {
  return activeItems().filter((item) => !isBlocked(item));
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
  const roll = Math.random();
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

function createItem(typeId, placement) {
  return {
    uid: `item-${nextUid++}`,
    typeId,
    row: placement.row,
    col: placement.col,
    layer: placement.layer,
    z: nextUid,
    cleared: false
  };
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
  const extra = shuffle([...middle, ...middle]).slice(0, Math.max(0, count - base.length));
  const placements = [...base, ...extra];

  const lifted = shuffle(placements.filter((cell) => cell.row > 0 && cell.row < shelf.rows - 1 && cell.col > 0 && cell.col < shelf.cols - 1));
  const liftCount = Math.min(lifted.length, Math.floor(count * currentConfig.obstruction));
  lifted.slice(0, liftCount).forEach((cell, index) => {
    cell.layer = count > 28 && index % 5 === 0 ? 2 : 1;
  });

  return shuffle(placements);
}

function buildInitialItems() {
  const types = availableTypes();
  const pool = [];

  orders.forEach((order) => {
    order.lines.forEach((line) => {
      for (let i = 0; i < line.needed; i += 1) {
        pool.push(line.typeId);
      }
    });
  });

  const extraTriples = currentConfig.baseTriples;
  for (let i = 0; i < extraTriples; i += 1) {
    const orderTypes = allOrderTypeIds();
    const typeId = i < 3 ? orderTypes[i % orderTypes.length] : types[i % types.length];
    pool.push(typeId, typeId, typeId);
  }

  const placements = makePlacements(pool.length);
  items = shuffle(pool).map((typeId, index) => createItem(typeId, placements[index]));
}

function startLevel(nextLevel = level) {
  level = nextLevel;
  currentConfig = levelConfig(level);
  state = "playing";
  overlay.classList.add("is-hidden");
  trayItems = [];
  tray.slots = BASE_TRAY_SLOTS;
  orders = [];
  completedOrders = 0;
  score = 0;
  combo = 0;
  nextUid = 1;
  nextOrderId = 1;
  pulseItems = new Set();
  shakeItems = new Set();
  confetti = [];
  targetOrders = currentConfig.targetOrders;
  timeLeft = currentConfig.timeLimit;
  message = "";
  messageUntil = 0;

  for (let i = 0; i < ORDER_COUNT; i += 1) {
    orders.push(createOrder());
  }
  buildInitialItems();
  stabilizeBoard();
  updateHud();
}

function updateHud() {
  levelText.textContent = level;
  itemsText.textContent = `${completedOrders}/${targetOrders}`;
  timeText.textContent = Math.ceil(timeLeft);
  reviveBtn.textContent = tray.slots >= MAX_TRAY_SLOTS ? "已满级" : "卡槽+1";
  reviveBtn.disabled = tray.slots >= MAX_TRAY_SLOTS && state === "playing";
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

  drawText("订单货架", W / 2, 52, 40, "#22313f", 800);
  drawText("凑三消给顾客出单，别把暂存槽塞满", W / 2, 92, 21, "#6b7886", 500);
  drawOrders();
}

function drawOrders() {
  const cardW = 188;
  const gap = 14;
  const startX = (W - cardW * ORDER_COUNT - gap * (ORDER_COUNT - 1)) / 2;

  orders.forEach((order, index) => {
    const primaryType = itemType(order.lines[0].typeId);
    const x = startX + index * (cardW + gap);
    const y = 122;
    roundRect(x, y, cardW, 86, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = order.kind === "rush" ? "#e85d4f" : primaryType.color;
    ctx.stroke();

    const label = order.kind === "rush" ? "急单" : order.kind === "bulk" ? "大单" : order.kind === "dual" ? "双品" : "订单";
    drawText(label, x + 16, y + 20, 16, order.kind === "rush" ? "#e85d4f" : "#6b7886", 800, "left");

    if (order.kind === "rush") {
      const ratio = Math.max(0, order.patience / order.maxPatience);
      roundRect(x + 104, y + 14, 62, 10, 5);
      ctx.fillStyle = "#f1e8dc";
      ctx.fill();
      roundRect(x + 104, y + 14, 62 * ratio, 10, 5);
      ctx.fillStyle = ratio < 0.35 ? "#e85d4f" : "#48a868";
      ctx.fill();
    }

    order.lines.forEach((line, lineIndex) => {
      const type = itemType(line.typeId);
      const itemX = x + 42 + lineIndex * 76;
      const textX = itemX + 42;
      drawMiniItem(type, itemX, y + 57, 38);
      drawText(`${line.progress}/${line.needed}`, textX, y + 57, 23, "#22313f", 900);
    });
  });
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

function drawShelf() {
  roundRect(shelf.x - 18, shelf.y - 22, shelf.w + 36, shelf.h + 42, 20);
  ctx.fillStyle = "#d8aa72";
  ctx.fill();

  roundRect(shelf.x, shelf.y, shelf.w, shelf.h, 16);
  ctx.fillStyle = "#f7d397";
  ctx.fill();

  ctx.strokeStyle = "#9f6d3d";
  ctx.lineWidth = 8;
  for (let r = 1; r < shelf.rows; r += 1) {
    const y = shelf.y + r * cellH;
    ctx.beginPath();
    ctx.moveTo(shelf.x, y);
    ctx.lineTo(shelf.x + shelf.w, y);
    ctx.stroke();
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(159, 109, 61, 0.38)";
  for (let c = 1; c < shelf.cols; c += 1) {
    const x = shelf.x + c * cellW;
    ctx.beginPath();
    ctx.moveTo(x, shelf.y + 8);
    ctx.lineTo(x, shelf.y + shelf.h - 8);
    ctx.stroke();
  }
}

function itemCenter(item) {
  const layerOffset = item.layer * 12;
  return {
    x: shelf.x + item.col * cellW + cellW / 2 + layerOffset,
    y: shelf.y + item.row * cellH + cellH / 2 - layerOffset
  };
}

function itemSize(item) {
  return 62 + item.layer * 3;
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

function drawItem(item, x, y, size, alpha = 1) {
  const type = itemType(item.typeId);
  const blocked = item.inTray ? false : isBlocked(item);
  const pulsing = pulseItems.has(item.uid);
  const shaking = shakeItems.has(item.uid);
  const shake = shaking ? Math.sin(performance.now() / 36) * 5 : 0;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + shake, y);
  ctx.scale(pulsing ? 1.1 : 1, pulsing ? 1.1 : 1);

  ctx.shadowColor = "rgba(34, 49, 63, 0.18)";
  ctx.shadowBlur = blocked ? 6 : 14;
  ctx.shadowOffsetY = blocked ? 3 : 8;
  roundRect(-size / 2, -size / 2, size, size, 16);
  ctx.fillStyle = blocked ? "#aeb7c2" : type.color;
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.lineWidth = blocked ? 4 : 5;
  ctx.strokeStyle = blocked ? "rgba(72, 84, 96, 0.44)" : "rgba(255,255,255,0.75)";
  ctx.stroke();

  ctx.fillStyle = blocked ? "rgba(255,255,255,0.52)" : "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.arc(0, -size * 0.08, size * 0.23, 0, Math.PI * 2);
  ctx.fill();

  drawText(type.icon, 0, size * 0.19, size * 0.36, "#ffffff", 900);
  drawText(type.label, 0, -size * 0.1, size * 0.2, blocked ? "#66717d" : type.color, 900);

  if (blocked) {
    drawText("锁", size * 0.26, -size * 0.27, size * 0.22, "#ffffff", 900);
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

function drawTray() {
  const slotW = tray.w / tray.slots;
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

  trayItems.forEach((item, index) => {
    const x = tray.x + index * slotW + slotW / 2;
    drawItem({ ...item, layer: 0, inTray: true }, x, tray.y + tray.h / 2, 56);
  });
}

function drawMessages(now) {
  if (message && now < messageUntil) {
    roundRect(94, 774, 532, 52, 26);
    ctx.fillStyle = "rgba(34, 49, 63, 0.86)";
    ctx.fill();
    drawText(message, W / 2, 800, 22, "#ffffff", 700);
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

function render(now = performance.now()) {
  drawBackground();
  drawShelf();
  drawItems();
  drawTray();
  drawConfetti();
  drawMessages(now);
}

function updateOrders(dt) {
  orders.forEach((order) => {
    if (order.kind !== "rush" || state !== "playing") return;
    order.patience -= dt;
    if (order.patience <= 0) {
      timeLeft = Math.max(0, timeLeft - 8);
      toast("急单超时，扣 8 秒");
      replaceOrder(order);
      stabilizeBoard();
    }
  });
}

function gameLoop(now) {
  if (!lastTick) lastTick = now;
  const dt = Math.min(0.05, (now - lastTick) / 1000);
  lastTick = now;

  if (state === "playing") {
    timeLeft -= dt;
    updateOrders(dt);
    if (timeLeft <= 0) {
      timeLeft = 0;
      fail("顾客等太久了");
    }
    updateHud();
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

function hitItem(point) {
  const candidates = activeItems().slice().sort(itemHitOrder);
  for (const item of candidates) {
    if (pointInBounds(point, itemBounds(item), 4)) return item;
  }
  return null;
}

function orderForType(typeId) {
  return orders.find((order) => order.lines.some((line) => line.typeId === typeId && line.progress < line.needed));
}

function isOrderComplete(order) {
  return order.lines.every((line) => line.progress >= line.needed);
}

function addToTray(item) {
  if (trayItems.length >= tray.slots) {
    fail("暂存槽满了");
    return;
  }

  item.cleared = true;
  trayItems.push({ ...item, scale: 1 });
  checkMatches();
  if (activeItems().length < 12) {
    refillShelf();
  }
  stabilizeBoard();
  updateHud();

  if (trayItems.length >= tray.slots) {
    fail("暂存槽满了");
  }
}

function checkMatches() {
  const counts = new Map();
  trayItems.forEach((item) => {
    counts.set(item.typeId, (counts.get(item.typeId) || 0) + 1);
  });

  for (const [typeId, count] of counts) {
    if (count >= 3) {
      let removed = 0;
      trayItems = trayItems.filter((item) => {
        if (item.typeId === typeId && removed < 3) {
          removed += 1;
          return false;
        }
        return true;
      });
      resolveShipment(typeId);
      break;
    }
  }
}

function resolveShipment(typeId) {
  const order = orderForType(typeId);
  burst(typeId);

  if (order) {
    const line = order.lines.find((entry) => entry.typeId === typeId && entry.progress < entry.needed);
    line.progress = Math.min(line.needed, line.progress + 3);
    score += 45 + level * 8 + combo * 8;

    if (isOrderComplete(order)) {
      combo += 1;
      completedOrders += 1;
      const bonus = order.kind === "rush" ? 80 : order.kind === "dual" ? 65 : order.kind === "bulk" ? 55 : 35;
      score += 90 + bonus + combo * 15;
      toast(combo > 1 ? `连单 x${combo}` : `完成 ${itemType(typeId).label} 订单`);
      const newOrder = replaceOrder(order);
      refillShelf([newOrder?.lines[0].typeId, ...orderTypeIds(newOrder || orders[0])]);
      timeLeft += order.kind === "rush" ? 6 : 3;
    } else {
      toast(`${itemType(typeId).label} 已出货，还差一项`);
      refillShelf([typeId, order.lines.find((entry) => entry.progress < entry.needed)?.typeId]);
    }
  } else {
    combo = 0;
    score += 25;
    timeLeft = Math.max(0, timeLeft - Math.min(5, 2 + Math.floor(level / 3)));
    toast("散货出库，顾客有点急了");
  }

  if (completedOrders >= targetOrders) {
    win();
  }
}

function replaceOrder(doneOrder) {
  const index = orders.findIndex((order) => order.id === doneOrder.id);
  if (index === -1) return null;
  orders[index] = createOrder(preferredRefillType());
  return orders[index];
}

function preferredRefillType() {
  const selectable = selectableItems();
  const trayCounts = new Map();
  trayItems.forEach((item) => trayCounts.set(item.typeId, (trayCounts.get(item.typeId) || 0) + 1));

  for (const [typeId, count] of trayCounts) {
    if (count > 0 && selectable.some((item) => item.typeId === typeId)) {
      return typeId;
    }
  }

  return selectable.length ? choice(selectable).typeId : choice(availableTypes());
}

function refillShelf(priorityTypes = []) {
  const types = availableTypes();
  const pool = [];
  const needed = Math.max(6, currentConfig.refillTarget - activeItems().length);

  priorityTypes.forEach((typeId) => {
    if (typeId) pool.push(typeId, typeId, typeId);
  });

  orders.forEach((order) => {
    order.lines.forEach((line) => {
      pool.push(line.typeId);
    });
  });

  while (pool.length < needed) {
    const orderTypes = allOrderTypeIds();
    const typeId = Math.random() < 0.5 + currentConfig.directorStrength * 0.22 ? choice(orderTypes) : choice(types);
    pool.push(typeId);
  }

  const placements = makePlacements(pool.length);
  shuffle(pool).forEach((typeId, index) => {
    items.push(createItem(typeId, placements[index]));
  });
}

function stabilizeBoard() {
  const selectable = selectableItems();
  if (!selectable.length) {
    const top = activeItems().slice().sort(itemHitOrder)[0];
    if (top) top.layer = Math.max(0, top.layer - 1);
    return;
  }

  const wanted = wantedType();
  const shouldIntervene = Math.random() < currentConfig.directorStrength || trayItems.length >= tray.slots - 2;
  if (wanted && shouldIntervene && !selectable.some((item) => item.typeId === wanted)) {
    choice(selectable).typeId = wanted;
  }

  const orderTypes = new Set(allOrderTypeIds());
  if (!selectableItems().some((item) => orderTypes.has(item.typeId))) {
    choice(selectableItems()).typeId = choice(allOrderTypeIds());
  }
}

function wantedType() {
  const counts = new Map();
  trayItems.forEach((item) => counts.set(item.typeId, (counts.get(item.typeId) || 0) + 1));

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

function win() {
  state = "won";
  showModal("通关", "今日订单完成", `完成 ${completedOrders} 单，得分 ${score}。下一关订单更多、遮挡更重。`, "下一关");
}

function fail(reason) {
  if (state !== "playing") return;
  state = "failed";
  showModal("失败", reason, "可以重开，也可以模拟一次激励广告增加 1 个卡槽。", "看广告扩槽");
}

function showModal(kicker, title, body, primaryLabel) {
  modalKicker.textContent = kicker;
  modalTitle.textContent = title;
  modalBody.textContent = body;
  primaryBtn.textContent = primaryLabel;
  secondaryBtn.textContent = "重开";
  overlay.classList.remove("is-hidden");
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
  const hinted = selectable.filter((item) => item.typeId === target);
  pulseItems = new Set((hinted.length ? hinted : selectable.slice(0, 2)).map((item) => item.uid));
  toast(target ? `优先拿 ${itemType(target).label}` : "先解开上层遮挡");
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
  const item = hitItem(canvasPoint(event));
  if (!item) return;

  if (isBlocked(item)) {
    shakeBlocked(item);
    return;
  }

  addToTray(item);
});

restartBtn.addEventListener("click", () => startLevel(level));
hintBtn.addEventListener("click", showHint);
reviveBtn.addEventListener("click", rewardSlot);

primaryBtn.addEventListener("click", () => {
  if (state === "won") {
    startLevel(level + 1);
  } else {
    rewardSlot();
  }
});

secondaryBtn.addEventListener("click", () => startLevel(level));

startLevel(1);
requestAnimationFrame(gameLoop);
