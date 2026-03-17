const GRID = 20;
const cwEl = document.getElementById('cw');
const gc = document.getElementById('gc');
const mc = document.getElementById('mc');
const gctx = gc.getContext('2d');
const ctx = mc.getContext('2d');

let els = [], hist = [], tool = 'select';
let drawing = false, sx = 0, sy = 0, curX = 0, curY = 0;
let selId = null, dragging = false, dragOX = 0, dragOY = 0;
let zoom = 1, botOpen = true;
let shiftDown = false;
let _id = 1;
const uid = () => _id++;
const snap = v => Math.round(v / GRID) * GRID;
const toW = v => v / zoom;
const toC = v => v * zoom;
const snapM = v => snap(toW(v));
const jit = () => (Math.random() - 0.5) * 0.9;

function resize() {
  const W = cwEl.clientWidth, H = cwEl.clientHeight;
  [gc, mc].forEach(c => { c.width = W; c.height = H; });
  drawGrid(); render();
}
window.addEventListener('resize', resize);

document.addEventListener('DOMContentLoaded', () => {
  resize();
});

function drawGrid() {
  const W = gc.width, H = gc.height, step = GRID * zoom;
  gctx.clearRect(0, 0, W, H);
  gctx.strokeStyle = 'rgba(0,0,0,0.038)';
  gctx.lineWidth = 1;
  for (let x = 0; x < W; x += step) { gctx.beginPath(); gctx.moveTo(x, 0); gctx.lineTo(x, H); gctx.stroke(); }
  for (let y = 0; y < H; y += step) { gctx.beginPath(); gctx.moveTo(0, y); gctx.lineTo(W, y); gctx.stroke(); }
}

function zoomIn()  { zoom = Math.min(4, +(zoom + 0.25).toFixed(2)); applyZoom(); }
function zoomOut() { zoom = Math.max(0.25, +(zoom - 0.25).toFixed(2)); applyZoom(); }
function zoomReset() { zoom = 1; applyZoom(); }
function applyZoom() {
  document.getElementById('zoom-lbl').textContent = Math.round(zoom * 100) + '%';
  drawGrid(); render();
}
cwEl.addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.deltaY < 0 ? zoomIn() : zoomOut(); }
}, { passive: false });

function drawEl(el, sel) {
  ctx.save();
  const ink = sel ? '#3b5bdb' : '#1a1a18';
  const lw = sel ? 2 : 1.6;

  if (el.type === 'rect') {
    ctx.strokeStyle = ink; ctx.lineWidth = lw;
    ctx.fillStyle = 'rgba(255,255,255,0.48)';
    ctx.beginPath();
    ctx.moveTo(el.x + jit(), el.y + jit());
    ctx.lineTo(el.x + el.w + jit(), el.y + jit());
    ctx.lineTo(el.x + el.w + jit(), el.y + el.h + jit());
    ctx.lineTo(el.x + jit(), el.y + el.h + jit());
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (el.label) {
      ctx.fillStyle = ink; ctx.font = '500 12.5px Geist,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.label, el.x + el.w / 2, el.y + el.h / 2);
    }
    if (sel) drawHandles(el.x, el.y, el.w, el.h);
  }

  else if (el.type === 'placeholder') {
    ctx.strokeStyle = sel ? '#3b5bdb' : '#9a9a92';
    ctx.lineWidth = 1.4; ctx.setLineDash([5, 3.5]);
    ctx.fillStyle = 'rgba(0,0,0,0.012)';
    ctx.beginPath();
    ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + el.w, el.y);
    ctx.lineTo(el.x + el.w, el.y + el.h); ctx.lineTo(el.x, el.y + el.h);
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = sel ? 'rgba(59,91,219,0.18)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + el.w, el.y + el.h);
    ctx.moveTo(el.x + el.w, el.y); ctx.lineTo(el.x, el.y + el.h);
    ctx.stroke();
    ctx.fillStyle = sel ? '#3b5bdb' : '#8a8a82';
    ctx.font = '12px Geist,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('< ' + (el.label || '?') + ' >', el.x + el.w / 2, el.y + el.h / 2);
    if (sel) drawHandles(el.x, el.y, el.w, el.h);
  }

  else if (el.type === 'arrow') {
    ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.setLineDash([]);
    const { x1, y1, x2, y2, dir } = el;
    const mx = dir === 'h' ? x2 : x1, my = dir === 'h' ? y1 : y2;
    ctx.beginPath();
    ctx.moveTo(x1 + jit(), y1 + jit());
    ctx.lineTo(mx + jit(), my + jit());
    if (x2 !== mx || y2 !== my) ctx.lineTo(x2 + jit(), y2 + jit());
    ctx.stroke();
    let angle;
    if (x2 === mx) angle = y2 > my ? Math.PI / 2 : -Math.PI / 2;
    else angle = x2 > mx ? 0 : Math.PI;
    const hw = 9, ha = 0.44;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - hw * Math.cos(angle - ha), y2 - hw * Math.sin(angle - ha));
    ctx.lineTo(x2 - hw * Math.cos(angle + ha), y2 - hw * Math.sin(angle + ha));
    ctx.closePath(); ctx.fillStyle = ink; ctx.fill();
    if (el.label) {
      ctx.fillStyle = sel ? '#3b5bdb' : '#666';
      ctx.font = '11.5px Geist,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(el.label, (x1 + x2) / 2, (y1 + y2) / 2 - 4);
    }
    if (sel) { [[x1,y1],[x2,y2]].forEach(([hx,hy]) => endHandle(hx, hy)); }
  }

  else if (el.type === 'line') {
    ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(el.x1 + jit(), el.y1 + jit());
    ctx.lineTo(el.x2 + jit(), el.y2 + jit());
    ctx.stroke();
    if (sel) { [[el.x1,el.y1],[el.x2,el.y2]].forEach(([hx,hy]) => endHandle(hx, hy)); }
  }

  else if (el.type === 'text') {
    ctx.font = '12.5px Geist,sans-serif';
    ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(el.label || '...', el.x, el.y + 2);
    if (sel) {
      const m = ctx.measureText(el.label || '...');
      ctx.strokeStyle = 'rgba(59,91,219,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
      ctx.strokeRect(el.x - 3, el.y - 1, m.width + 6, 20); ctx.setLineDash([]);
    }
  }

  ctx.restore();
}

function drawHandles(x, y, w, h) {
  ctx.strokeStyle = 'rgba(59,91,219,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 8); ctx.setLineDash([]);
  [[x-4,y-4],[x+w+4,y-4],[x-4,y+h+4],[x+w+4,y+h+4]].forEach(([hx,hy]) => endHandle(hx, hy));
}
function endHandle(hx, hy) {
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3b5bdb'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function render() {
  ctx.clearRect(0, 0, mc.width, mc.height);
  ctx.save();
  ctx.scale(zoom, zoom);
  els.forEach(el => drawEl(el, el.id === selId));

  if (drawing) {
    ctx.save();
    const lw = 1.5 / zoom;
    if (tool === 'rect') {
      const x = Math.min(sx, curX), y = Math.min(sy, curY);
      const w = Math.abs(curX - sx), h = Math.abs(curY - sy);
      ctx.strokeStyle = '#3b5bdb'; ctx.lineWidth = lw; ctx.setLineDash([4, 3]);
      ctx.fillStyle = 'rgba(59,91,219,0.04)';
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    } else if (tool === 'placeholder') {
      const x = Math.min(sx, curX), y = Math.min(sy, curY);
      const w = Math.abs(curX - sx), h = Math.abs(curY - sy);
      ctx.strokeStyle = '#9a9a92'; ctx.lineWidth = lw; ctx.setLineDash([5, 3.5]);
      ctx.fillStyle = 'rgba(0,0,0,0.015)';
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    } else if (tool === 'arrow') {
      const goH = Math.abs(curX - sx) >= Math.abs(curY - sy);
      ctx.strokeStyle = '#3b5bdb'; ctx.lineWidth = lw; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(sx, sy);
      if (goH) { ctx.lineTo(curX, sy); if (curY !== sy) ctx.lineTo(curX, curY); }
      else { ctx.lineTo(sx, curY); if (curX !== sx) ctx.lineTo(curX, curY); }
      ctx.stroke(); ctx.setLineDash([]);
    } else if (tool === 'line') {
      let lx2 = curX, ly2 = curY;
      if (shiftDown) { if (Math.abs(curX-sx) > Math.abs(curY-sy)) ly2 = sy; else lx2 = sx; }
      ctx.strokeStyle = '#3b5bdb'; ctx.lineWidth = lw; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(lx2, ly2);
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }
  ctx.restore();
  generateAscii();
  saveToStorage();
}

function setTool(t) {
  tool = t;
  document.querySelectorAll('.tool').forEach(b => b.classList.remove('on'));
  const btn = document.getElementById('tool-' + t);
  if (btn) btn.classList.add('on');
  mc.style.cursor = t === 'select' ? 'default' : 'crosshair';
  selId = null; hideProp(); render();
}

mc.addEventListener('mousedown', e => {
  const wx = snapM(e.offsetX), wy = snapM(e.offsetY);

  if (tool === 'select') {
    const hit = hitTest(e.offsetX, e.offsetY);
    if (hit) {
      selId = hit.id; dragging = true;
      const isLine = hit.type === 'arrow' || hit.type === 'line';
      dragOX = toW(e.offsetX) - (isLine ? hit.x1 : hit.x);
      dragOY = toW(e.offsetY) - (isLine ? hit.y1 : hit.y);
      showProp(hit);
    } else { selId = null; hideProp(); }
    render(); return;
  }

  if (tool === 'text') { showTI(e.offsetX, e.offsetY, null); return; }

  drawing = true; sx = wx; sy = wy; curX = wx; curY = wy;
});

mc.addEventListener('mousemove', e => {
  curX = snapM(e.offsetX); curY = snapM(e.offsetY);
  shiftDown = e.shiftKey;

  if (dragging && selId !== null) {
    const el = els.find(item => item.id === selId); if (!el) return;
    const wx = snap(toW(e.offsetX) - dragOX);
    const wy = snap(toW(e.offsetY) - dragOY);
    if (el.type === 'arrow' || el.type === 'line') {
      const dx = wx - el.x1, dy = wy - el.y1;
      el.x1 = wx; el.y1 = wy; el.x2 = snap(el.x2 + dx); el.y2 = snap(el.y2 + dy);
      dragOX = toW(e.offsetX) - el.x1; dragOY = toW(e.offsetY) - el.y1;
    } else { el.x = wx; el.y = wy; }
    showProp(el); render(); return;
  }

  if (drawing) render();
});

mc.addEventListener('mouseup', e => {
  if (dragging) { dragging = false; saveHist(); return; }
  if (!drawing) return;
  drawing = false;
  const x2 = snapM(e.offsetX), y2 = snapM(e.offsetY);
  const x = Math.min(sx, x2), y = Math.min(sy, y2);
  const w = Math.abs(x2 - sx), h = Math.abs(y2 - sy);

  if ((tool === 'rect' || tool === 'placeholder') && w >= GRID && h >= GRID) {
    saveHist();
    const newEl = { id: uid(), type: tool, x, y, w, h, label: tool === 'placeholder' ? 'placeholder' : '' };
    els.push(newEl);
    render();
    if (tool === 'placeholder') {
      selId = newEl.id;
      showTI(toC(x + w / 2) - 50, toC(y + h / 2) - 14, newEl);
    }
  } else if (tool === 'arrow' && (Math.abs(x2-sx) > 5 || Math.abs(y2-sy) > 5)) {
    saveHist();
    const goH = Math.abs(x2 - sx) >= Math.abs(y2 - sy);
    els.push({ id: uid(), type: 'arrow', x1: sx, y1: sy, x2, y2, dir: goH ? 'h' : 'v', label: '' });
    render();
  } else if (tool === 'line' && (Math.abs(x2-sx) > 5 || Math.abs(y2-sy) > 5)) {
    saveHist();
    let lx2 = x2, ly2 = y2;
    if (e.shiftKey) { if (Math.abs(x2-sx) > Math.abs(y2-sy)) ly2 = sy; else lx2 = sx; }
    els.push({ id: uid(), type: 'line', x1: sx, y1: sy, x2: lx2, y2: ly2 });
    render();
  }
});

mc.addEventListener('dblclick', e => {
  const hit = hitTest(e.offsetX, e.offsetY);
  if (!hit) return;
  const isLine = hit.type === 'arrow' || hit.type === 'line';
  const cx = isLine ? toC((hit.x1 + hit.x2) / 2) : toC(hit.x + (hit.w || 0) / 2);
  const cy = isLine ? toC((hit.y1 + hit.y2) / 2) : toC(hit.y + (hit.h || 0) / 2);
  showTI(cx - 50, cy - 14, hit);
});

function hitTest(mx, my) {
  const wx = toW(mx), wy = toW(my);
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el.type === 'rect' || el.type === 'placeholder') {
      if (wx >= el.x && wx <= el.x + el.w && wy >= el.y && wy <= el.y + el.h) return el;
    } else if (el.type === 'arrow') {
      const mx2 = el.dir === 'h' ? el.x2 : el.x1, my2 = el.dir === 'h' ? el.y1 : el.y2;
      if (segD(wx,wy,el.x1,el.y1,mx2,my2) < 9/zoom || segD(wx,wy,mx2,my2,el.x2,el.y2) < 9/zoom) return el;
    } else if (el.type === 'line') {
      if (segD(wx, wy, el.x1, el.y1, el.x2, el.y2) < 9/zoom) return el;
    } else if (el.type === 'text') {
      ctx.save(); ctx.font = '12.5px Geist,sans-serif';
      const m = ctx.measureText(el.label || '...'); ctx.restore();
      if (wx >= el.x && wx <= el.x + m.width && wy >= el.y && wy <= el.y + 18) return el;
    }
  }
  return null;
}
function segD(px, py, x1, y1, x2, y2) {
  const dx = x2-x1, dy = y2-y1, l2 = dx*dx+dy*dy;
  if (l2 === 0) return Math.hypot(px-x1, py-y1);
  let t = ((px-x1)*dx + (py-y1)*dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px-(x1+t*dx), py-(y1+t*dy));
}

function showTI(canvasX, canvasY, el) {
  const ov = document.getElementById('tio'), f = document.getElementById('tif');
  ov.style.display = 'block';
  ov.style.left = canvasX + 'px';
  ov.style.top = canvasY + 'px';
  f.value = el ? (el.label || '') : '';
  setTimeout(() => { f.focus(); f.select(); }, 10);

  const commit = () => {
    const val = f.value.trim();
    ov.style.display = 'none';
    if (el) {
      el.label = val;
    } else if (val && tool === 'text') {
      saveHist();
      els.push({ id: uid(), type: 'text', x: snap(toW(canvasX)), y: snap(toW(canvasY)), label: val });
    }
    render();
  };
  f.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); commit(); } };
  f.onblur = commit;
}

function showProp(el) {
  const p = document.getElementById('props'); p.style.display = 'block';
  document.getElementById('pi-label').value = el.label || '';
  const isLine = el.type === 'arrow' || el.type === 'line';
  document.getElementById('pi-x').value = isLine ? el.x1 : (el.x || 0);
  document.getElementById('pi-y').value = isLine ? el.y1 : (el.y || 0);
  document.getElementById('pi-w').value = isLine ? el.x2 - el.x1 : (el.w || 0);
  document.getElementById('pi-h').value = isLine ? el.y2 - el.y1 : (el.h || 0);
  const noSize = el.type === 'text';
  document.getElementById('pr-w').style.display = noSize ? 'none' : 'flex';
  document.getElementById('pr-h').style.display = noSize ? 'none' : 'flex';
}
function hideProp() { document.getElementById('props').style.display = 'none'; }
function upLabel(v) { const el = els.find(item => item.id === selId); if (el) { el.label = v; render(); } }
function upPos() {
  const el = els.find(item => item.id === selId); if (!el) return;
  const x = +document.getElementById('pi-x').value || 0;
  const y = +document.getElementById('pi-y').value || 0;
  if (el.type === 'arrow' || el.type === 'line') { el.x2 += x - el.x1; el.y2 += y - el.y1; el.x1 = x; el.y1 = y; }
  else { el.x = x; el.y = y; }
  render();
}
function upSize() {
  const el = els.find(item => item.id === selId); if (!el) return;
  const w = +document.getElementById('pi-w').value || GRID;
  const h = +document.getElementById('pi-h').value || GRID;
  if (el.type === 'arrow' || el.type === 'line') { el.x2 = el.x1 + w; el.y2 = el.y1 + h; }
  else { el.w = w; el.h = h; }
  render();
}
function delSel() { els = els.filter(e => e.id !== selId); selId = null; hideProp(); render(); }

function generateAscii() {
  if (els.length === 0) { document.getElementById('aout').value = ''; return; }
  const SX = GRID / 2, SY = GRID;
  const tc = x => Math.floor(x / SX);
  const tr = y => Math.floor(y / SY);

  let maxC = 20, maxR = 10;
  els.forEach(el => {
    if (el.type === 'rect' || el.type === 'placeholder') {
      maxC = Math.max(maxC, tc(el.x + el.w) + 4);
      maxR = Math.max(maxR, tr(el.y + el.h) + 3);
    } else if (el.type === 'arrow' || el.type === 'line') {
      maxC = Math.max(maxC, tc(Math.max(el.x1, el.x2)) + 4);
      maxR = Math.max(maxR, tr(Math.max(el.y1, el.y2)) + 3);
    } else if (el.type === 'text') {
      maxC = Math.max(maxC, tc(el.x) + (el.label || '').length + 4);
      maxR = Math.max(maxR, tr(el.y) + 3);
    }
  });

  const COLS = maxC, ROWS = maxR;
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(' '));
  const sc = (r, c, ch) => { if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r][c] = ch; };
  const st = (r, c, txt) => { for (let i = 0; i < txt.length; i++) sc(r, c + i, txt[i]); };

  els.filter(e => e.type === 'rect' || e.type === 'placeholder').forEach(el => {
    const c1 = tc(el.x), r1 = tr(el.y), c2 = tc(el.x + el.w), r2 = tr(el.y + el.h);
    const cw = c2 - c1, ch = r2 - r1;
    if (cw < 2 || ch < 2) return;
    sc(r1, c1, '┌'); sc(r1, c2, '┐'); sc(r2, c1, '└'); sc(r2, c2, '┘');
    for (let c = c1+1; c < c2; c++) { sc(r1, c, '─'); sc(r2, c, '─'); }
    for (let r = r1+1; r < r2; r++) { sc(r, c1, '│'); sc(r, c2, '│'); }
    if (el.type === 'placeholder') {
      for (let r = r1+1; r < r2; r++) for (let c = c1+1; c < c2; c++) sc(r, c, '·');
      const lbl = '< ' + (el.label || '?') + ' >';
      const lc = Math.max(c1+1, Math.floor((c1+c2)/2 - Math.floor(lbl.length/2)));
      st(Math.floor((r1+r2)/2), lc, lbl);
    } else if (el.label) {
      const lbl = el.label.length > cw-2 ? el.label.slice(0, cw-3) + '…' : el.label;
      const lc = Math.max(c1+1, Math.floor((c1+c2)/2 - Math.floor(lbl.length/2)));
      st(Math.floor((r1+r2)/2), lc, lbl);
    }
  });

  els.filter(e => e.type === 'text').forEach(el => st(tr(el.y), tc(el.x), el.label || ''));

  els.filter(e => e.type === 'arrow').forEach(el => {
    const c1=tc(el.x1), r1=tr(el.y1), c2=tc(el.x2), r2=tr(el.y2);
    const goH = el.dir === 'h';
    if (goH) {
      const s = c2>c1?1:-1; for (let c=c1; c!==c2; c+=s) sc(r1, c, '─');
      if (r2===r1) { sc(r1, c2, c2>c1?'→':'←'); }
      else {
        sc(r1, c2, c2>c1?(r2>r1?'┐':'┘'):(r2>r1?'┌':'└'));
        const vs=r2>r1?1:-1; for (let r=r1+vs; r!==r2; r+=vs) sc(r, c2, '│');
        sc(r2, c2, r2>r1?'↓':'↑');
      }
    } else {
      const s=r2>r1?1:-1; for (let r=r1; r!==r2; r+=s) sc(r, c1, '│');
      if (c2===c1) { sc(r2, c1, r2>r1?'↓':'↑'); }
      else {
        sc(r2, c1, r2>r1?(c2>c1?'└':'┘'):(c2>c1?'┌':'┐'));
        const hs=c2>c1?1:-1; for (let c=c1+hs; c!==c2; c+=hs) sc(r2, c, '─');
        sc(r2, c2, c2>c1?'→':'←');
      }
    }
    if (el.label) {
      const lc = Math.max(0, Math.floor((tc(el.x1)+tc(el.x2))/2 - Math.floor(el.label.length/2)));
      st(Math.floor((tr(el.y1)+tr(el.y2))/2), lc, el.label);
    }
  });

  els.filter(e => e.type === 'line').forEach(el => {
    const c1=tc(el.x1), r1=tr(el.y1), c2=tc(el.x2), r2=tr(el.y2);
    const dx=c2-c1, dy=r2-r1;
    if (dy === 0) {
      const s=c2>c1?1:-1; for (let c=c1; c!==c2+s; c+=s) sc(r1, c, '─');
    } else if (dx === 0) {
      const s=r2>r1?1:-1; for (let r=r1; r!==r2+s; r+=s) sc(r, c1, '│');
    } else {
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      const ch = dx * dy > 0 ? '\\' : '/';
      for (let i=0; i<=steps; i++) {
        sc(Math.round(r1+dy*i/steps), Math.round(c1+dx*i/steps), ch);
      }
    }
  });

  const lines = grid.map(r => r.join('').trimEnd());
  let last = lines.length - 1;
  while (last > 0 && !lines[last].trim()) last--;
  document.getElementById('aout').value = lines.slice(0, last+1).join('\n');
}

function saveToStorage() {
  try { localStorage.setItem('wf_els', JSON.stringify(els)); } catch(e) {}
}
function loadFromStorage() {
  try {
    const raw = localStorage.getItem('wf_els');
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length > 0) { els = p; return true; } }
  } catch(e) {}
  return false;
}

function saveHist() { hist.push(JSON.parse(JSON.stringify(els))); if (hist.length > 60) hist.shift(); }
function undo() { if (hist.length) { els = hist.pop(); selId = null; hideProp(); render(); } }
function newDoc() {
  if (!confirm('Start a new document?')) return;
  saveHist(); els = []; selId = null; hideProp();
  try { localStorage.removeItem('wf_els'); } catch(e) {}
  render();
}

function copyAscii() {
  const txt = document.getElementById('aout').value;
  if (!txt) return;
  navigator.clipboard.writeText(txt).then(() => snack('ASCII copied!'));
}
function copyForAI() {
  const txt = document.getElementById('aout').value;
  if (!txt) return;
  navigator.clipboard.writeText('Here is a UI wireframe in ASCII. Use it as the layout reference:\n\n```\n' + txt + '\n```').then(() => snack('Copied for AI!'));
}
function snack(msg) {
  const s = document.getElementById('snack'); s.textContent = msg; s.classList.add('on');
  setTimeout(() => s.classList.remove('on'), 1800);
}

function toggleBot() {
  botOpen = !botOpen;
  document.getElementById('bot').classList.toggle('col', !botOpen);
  document.getElementById('bot-tog').textContent = botOpen ? 'collapse ▾' : 'expand ▴';
}

(() => {
  const handle = document.getElementById('bot-resize');
  const panel = document.getElementById('bot');
  let resizing = false, startY = 0, startH = 0;
  handle.addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    resizing = true; startY = e.clientY; startH = panel.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', e => {
    if (!resizing) return;
    const newH = Math.max(36, Math.min(600, startH + (startY - e.clientY)));
    panel.style.height = newH + 'px';
    if (newH > 36 && panel.classList.contains('col')) {
      panel.classList.remove('col');
      document.getElementById('bot-tog').textContent = 'collapse ▾';
      botOpen = true;
    }
  });
  document.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();

function toggleHelp() { document.getElementById('help-modal').classList.toggle('on'); }
document.getElementById('help-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('help-modal')) toggleHelp();
});

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  shiftDown = e.shiftKey;
  if (e.key === 'v' || e.key === 'V') setTool('select');
  if (e.key === 'r' || e.key === 'R') setTool('rect');
  if (e.key === 'p' || e.key === 'P') setTool('placeholder');
  if (e.key === 'a' || e.key === 'A') setTool('arrow');
  if (e.key === 'l' || e.key === 'L') setTool('line');
  if (e.key === 't' || e.key === 'T') setTool('text');
  if (e.key === '?') toggleHelp();
  if (e.key === '+' || e.key === '=') zoomIn();
  if (e.key === '-') zoomOut();
  if (e.key === '0') zoomReset();
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selId) { e.preventDefault(); delSel(); }
  if (e.key === 'Escape') {
    selId = null; hideProp();
    document.getElementById('help-modal').classList.remove('on');
    render();
  }
});
document.addEventListener('keyup', e => { shiftDown = e.shiftKey; });

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!loadFromStorage()) render(); else render();
  }, 50);
});
