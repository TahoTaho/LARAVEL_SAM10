<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Stealth Ninja Slasher</title>
    <style>
        body { margin: 0; background: #0a0c18; overflow: hidden; }
        .ui {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 10;
        }
        input, select, button {
            padding: 5px 10px;
            margin-right: 5px;
        }
    </style>
</head>
<body>

<div class="ui">
  <input id="nick" placeholder="Nickname" maxlength="16" />
  <select id="diff">
    <option value="easy">easy</option>
    <option value="normal" selected>normal</option>
    <option value="hard">hard</option>
  </select>
  <button id="playBtn">Play</button>
  <button id="registerBtn">Register</button>
  <button id="fakeScoreBtn">Submit Test Score</button>
</div>

<canvas id="game" width="1280" height="720"></canvas>

<!-- Gameplay loop -->
<script src="/game.js"></script>

<!-- Inline UI logic -->
<script>
const API = location.origin;
const ls = window.localStorage;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function drawTitle(){
  ctx.fillStyle = '#0a0c18'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#7de6c6'; ctx.font = '48px system-ui';
  ctx.fillText('Stealth Ninja Slasher', 60, 120);
  ctx.fillStyle = '#9aa3ff'; ctx.font = '20px system-ui';
  ctx.fillText('WASD/Arrows to move • Shift to dash • Space: smoke (coming next)', 60, 170);
}
drawTitle();

async function register(nickname, country = null) {
  const res = await fetch(`${API}/api/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"   // <-- THIS WAS MISSING
    },
    body: JSON.stringify({ nickname, country })
  });

  const j = await res.json();
  if (j.player_id) ls.setItem("player_id", j.player_id);
  return j;
}

async function submitRun(metrics){
  const player_id = ls.getItem('player_id');
  if(!player_id) { alert('Register first'); return; }
  const res = await fetch(`${API}/api/score`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ player_id, ...metrics })
  });
  const j = await res.json();
  alert('Submitted score: ' + j.score);
}

document.getElementById('registerBtn').onclick = async () => {
  const nick = document.getElementById('nick').value.trim();
  if(!nick){ alert('Enter nickname'); return; }
  const j = await register(nick);
  alert('Registered as #' + j.player_id);
};

document.getElementById('fakeScoreBtn').onclick = async () => {
  const difficulty = document.getElementById('diff').value;
  const metrics = {
    level: 'lvl1',
    difficulty,
    time_ms: Math.floor(70000 + Math.random()*30000),
    detections: Math.floor(Math.random()*3),
    backstabs: Math.floor(Math.random()*8),
    smokes_used: Math.floor(Math.random()*4),
    noise_score: Math.floor(Math.random()*100)
  };
  await submitRun(metrics);
};
</script>

</body>
</html>
