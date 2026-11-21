// Renders admin-created live events (rain / announcement / banner / maintenance).
// render(events) is called with the server's list of currently active events; it starts new ones and stops ended ones.
(() => {
  const css = document.createElement('style');
  css.textContent = `
  .rz-rain{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:9000}
  .rz-rain img{position:absolute;top:-20vh;height:auto;opacity:.95;will-change:transform;animation:rz-fall linear infinite;user-select:none}
  @keyframes rz-fall{to{transform:translateY(125vh) rotate(var(--rz-spin,360deg))}}
  .rz-bar{position:fixed;top:0;left:0;right:0;z-index:9001;padding:12px 18px;text-align:center;font-weight:800;letter-spacing:.04em;background:linear-gradient(90deg,#6b3cff,#d16bff);color:#fff;box-shadow:0 8px 30px #0008;animation:rz-drop .5s cubic-bezier(.2,.9,.3,1.2) both}
  @keyframes rz-drop{from{transform:translateY(-100%)}}
  .rz-banner{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9001;max-width:min(92vw,720px);border-radius:16px;overflow:hidden;background:#12101c;border:1px solid #6b3cff;box-shadow:0 10px 40px #000a;text-align:center;color:#fff;font-weight:800}
  .rz-banner img{display:block;width:100%;height:auto}.rz-banner span{display:block;padding:12px 16px}
  .rz-maint{position:fixed;inset:0;z-index:9002;display:flex;align-items:center;justify-content:center;background:rgba(6,5,12,.94);color:#fff;font:800 clamp(22px,4vw,40px) system-ui,sans-serif;text-align:center;padding:30px}
  @media (prefers-reduced-motion:reduce){.rz-rain img{animation-duration:16s!important}}`;
  document.head.append(css);

  const running = new Map();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const el = (cls, text) => { const d = document.createElement('div'); d.className = cls; if (text) d.textContent = text; document.body.append(d); return d; };

  function playSound(url) {
    const a = new Audio(url);
    a.play().catch(() => addEventListener('pointerdown', () => a.play().catch(() => {}), { once: true }));
    return a;
  }

  function start(e) {
    const nodes = [];
    let audio;
    // Only play the sound if the event is fresh, so a page reload mid-event doesn't replay it.
    if (e.sound_url && Date.now() - Date.parse(e.starts_at) < 30000) audio = playSound(e.sound_url);
    if (e.event_type === 'rain' && e.image_url) {
      const box = el('rz-rain'); nodes.push(box);
      const count = Math.min(Number(e.payload?.count) || 14, reduce ? 5 : 35);
      for (let i = 0; i < count; i++) {
        const img = document.createElement('img');
        img.referrerPolicy = 'no-referrer'; img.alt = ''; img.draggable = false; img.src = e.image_url;
        img.style.left = rnd(0, 94) + 'vw';
        img.style.width = rnd(28, 84) + 'px';
        img.style.animationDuration = rnd(4, 9) + 's';
        img.style.animationDelay = -rnd(0, 9) + 's';
        img.style.setProperty('--rz-spin', rnd(-540, 540) + 'deg');
        box.append(img);
      }
    } else if (e.event_type === 'announcement') {
      nodes.push(el('rz-bar', e.title));
    } else if (e.event_type === 'banner') {
      const b = el('rz-banner'); nodes.push(b);
      if (e.image_url) { const img = document.createElement('img'); img.referrerPolicy = 'no-referrer'; img.alt = ''; img.src = e.image_url; b.append(img); }
      if (e.title) { const s = document.createElement('span'); s.textContent = e.title; b.append(s); }
    } else if (e.event_type === 'maintenance') {
      nodes.push(el('rz-maint', e.title || 'Back soon.'));
    }
    return { stop() { nodes.forEach((n) => n.remove()); if (audio) audio.pause(); } };
  }

  window.razyLiveEvents = {
    render(events) {
      const now = Date.now();
      const live = new Map((events || []).filter((e) => e.active && Date.parse(e.ends_at) > now).map((e) => [e.id, e]));
      for (const [id, c] of running) if (!live.has(id)) { c.stop(); running.delete(id); }
      for (const [id, e] of live) {
        if (running.has(id)) continue;
        const c = start(e);
        const timer = setTimeout(() => { c.stop(); running.delete(id); }, Math.min(Date.parse(e.ends_at) - now, 2 ** 31 - 1));
        running.set(id, { stop() { clearTimeout(timer); c.stop(); } });
      }
    },
  };
})();
