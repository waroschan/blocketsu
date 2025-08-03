const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const CONFIG = {
  cols: 8,
  rows: 6,
  lives: 3,
};

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

let balls = [];
let bricks = [];
let items = [];
let widenTimer = 0;

const state = {
  W: 0, H: 0, dpr: 1,
  paddleX: 0, paddleY: 0, paddleW: 120, paddleH: 18,
  baseBallSpeed: 500, ballR: 18,
  lives: CONFIG.lives,
};

function fitToScreen() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const vw = Math.max(320, Math.min(window.innerWidth, 1920));
  const vh = Math.max(480, Math.min(window.innerHeight, 1920));
  let w = vw, h = Math.floor(vw * 16/9);
  if (h > vh) { h = vh; w = Math.floor(vh * 9/16); }
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;
  state.W = w; state.H = h; state.dpr = dpr;
  recomputeLayout();
}

function recomputeLayout() {
  state.paddleW = Math.max(90, Math.floor(state.W * 0.2));
  state.paddleH = Math.max(14, Math.floor(state.H * 0.025));
  state.paddleY = state.H - Math.floor(state.H * 0.08);
  state.paddleX = Math.max(0, Math.min(state.paddleX || state.W/2 - state.paddleW/2, state.W - state.paddleW));
  state.baseBallSpeed = Math.floor(Math.min(state.W, state.H) * 0.7) * 0.7;
  state.ballR = Math.floor(Math.min(state.W, state.H) * 0.035);
  buildBricks();
}

function buildBricks() {
  bricks = [];
  const gridW = state.W;
  const gridH = Math.floor(state.H * 0.42);
  const cellW = gridW / CONFIG.cols;
  const cellH = gridH / CONFIG.rows;
  const margin = 2;
  for (let r = 0; r < CONFIG.rows; r++) {
    for (let c = 0; c < CONFIG.cols; c++) {
      if (c === 0 || c === CONFIG.cols - 1) continue;
      const x = c * cellW + margin;
      const y = r * cellH + margin;
      const w = cellW - margin * 2;
      const h = cellH - margin * 2;
      bricks.push({ x, y, w, h, r, c, alive: true });
    }
  }
}

function resetBalls() {
  balls = [];
  spawnBall(state.W/2, state.H*0.6);
}

function spawnBall(x, y) {
  const ang = (Math.random()*0.6+0.2)*Math.PI;
  const dir = Math.random()<0.5?-1:1;
  const sp = state.baseBallSpeed;
  balls.push({ x, y, vx: Math.cos(ang)*sp*dir, vy: -Math.abs(Math.sin(ang)*sp), r: state.ballR });
}

function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function aabbCircle(cx,cy,r,x,y,w,h){const nx=clamp(cx,x,x+w),ny=clamp(cy,y,y+h);const dx=cx-nx,dy=cy-ny;return dx*dx+dy*dy<=r*r;}

let last=performance.now(),dt=0;

function update(t){
  dt=(t-last)/1000; if(dt>0.033) dt=0.033; last=t;
  const paddle = { x: state.paddleX, y: state.paddleY, w: state.paddleW, h: state.paddleH };

  for(const b of balls){
    b.x += b.vx*dt; b.y += b.vy*dt; const r=b.r;
    if(b.x-r<0){b.x=r;b.vx*=-1;b.vy+=Math.sign(b.vy||1)*20}
    if(b.x+r>state.W){b.x=state.W-r;b.vx*=-1;b.vy+=Math.sign(b.vy||1)*20}
    if(b.y-r<0){b.y=r;b.vy*=-1}
    if(b.y-r>state.H){
      if(balls.length>1){balls.splice(balls.indexOf(b),1);continue}
      state.lives--; if(state.lives<=0){buildBricks();state.lives=CONFIG.lives;items=[]}
      resetBalls(); break;
    }
    if(aabbCircle(b.x,b.y,r,paddle.x,paddle.y,paddle.w,paddle.h)){
      const hit=(b.x-(paddle.x+paddle.w/2))/(paddle.w/2);
      const ang=hit*(Math.PI/4),spd=Math.hypot(b.vx,b.vy);
      b.vx=Math.sin(ang)*spd; b.vy=-Math.abs(Math.cos(ang)*spd);
      const minVy=spd*0.35; if(Math.abs(b.vy)<minVy) b.vy=-minVy; b.y=paddle.y-r-0.1;
    }
    for(const br of bricks){ if(!br.alive) continue; if(aabbCircle(b.x,b.y,r,br.x,br.y,br.w,br.h)){
      const prevX=b.x-b.vx*dt,prevY=b.y-b.vy*dt; const wasInsideX=prevX>=br.x&&prevX<=br.x+br.w; const wasInsideY=prevY>=br.y&&prevY<=br.y+br.h;
      if(!wasInsideX&&wasInsideY) b.vx*=-1; else if(wasInsideX&&!wasInsideY) b.vy*=-1; else { b.vx*=-1; b.vy*=-1 }
      br.alive=false; const se=document.getElementById('seBreak'); se&&se.play&&se.play().catch(()=>{});
      maybeDropItem(br.x+br.w/2, br.y+br.h/2); break;
    }}
  }

  for(const it of items){ it.y+=it.vy*dt; if(it.y>state.H+40) it.dead=true; if(!it.dead && aabbCircle(it.x,it.y,12,paddle.x,paddle.y,paddle.w,paddle.h)){ applyItem(it.type); it.dead=true; } }
  items=items.filter(i=>!i.dead);

  if(bricks.every(b=>!b.alive)){ spawnDialogs(20); buildBricks(); resetBalls(); }
}

function draw(){
  ctx.clearRect(0,0,state.W,state.H);
  ctx.fillStyle='#0a0a0a'; ctx.fillRect(0,0,state.W,state.H);
  ctx.fillStyle='#1e1e1e'; ctx.fillRect(0,0,state.W,Math.floor(state.H*0.44));
  ctx.fillStyle='#3a3a3a'; ctx.fillRect(0,Math.floor(state.H*0.44),state.W,2);
  ctx.fillStyle='#fff'; ctx.fillRect(state.paddleX,state.paddleY,state.paddleW,state.paddleH);

  const r=state.ballR;
  for(const b of balls){
    if(images.ball.complete&&images.ball.naturalWidth>0){ ctx.save(); ctx.translate(b.x,b.y); const spin=(performance.now()*0.25+b.x+b.y)*0.005; ctx.rotate(spin); ctx.drawImage(images.ball,-r,-r,r*2,r*2); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(b.x,b.y,r,0,Math.PI*2); ctx.fillStyle='#f5d90a'; ctx.fill(); }
  }

  if(images.blocks.complete&&images.blocks.naturalWidth>0){ const sw=images.blocks.naturalWidth/CONFIG.cols; const sh=images.blocks.naturalHeight/CONFIG.rows; for(const br of bricks){ if(!br.alive) continue; const sx=Math.floor(br.c%CONFIG.cols)*sw; const sy=Math.floor(br.r%CONFIG.rows)*sh; ctx.drawImage(images.blocks,sx,sy,sw,sh,br.x,br.y,br.w,br.h); } }
  else { ctx.fillStyle='#6ee7b7'; for(const br of bricks){ if(!br.alive) continue; ctx.fillRect(br.x,br.y,br.w,br.h); } }

  for(const it of items){ const size=28; if(it.type==='multi'&&images.item1.complete){ ctx.drawImage(images.item1,it.x-size/2,it.y-size/2,size,size); } else if(it.type==='widen'&&images.item2.complete){ ctx.drawImage(images.item2,it.x-size/2,it.y-size/2,size,size); } else { ctx.fillStyle = it.type==='widen'?'#60a5fa':'#f472b6'; ctx.beginPath(); ctx.arc(it.x,it.y,12,0,Math.PI*2); ctx.fill(); } }

  document.getElementById('lives').textContent = `LIVES: ${state.lives}`;
  document.getElementById('balls').textContent = `BALLS: ${balls.length}`;
}

function loop(t){ update(t); draw(); requestAnimationFrame(loop); }

function maybeDropItem(x,y){ const p=0.25; if(Math.random()>p) return; const types=['multi','widen']; const type=types[Math.floor(Math.random()*types.length)]; items.push({x,y,vy:160,type}); }
function applyItem(type){ if(type==='widen'){ state.paddleW=Math.min(Math.floor(state.paddleW*1.5), Math.floor(state.W*0.5)); widenTimer=8; } else if(type==='multi'){ const add=[]; for(const b of [...balls]){ const ang=Math.atan2(b.vy,b.vx); const spd=Math.hypot(b.vx,b.vy); add.push({x:b.x,y:b.y,vx:Math.cos(ang+0.25)*spd,vy:Math.sin(ang+0.25)*spd,r:b.r}); add.push({x:b.x,y:b.y,vx:Math.cos(ang-0.25)*spd,vy:Math.sin(ang-0.25)*spd,r:b.r}); } balls.push(...add); } }

function spawnDialogs(n){ const cont=document.getElementById('dialog-container'); if(!cont) return; const msg='こんなゲームにマジになっちゃってどうするの'; for(let i=0;i<n;i++){ const d=document.createElement('div'); d.className='dialog'; const x=Math.random()*(window.innerWidth-280); const y=Math.random()*(window.innerHeight-160); d.style.left=x+'px'; d.style.top=y+'px'; d.innerHTML=`<div class="title">確認</div><div class="body" style="display:flex;align-items:center;gap:10px"><img src="./etu.png" style="width:120px;height:120px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.35));transform:rotate(10deg)"/><div>${msg}</div></div><div class="actions"><button class="btn">OK</button><button class="btn">キャンセル</button></div>`; cont.appendChild(d);} }

function start(){ fitToScreen(); resetBalls(); last=performance.now(); requestAnimationFrame(loop);
  const bgm=document.getElementById('bgm'); const vol=document.getElementById('vol'); const muteBtn=document.getElementById('muteBtn'); bgm.volume=parseFloat(vol.value);
  const tryPlay=()=>{ const p=bgm.play(); if(p&&p.catch)p.catch(()=>{ bgm.muted=true; bgm.play().then(()=>{bgm.muted=false}).catch(()=>{}); }); };
  document.body.addEventListener('pointerdown',tryPlay,{once:true,passive:true});
  document.body.addEventListener('touchend',tryPlay,{once:true,passive:true});
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) tryPlay(); },{passive:true});
  vol.addEventListener('input',()=>{ bgm.volume=parseFloat(vol.value); });
  muteBtn.addEventListener('click',()=>{ bgm.muted=!bgm.muted; muteBtn.textContent=bgm.muted?'🔇':'🔈'; });
}

window.addEventListener('resize', fitToScreen);
window.addEventListener('load', start);

document.addEventListener('keydown',(e)=>{ if(e.key==='ArrowLeft'||e.key==='a') state.paddleX-=state.W*0.02; if(e.key==='ArrowRight'||e.key==='d') state.paddleX+=state.W*0.02; state.paddleX=clamp(state.paddleX,0,state.W-state.paddleW); });
let touchX=null; canvas.addEventListener('pointerdown',(e)=>{ touchX=e.clientX; }); canvas.addEventListener('pointermove',(e)=>{ if(touchX==null) return; const dx=e.movementX||(e.clientX-touchX); state.paddleX=clamp(state.paddleX+dx*1.1,0,state.W-state.paddleW); touchX=e.clientX; }); canvas.addEventListener('pointerup',()=>{ touchX=null; }); canvas.addEventListener('pointercancel',()=>{ touchX=null; });
