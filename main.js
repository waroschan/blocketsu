const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const vw = Math.max(320, Math.min(window.innerWidth, 1920));
  const vh = Math.max(480, Math.min(window.innerHeight, 1920));
  let w = vw, h = Math.floor(vw * 16/9);
  if (h > vh) { h = vh; w = Math.floor(vh * 9/16); }
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.scale(dpr, dpr);
  recalcLayout();
}

window.addEventListener('resize', resizeCanvas);

const CONFIG = {
  cols: 10,
  rows: 6,
  paddleWidth: 120,
  paddleHeight: 18,
  paddleSpeed: 900,
  ballSpeed: 600 * 0.7,
  lives: 3,
  blockMargin: 2,
};

const keys = { left: false, right: false };

const images = {
  ball: new Image(),
  blocks: new Image(),
  item1: new Image(),
  item2: new Image(),
};
images.ball.src = './etu.png';
images.blocks.src = './narita.png';
images.item1.src = './item1.jpg';
images.item2.src = './item2.jpg';

let state = {
  paddleX: 0,
  paddleY: 0,
  ballX: canvas.width / 2,
  ballY: canvas.height / 2,
  ballVX: CONFIG.ballSpeed * (Math.random() < 0.5 ? -1 : 1) * 0.7,
  ballVY: -CONFIG.ballSpeed * 0.7,
  running: false,
  lives: CONFIG.lives,
};

let bricks = [];
let balls = null;
let items = [];
const ITEM_TYPES = { WIDEN: 'widen', MULTI: 'multi' };

function createBricks() {
  bricks = [];
  const gridW = canvas.width;
  const gridH = Math.floor(canvas.height * 0.42);
  const cellW = gridW / CONFIG.cols;
  const cellH = gridH / CONFIG.rows;
  for (let r = 0; r < CONFIG.rows; r++) {
    for (let c = 0; c < CONFIG.cols; c++) {
      const x = c * cellW + CONFIG.blockMargin;
      const y = r * cellH + CONFIG.blockMargin;
      const w = cellW - CONFIG.blockMargin * 2;
      const h = cellH - CONFIG.blockMargin * 2;
      if (c === 0 || c === CONFIG.cols - 1) continue;
      if (w < 18) continue;
      bricks.push({ x, y, w, h, r, c, alive: true });
    }
  }
}

function resetBall() {
  const angle = (Math.random() * 0.6 + 0.2) * Math.PI;
  const dir = Math.random() < 0.5 ? -1 : 1;
  balls = [{
    x: canvas.width / 2,
    y: canvas.height * 0.6,
    vx: Math.cos(angle) * CONFIG.ballSpeed * dir,
    vy: -Math.abs(Math.sin(angle) * CONFIG.ballSpeed),
  }];
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function aabbCircleCollision(cx, cy, r, x, y, w, h) {
  const nx = clamp(cx, x, x + w);
  const ny = clamp(cy, y, y + h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

function reflectCircleFromRect(cx, cy, vx, vy, r, rect) {
  const prevX = cx - vx * dt;
  const prevY = cy - vy * dt;
  const wasInsideX = prevX >= rect.x && prevX <= rect.x + rect.w;
  const wasInsideY = prevY >= rect.y && prevY <= rect.y + rect.h;
  if (!wasInsideX && wasInsideY) return { vx: -vx, vy };
  if (wasInsideX && !wasInsideY) return { vx, vy: -vy };
  return { vx: -vx, vy: -vy };
}

let last = performance.now();

function recalcLayout() {
  const W = canvas.width, H = canvas.height;
  CONFIG.paddleWidth = Math.max(90, Math.floor(W * 0.18));
  CONFIG.paddleHeight = Math.max(14, Math.floor(H * 0.025));
  CONFIG.paddleSpeed = Math.max(600, Math.floor(W * 1.2));
  CONFIG.ballSpeed = Math.max(280, Math.floor(Math.min(W, H) * 0.7)) * 0.7;
  state.paddleY = H - Math.floor(H * 0.08);
  state.paddleX = clamp(state.paddleX || W/2 - CONFIG.paddleWidth/2, 0, W - CONFIG.paddleWidth);
}
let dt = 0;

function update(time) {
  dt = (time - last) / 1000;
  if (dt > 0.033) dt = 0.033;
  last = time;

  const speed = CONFIG.paddleSpeed * dt;
  if (keys.left) state.paddleX -= speed;
  if (keys.right) state.paddleX += speed;
  state.paddleX = clamp(state.paddleX, 0, canvas.width - CONFIG.paddleWidth);

  const radius = Math.floor(Math.min(canvas.width, canvas.height) * 0.035);
  const paddle = { x: state.paddleX, y: state.paddleY, w: CONFIG.paddleWidth, h: CONFIG.paddleHeight };

  for (const ball of balls) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - radius < 0) { ball.x = radius; ball.vx *= -1; ball.vy += Math.sign(ball.vy || 1) * 20; }
    if (ball.x + radius > canvas.width) { ball.x = canvas.width - radius; ball.vx *= -1; ball.vy += Math.sign(ball.vy || 1) * 20; }
    if (ball.y - radius < 0) { ball.y = radius; ball.vy *= -1; }
    if (ball.y - radius > canvas.height) {
      if (balls.length > 1) {
        balls.splice(balls.indexOf(ball), 1);
        continue;
      }
      state.lives--;
      if (state.lives <= 0) { createBricks(); state.lives = CONFIG.lives; items = []; }
      resetBall();
      break;
    }

    if (aabbCircleCollision(ball.x, ball.y, radius, paddle.x, paddle.y, paddle.w, paddle.h)) {
      const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const angle = hit * (Math.PI / 4);
      const speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.abs(Math.cos(angle) * speed);
      const minVy = speed * 0.35;
      if (Math.abs(ball.vy) < minVy) ball.vy = -minVy;
      ball.y = paddle.y - radius - 0.1;
    }

    for (const b of bricks) {
      if (!b.alive) continue;
      if (aabbCircleCollision(ball.x, ball.y, radius, b.x, b.y, b.w, b.h)) {
        const rv = reflectCircleFromRect(ball.x, ball.y, ball.vx, ball.vy, radius, b);
        ball.vx = rv.vx; ball.vy = rv.vy;
        b.alive = false;
        const se = document.getElementById('seBreak');
        if (se) { se.currentTime = 0; se.play().catch(() => {}); }
        maybeDropItem(b.x + b.w/2, b.y + b.h/2);
        break;
      }
    }
  }

  for (const it of items) {
    it.y += it.vy * dt;
    if (it.y > canvas.height + 40) it.dead = true;
    if (!it.dead && aabbCircleCollision(it.x, it.y, 10, paddle.x, paddle.y, paddle.w, paddle.h)) {
      applyItem(it.type);
      it.dead = true;
    }
  }
  items = items.filter(i => !i.dead);

  if (bricks.every(b => !b.alive)) {
    spawnDialogs(20);
    createBricks();
    resetBall();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, canvas.width, 300 + 4);

  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(0, 300 + 4, canvas.width, 2);

  ctx.fillStyle = '#fff';
  ctx.fillRect(state.paddleX, state.paddleY, CONFIG.paddleWidth, CONFIG.paddleHeight);

  const r = Math.floor(Math.min(canvas.width, canvas.height) * 0.035);
  for (const ball of balls) {
    if (images.ball.complete && images.ball.naturalWidth > 0) {
      ctx.save();
      ctx.translate(ball.x, ball.y);
      const spin = (performance.now() * 0.25 + ball.x + ball.y) * 0.005;
      ctx.rotate(spin);
      ctx.drawImage(images.ball, -r, -r, r * 2, r * 2);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#f5d90a';
      ctx.fill();
    }
  }

  for (const it of items) {
    const size = 28;
    if (it.type === ITEM_TYPES.MULTI && images.item1.complete) {
      ctx.drawImage(images.item1, it.x - size/2, it.y - size/2, size, size);
    } else if (it.type === ITEM_TYPES.WIDEN && images.item2.complete) {
      ctx.drawImage(images.item2, it.x - size/2, it.y - size/2, size, size);
    } else {
      ctx.fillStyle = it.type === ITEM_TYPES.WIDEN ? '#60a5fa' : '#f472b6';
      ctx.beginPath();
      ctx.arc(it.x, it.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (images.blocks.complete && images.blocks.naturalWidth > 0) {
    const sw = images.blocks.naturalWidth / CONFIG.cols;
    const sh = images.blocks.naturalHeight / CONFIG.rows;
    for (const b of bricks) {
      if (!b.alive) continue;
      const sx = Math.floor(b.c % CONFIG.cols) * sw;
      const sy = Math.floor(b.r % CONFIG.rows) * sh;
      ctx.drawImage(images.blocks, sx, sy, sw, sh, b.x, b.y, b.w, b.h);
    }
  } else {
    ctx.fillStyle = '#6ee7b7';
    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }

  ctx.fillStyle = '#ddd';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`LIVES: ${state.lives}`, 12, canvas.height - 8);
  ctx.fillText(`BALLS: ${balls?.length ?? 0}`, 120, canvas.height - 8);
}

function loop(time) {
  update(time);
  draw();
  if (widenTimer > 0) {
    widenTimer -= dt;
    if (widenTimer <= 0) CONFIG.paddleWidth = 120;
  }

  requestAnimationFrame(loop);
}

function start() {
  resizeCanvas();
  createBricks();
  resetBall();
  const bgm = document.getElementById('bgm');
  const vol = document.getElementById('vol');
  const muteBtn = document.getElementById('muteBtn');
  bgm.volume = parseFloat(vol.value);
  const tryPlay = () => {
    const p = bgm.play();
    if (p && p.catch) p.catch(() => {
      bgm.muted = true;
      bgm.play().then(() => { bgm.muted = false; }).catch(() => {});
    });
  };
  document.body.addEventListener('pointerdown', tryPlay, { once: true, passive: true });
  document.body.addEventListener('touchend', tryPlay, { once: true, passive: true });
  document.body.addEventListener('keydown', tryPlay, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tryPlay(); }, { passive: true });
  vol.addEventListener('input', () => { bgm.volume = parseFloat(vol.value); });
  muteBtn.addEventListener('click', () => {
    bgm.muted = !bgm.muted;
    muteBtn.textContent = bgm.muted ? '🔇' : '🔈';
  });
  last = performance.now();
  requestAnimationFrame(loop);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

window.addEventListener('load', start);

function spawnDialogs(n) {
  const cont = document.getElementById('dialog-container');
  if (!cont) return;

  const msg = 'こんなゲームにマジになっちゃってどうするの';
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'dialog';
    const x = Math.random() * (window.innerWidth - 280);
    const y = Math.random() * (window.innerHeight - 160);
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.innerHTML = `<div class="title">確認</div>
      <div class="body" style="display:flex;align-items:center;gap:10px">
        <img src="./etu.png" style="width:120px;height:120px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.35));transform:rotate(10deg)"/>
        <div>${msg}</div>
      </div>
      <div class="actions">
        <button class="btn">OK</button>
        <button class="btn">キャンセル</button>
      </div>`;
    cont.appendChild(d);
  }

}

function maybeDropItem(x, y) {
  const p = 0.25;
  if (Math.random() > p) return;
  const types = [ITEM_TYPES.MULTI, ITEM_TYPES.WIDEN];
  const type = types[Math.floor(Math.random() * types.length)];
  items.push({ x, y, vy: 160, type });
}

let widenTimer = 0;
function applyItem(type) {
  if (type === ITEM_TYPES.WIDEN) {
    CONFIG.paddleWidth = Math.min(CONFIG.paddleWidth * 1.5, 320);
    widenTimer = 8;
  } else if (type === ITEM_TYPES.MULTI) {
    const nb = [];
    for (const b of [...balls]) {
      const angle = Math.atan2(b.vy, b.vx);
      const spd = Math.hypot(b.vx, b.vy);
      nb.push({ x: b.x, y: b.y, vx: Math.cos(angle + 0.25) * spd, vy: Math.sin(angle + 0.25) * spd });
      nb.push({ x: b.x, y: b.y, vx: Math.cos(angle - 0.25) * spd, vy: Math.sin(angle - 0.25) * spd });
    }
    balls.push(...nb);
  }
}


let touchX = null;
canvas.addEventListener('pointerdown', (e) => {
  touchX = e.clientX;
});
canvas.addEventListener('pointermove', (e) => {
  if (touchX == null) return;
  const dx = e.movementX || (e.clientX - touchX);
  state.paddleX = clamp(state.paddleX + dx * 1.2, 0, canvas.width - CONFIG.paddleWidth);
  touchX = e.clientX;
});
canvas.addEventListener('pointerup', () => { touchX = null; });
canvas.addEventListener('pointercancel', () => { touchX = null; });
