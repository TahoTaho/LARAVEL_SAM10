// public/game.js
(() => {
  // ---------- API (server computes score) ----------
  const API = location.origin;
  const ls = window.localStorage;
  async function submitRun(metrics){
    const player_id = ls.getItem('player_id');
    if(!player_id){ alert('Register first (top-left)'); return; }
    const res = await fetch(`${API}/api/score`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ player_id, ...metrics })
    });
    return res.json();
  }

  // ---------- Canvas / Map ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const TILE = 40;
  const COLS = Math.floor(W / TILE);
  const ROWS = Math.floor(H / TILE);

  // Base map: 0=floor, 1=wall (no static shadows; we render dynamic shadows separately)
  const baseMap = Array.from({length: ROWS}, (_,y) =>
    Array.from({length: COLS}, (_,x) => {
      if (y===0||y===ROWS-1||x===0||x===COLS-1) return 1; // border
      if ((x>6 && x<10 && y>4 && y<10) || (x>20 && x<25 && y>9 && y<14)) return 1; // inner walls
      return 0; // floor
    })
  );
  function tileAt(px, py){
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx<0||ty<0||tx>=COLS||ty>=ROWS) return 1;
    return baseMap[ty][tx];
  }
  const isWall = (px,py) => tileAt(px,py) === 1;

  // ---------- Dynamic Shadows (moving hide zones) ----------
  // Shadows are groups of radial blobs that fade/crossfade to new positions.
  let shadowSetA = generateShadowBlobs(3);
  let shadowSetB = generateShadowBlobs(3);
  let shadowTransitioning = false;
  let shadowMix = 0;         // 0 = show A, 1 = show B
  let shadowCycleTimer = 0;  // time since last cycle start
  const SHADOW_CYCLE = 7.0;  // seconds before we start moving shadows
  const SHADOW_FADE  = 1.5;  // crossfade seconds
  const SHADOW_MIN_STRENGTH = 0.5; // threshold to count as "in shadow"

  function generateShadowBlobs(n=3){
    const blobs = [];
    let attempts = 0;
    while (blobs.length < n && attempts < 1000){
      attempts++;
      const tx = 2 + Math.floor(Math.random()*(COLS-4));
      const ty = 2 + Math.floor(Math.random()*(ROWS-4));
      const x = tx*TILE + TILE/2, y = ty*TILE + TILE/2;
      if (isWall(x,y)) continue;
      const r = (120 + Math.random()*90); // 3..4.5 tiles
      if (blobs.some(b => Math.hypot(b.x-x, b.y-y) < (b.r + r) * 0.6)) continue;
      blobs.push({x,y,r});
    }
    if (!blobs.length) blobs.push({x: W*0.6, y: H*0.5, r: 140});
    return blobs;
  }

  function updateShadows(dt){
    shadowCycleTimer += dt;
    if (!shadowTransitioning && shadowCycleTimer >= SHADOW_CYCLE){
      shadowTransitioning = true;
      shadowMix = 0;
      shadowSetB = generateShadowBlobs(3);
    }
    if (shadowTransitioning){
      shadowMix = Math.min(1, shadowMix + dt/SHADOW_FADE);
      if (shadowMix >= 1){
        // B becomes A; start fresh idle cycle
        shadowSetA = shadowSetB;
        shadowTransitioning = false;
        shadowCycleTimer = 0;
        shadowMix = 0;
      }
    }
  }

  function shadowStrengthAt(x,y){
    // Strength is max of (A*(1-mix), B*mix). Each blob contributes (1 - d/r)^2
    const sA = blobSetStrength(shadowSetA, x, y);
    const sB = blobSetStrength(shadowSetB, x, y);
    return Math.max(sA * (1 - shadowMix), sB * shadowMix);
  }
  function blobSetStrength(blobs, x, y){
    let s = 0;
    for (const b of blobs){
      const d = Math.hypot(x - b.x, y - b.y);
      const k = clamp(1 - d / b.r, 0, 1);
      s = Math.max(s, k*k); // smoother falloff
    }
    return s;
  }
  function inShadow(px,py){ return shadowStrengthAt(px,py) >= SHADOW_MIN_STRENGTH; }

  function renderShadows(){
  // Draw both sets with crossfade and a darker core + subtle teal rim for clarity
  const t = performance.now()/600;
  const z = (Math.sin(t)+1)*0.02 + 1; // 0.98..1.02 breathing
  const drawSet = (set, alpha) => {
    if (alpha <= 0) return;
    for (const b of set){
      const r = b.r * z;

      // darker, clearer gradient (higher alpha at center)
      const g = ctx.createRadialGradient(b.x, b.y, r*0.08, b.x, b.y, r);
      // center: strong dark
      g.addColorStop(0.0, `rgba(7,10,18,${0.85*alpha})`);
      // mid: still clearly darker than floor
      g.addColorStop(0.6, `rgba(9,13,22,${0.55*alpha})`);
      // edge: feather to 0
      g.addColorStop(1.0, `rgba(10,15,24,0)`);

      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI*2); ctx.fill();

      // faint teal rim so the boundary is visible (but not harsh)
      ctx.strokeStyle = `rgba(125,230,198,${0.18*alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, r*0.98, 0, Math.PI*2); ctx.stroke();

      // darker inner core to sell "safe" area
      ctx.fillStyle = `rgba(5,7,12,${0.25*alpha})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, r*0.45, 0, Math.PI*2); ctx.fill();
    }
  };
  drawSet(shadowSetA, 1 - shadowMix);
  drawSet(shadowSetB, shadowMix);
}


  // ---------- Input ----------
  const keys = new Set();
  window.addEventListener('keydown', e => {
    keys.add(e.key);
    if (e.key === 'Enter') finishRun(false);   // manual end
    if (e.key === 'e') tryBackstab();
  });
  window.addEventListener('keyup', e => keys.delete(e.key));

  // ---------- Entities ----------
  const player = { x: TILE*3, y: TILE*3, r: 12, speed: 170, dashSpeed: 310, noise: 0 };

  const GUARD_TEMPLATE = {
    r: 14, speed: 100, dir: 0, fov: (60*Math.PI)/180, range: 220,
    patrol: [], idx: 0, alerted: 0, linger: 0
  };
  /** @type {Array<ReturnType<typeof makeGuard>>} */
  let guards = [];
  let backstabTargetIndex = -1; // for indicator

  function makeGuard(px, py){
    return {
      ...GUARD_TEMPLATE,
      x: px, y: py,
      patrol: randomPatrol(5),
      idx: 1
    };
  }

  function randomWalkableCenter(){
    for (let tries=0; tries<500; tries++){
      const tx = 2 + Math.floor(Math.random()*(COLS-4));
      const ty = 2 + Math.floor(Math.random()*(ROWS-4));
      const x = tx*TILE + TILE/2, y = ty*TILE + TILE/2;
      if (!isWall(x,y)) return {x,y};
    }
    return {x:TILE*26, y:TILE*10};
  }

  function randomPatrol(n=5){
    const pts = [];
    let attempts = 0;
    while (pts.length < n && attempts < 2000){
      attempts++;
      const p = randomWalkableCenter();
      if (pts.some(q => Math.hypot(q.x-p.x, q.y-p.y) < TILE*3)) continue;
      pts.push(p);
    }
    if (!pts.length) pts.push(randomWalkableCenter());
    return pts;
  }

  // ---------- Game State / Metrics ----------
  let startedAt = 0, lastTime = 0, playing = false;
  let backstabs = 0;
  let detections = 0;     // set to 1 on game over
  let smokesUsed = 0;
  let noiseIntegral = 0;
  let detectionFill = 0;  // 0..1

  // ---------- FX: Hitstop / Shake / Particles / Trail / Floaters ----------
  let shakeTime = 0, shakeMag = 0;
  let timeScale = 1; // 1 normal, 0 paused (hitstop)
  function addShake(durationMs=200, magnitude=5){ shakeTime = durationMs; shakeMag = magnitude; }
  function hitstop(ms=90){ timeScale = 0; setTimeout(()=> timeScale = 1, ms); }

  const particles = []; // {x,y,vx,vy,a}
  function spawnSlash(x,y,dir){
    for (let i=0;i<12;i++){
      const ang = dir + (Math.random()-0.5)*0.9;
      const spd = 120 + Math.random()*120;
      particles.push({x,y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, a:1});
    }
  }
  function updateParticles(dt){
    for (const p of particles){
      p.x += p.vx*dt; p.y += p.vy*dt;
      p.vx *= 0.92; p.vy *= 0.92;
      p.a -= dt*1.8;
    }
    while (particles.length && particles[0].a<=0) particles.shift();
  }
  function renderParticles(){
    for (const p of particles){
      ctx.globalAlpha = Math.max(0,p.a);
      ctx.fillStyle = '#f0c674';
      ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  const trail = []; // {x,y,a}
  function updateTrail(dt){
    if (keys.has('Shift')) trail.push({x:player.x, y:player.y, a:1});
    for (const t of trail) t.a -= dt*2;
    while (trail.length && trail[0].a <= 0) trail.shift();
  }
  function renderTrail(){
    for (const t of trail){
      ctx.globalAlpha = Math.max(0, t.a)*0.5;
      ctx.beginPath(); ctx.arc(t.x, t.y, player.r*0.9, 0, Math.PI*2);
      ctx.fillStyle = '#7de6c6'; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Floating score texts: {x,y,vy,a,text}
  const floaters = [];
  function spawnFloater(x,y,text,color='#7de6c6'){
    floaters.push({x, y, vy: -60 - Math.random()*40, a: 1, text, color, t: 0});
  }
  function updateFloaters(dt){
    for (const f of floaters){
      f.t += dt;
      f.y += f.vy*dt;
      f.vy *= 0.96;
      f.a -= dt*1.2;
    }
    while (floaters.length && floaters[0].a <= 0) floaters.shift();
  }
  function renderFloaters(){
    for (const f of floaters){
      ctx.globalAlpha = Math.max(0, f.a);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 18px system-ui';
      const wobble = Math.sin(f.t*10)*2;
      ctx.fillText(f.text, f.x + wobble, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Start / End ----------
  function startGame(){
    // reset player
    player.x = TILE*3; player.y = TILE*3; player.noise = 0;
    // reset metrics/state
    backstabs = 0; detections = 0; smokesUsed = 0; noiseIntegral = 0; detectionFill = 0;
    backstabTargetIndex = -1;

    // reset shadows immediately to keep things fresh each run
    shadowSetA = generateShadowBlobs(3);
    shadowSetB = generateShadowBlobs(3);
    shadowTransitioning = false; shadowMix = 0; shadowCycleTimer = 0;

    // start with ONE guard
    const startPos = randomWalkableCenter();
    guards = [ makeGuard(startPos.x, startPos.y) ];

    startedAt = performance.now();
    lastTime = startedAt;
    playing = true;
    loop(performance.now());
  }

  function finishRun(gameOver){
    if (!playing) return;
    playing = false;
    if (gameOver) detections = 1;

    const time_ms = Math.max(1, Math.floor(performance.now() - startedAt));
    const noise_score = Math.max(0, Math.min(100, Math.floor(noiseIntegral / 1000)));
    const difficulty = document.getElementById('diff')?.value || 'normal';

    submitRun({
      level: 'lvl1',
      difficulty,
      time_ms,
      detections,
      backstabs,
      smokes_used: smokesUsed,
      noise_score
    }).then(j=>{
      alert(`${gameOver ? 'Caught! ' : ''}Run saved.\nScore: ${j.score}\nBackstabs: ${backstabs}\nGuards: ${guards.length}`);
      drawTitle();
    }).catch(()=> drawTitle());
  }

  // ---------- Movement with smooth wall edges ----------
  function moveEntity(e, dx, dy, dt){
    e.x += dx * dt;
    e.y += dy * dt;

    const cx = Math.floor(e.x / TILE);
    const cy = Math.floor(e.y / TILE);
    for (let ty = cy-2; ty <= cy+2; ty++){
      for (let tx = cx-2; tx <= cx+2; tx++){
        if (tx<0||ty<0||tx>=COLS||ty>=ROWS) continue;
        if (baseMap[ty][tx] !== 1) continue; // only walls

        const rx = tx*TILE, ry = ty*TILE, rw = TILE, rh = TILE;
        const closestX = clamp(e.x, rx, rx+rw);
        const closestY = clamp(e.y, ry, ry+rh);

        const dx2 = e.x - closestX;
        const dy2 = e.y - closestY;
        const dist2 = Math.hypot(dx2, dy2);

        if (dist2 < e.r) {
          const overlap = e.r - dist2 + 0.5; // epsilon
          const nx = (dist2 === 0) ? 1 : dx2 / dist2;
          const ny = (dist2 === 0) ? 0 : dy2 / dist2;
          e.x += nx * overlap;
          e.y += ny * overlap;
        }
      }
    }
  }
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const normalizeAngle = a => (a + Math.PI*3) % (Math.PI*2) - Math.PI;

  // ---------- Guard Updates ----------
  function updateGuard(g, dt){
    if (g.linger > 0) { g.linger -= dt; return; }
    const target = g.patrol[g.idx];
    const vx = target.x - g.x;
    const vy = target.y - g.y;
    const dist = Math.hypot(vx, vy);
    if (dist < 8) {
      g.idx = (g.idx + 1) % g.patrol.length;
      if (g.idx === 0) g.patrol = randomPatrol(5); // new route each lap
      g.linger = 0.4 + Math.random()*0.6;
      return;
    }
    const ux = vx / dist, uy = vy / dist;
    g.dir = Math.atan2(uy, ux);
    moveEntity(g, ux*g.speed, uy*g.speed, dt);
    if (g.alerted > 0) g.alerted -= dt*60;
  }

  function updateGuards(dt){
    for (const g of guards) updateGuard(g, dt);
  }

  // ---------- Backstab Target Indicator ----------
  function updateBackstabTarget(){
    backstabTargetIndex = -1;
    let bestDist = 1e9;
    for (let i=0; i<guards.length; i++){
      const g = guards[i];
      const dist = Math.hypot(g.x - player.x, g.y - player.y);
      if (dist > 28) continue;
      const toPlayer = Math.atan2(player.y - g.y, player.x - g.x);
      const da = Math.abs(normalizeAngle(toPlayer - g.dir));
      const behind = da > (140 * Math.PI/180);
      if (!behind) continue;
      if (dist < bestDist){ bestDist = dist; backstabTargetIndex = i; }
    }
  }

  function renderBackstabIndicator(){
    if (backstabTargetIndex < 0) return;
    const g = guards[backstabTargetIndex];
    const pulse = (Math.sin(performance.now()/120)+1)/2; // 0..1
    ctx.save();
    // Pulsing ring
    ctx.strokeStyle = `rgba(125,230,198,${0.4 + 0.4*pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6,4]);
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r + 10 + pulse*4, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);

    // "E" prompt floating
    ctx.globalAlpha = 0.8 + 0.2*pulse;
    ctx.fillStyle = '#7de6c6';
    ctx.font = 'bold 18px system-ui';
    ctx.fillText('E', g.x - 5, g.y - g.r - 14 - pulse*6);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------- Detection (all guards) ----------
  function handleDetection(dt){
    let exposed = false;
    let heardOnly = false;

    for (const g of guards){
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist > g.range) continue;

      const angToPlayer = Math.atan2(dy, dx);
      const da = normalizeAngle(angToPlayer - g.dir);
      const inCone = Math.abs(da) <= g.fov;
      const lit = !inShadow(player.x, player.y);
      const heard = (player.noise > 35 && dist < 160);

      if ((inCone && lit) || (inCone && heard)) { exposed = true; g.alerted = 15; break; }
      if (heard) heardOnly = true;
    }

    const fillRate  = 0.9; // per second exposed
    const heardRate = 0.5;
    const drainRate = 0.6;

    if (exposed) {
      detectionFill = Math.min(1, detectionFill + fillRate * dt);
    } else if (heardOnly) {
      detectionFill = Math.min(1, detectionFill + heardRate * dt);
    } else {
      detectionFill = Math.max(0, detectionFill - drainRate * dt);
    }

    if (detectionFill >= 1) finishRun(true); // game over
  }

  // ---------- Backstab ----------
  function tryBackstab(){
    if (!playing) return;
    updateBackstabTarget();
    if (backstabTargetIndex === -1) return;

    const g = guards[backstabTargetIndex];

    // FX
    spawnSlash(g.x, g.y, g.dir);
    spawnFloater(g.x - 10, g.y - g.r - 8, '+5', '#7de6c6');
    hitstop(100);
    addShake(200, 5);

    // “Eliminate” the guard → immediately respawn on a fresh route
    g.patrol = randomPatrol(5);
    const p0 = g.patrol[0];
    g.x = p0.x; g.y = p0.y; g.idx = 1; g.alerted = 0; g.linger = 0.5;

    backstabs++;
    detectionFill = Math.max(0, detectionFill - 0.4); // small reward

    // Challenge scaling: total guards = backstabs + 1 (cap)
    const targetCount = Math.min(20, backstabs + 1);
    while (guards.length < targetCount) {
      const pos = randomWalkableCenter();
      guards.push(makeGuard(pos.x, pos.y));
    }
  }

  // ---------- Main Loop ----------
  function loop(now){
    if (!playing) return;
    const dtRaw = Math.min(0.033, (now - lastTime) / 1000);
    const dt = dtRaw * timeScale; // hitstop-aware
    lastTime = now;

    // player move
    let ax = 0, ay = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) ax -= 1;
    if (keys.has('ArrowRight')|| keys.has('d')) ax += 1;
    if (keys.has('ArrowUp')   || keys.has('w')) ay -= 1;
    if (keys.has('ArrowDown') || keys.has('s')) ay += 1;

    const running = keys.has('Shift');
    const speed = running ? player.dashSpeed : player.speed;

    if (ax !== 0 || ay !== 0) {
      const len = Math.hypot(ax, ay);
      ax = (ax/len) * speed;
      ay = (ay/len) * speed;
      moveEntity(player, ax, ay, dt);

      const baseNoise = running ? 24 : 10;
      const noiseMult = inShadow(player.x, player.y) ? 0.5 : 1;
      player.noise = Math.min(100, player.noise + baseNoise * dt * noiseMult);
    } else {
      player.noise = Math.max(0, player.noise - 20*dt);
    }
    noiseIntegral += player.noise * dt * 10;

    updateTrail(dt);
    updateParticles(dt);
    updateGuards(dt);
    updateShadows(dt);
    handleDetection(dt);
    updateBackstabTarget();
    updateFloaters(dt);

    render();
    requestAnimationFrame(loop);
  }

  // ---------- Rendering ----------
  function render(){
    ctx.save();
    if (shakeTime > 0) {
      const dx = (Math.random()*2-1)*shakeMag;
      const dy = (Math.random()*2-1)*shakeMag;
      ctx.translate(dx, dy);
      shakeTime -= 16; // approx/frame
    }

    // 1) Tiles (floor/walls)
    for (let y=0; y<ROWS; y++){
      for (let x=0; x<COLS; x++){
        const t = baseMap[y][x];
        if (t===1){ ctx.fillStyle = '#16182b'; }        // wall
        else { ctx.fillStyle = '#11183a'; }            // floor (lit base)
        ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
      }
    }

    // 2) Dynamic shadows overlay (animated)
    renderShadows();

    // 3) Vision cones (draw after shadows so cones appear on top)
    for (const g of guards) drawVisionCone(g);

    // 4) Particles (above cones)
    renderParticles();

    // 5) Guards (shadows then bodies)
    for (const g of guards){
      drawSoftShadow(g.x, g.y, g.r);
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI*2);
      ctx.fillStyle = g.alerted > 0 ? '#ff5555' : '#f0c674';
      ctx.fill();
    }

    // 6) Backstab indicator (if targetable)
    renderBackstabIndicator();

    // 7) Player (trail -> shadow -> body)
    renderTrail();
    drawSoftShadow(player.x, player.y, player.r);
    drawPlayer();

    // 8) Floating texts
    renderFloaters();

    // 9) HUD
    drawHUD();

    ctx.restore();
  }

  function drawVisionCone(g){
    ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.dir);
    const jitter = Math.sin(performance.now()/600)*0.03;
    const range = g.range * (1 + jitter*0.05);

    const grad = ctx.createRadialGradient(0,0,0, 0,0,range);
    grad.addColorStop(0, 'rgba(255,255,180,0.18)');
    grad.addColorStop(1, 'rgba(255,255,180,0.00)');
    ctx.fillStyle = grad;

    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.arc(0,0, range, -g.fov, g.fov); ctx.closePath(); ctx.fill();

    // bright rim for readability
    ctx.strokeStyle = 'rgba(255,255,220,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0,0, range, -g.fov, g.fov); ctx.stroke();

    ctx.restore();
  }

  function drawSoftShadow(x,y,r){
    const g = ctx.createRadialGradient(x, y + r*0.6, 0, x, y + r*0.6, r*1.6);
    g.addColorStop(0,'rgba(0,0,0,0.25)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y + r*0.6, r*1.6, 0, Math.PI*2); ctx.fill();
  }

  function drawPlayer(){
    const bob = Math.sin(performance.now()/180)*1.5*(keys.size?1:0);
    ctx.beginPath();
    ctx.arc(player.x, player.y + bob, player.r, 0, Math.PI*2);
    ctx.fillStyle = '#7de6c6';
    ctx.fill();
  }

  function drawHUD(){
    // panel
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(14, 14, 480, 140);

    ctx.fillStyle = '#9aa3ff'; ctx.font = '16px system-ui';
    ctx.fillText(`Backstabs:  ${backstabs}`, 24, 38);
    ctx.fillText(`Guards:     ${guards.length}`, 24, 60);
    ctx.fillText(`Noise`, 24, 82);

    // noise bar
    ctx.fillStyle = '#2b2f66'; ctx.fillRect(80, 70, 200, 14);
    ctx.fillStyle = '#7de6c6'; ctx.fillRect(80, 70, 200*(player.noise/100), 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(80, 70, 200, 14);

    // lit/shadow
    ctx.fillStyle = inShadow(player.x, player.y) ? '#7de6c6' : '#ff8f8f';
    ctx.fillText(inShadow(player.x, player.y) ? 'Shadow' : 'Lit', 290, 82);

    // detection bar (with pulse near danger)
    ctx.fillStyle = '#9aa3ff'; ctx.fillText('Detection', 24, 104);
    ctx.fillStyle = '#2b2f66'; ctx.fillRect(100, 92, 240, 14);
    const w = 240 * detectionFill;
    const dangerPulse = Math.max(0, detectionFill - 0.8) / 0.2; // 0..1 when >80%
    const t = (Math.sin(performance.now()/120)+1)/2; // 0..1
    const grd = ctx.createLinearGradient(100,92, 340,92);
    grd.addColorStop(0.0,'#79e6a0');
    grd.addColorStop(0.6,'#f3d36b');
    grd.addColorStop(1.0, dangerPulse>0 ? `rgba(255,60,60,${0.6+0.4*t})` : '#ff6b6b');
    ctx.fillStyle = grd; ctx.fillRect(100, 92, w, 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(100, 92, 240, 14);
  }

  // ---------- Title ----------
  function drawTitle(){
    ctx.fillStyle = '#0a0c18'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#7de6c6'; ctx.font = '48px system-ui';
    ctx.fillText('Stealth Ninja Slasher', 60, 120);
    ctx.fillStyle = '#9aa3ff'; ctx.font = '20px system-ui';
    ctx.fillText('Play → WASD/Arrows, Shift run, E backstab, Enter end run', 60, 170);
  }
  drawTitle();

  document.getElementById('playBtn')?.addEventListener('click', startGame);
})();
