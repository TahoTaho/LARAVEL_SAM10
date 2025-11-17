<!doctype html><meta charset="utf-8" />
<title>Leaderboard</title>
<style>body{font-family:system-ui;background:#0e0f1a;color:#eee;margin:20px} table{border-collapse:collapse;width:520px} th,td{border:1px solid #333;padding:8px}</style>
<h1>Leaderboard (Global)</h1>
<table id="tbl"><thead><tr><th>#</th><th>Nickname</th><th>Score</th><th>When</th></tr></thead><tbody></tbody></table>
<script>
(async()=>{
  const res = await fetch('/api/leaderboard?range=global&level=lvl1');
  const rows = await res.json();
  const tbody = document.querySelector('#tbl tbody');
  rows.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${r.nickname}</td><td>${r.score}</td><td>${new Date(r.at).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
})();
</script>
