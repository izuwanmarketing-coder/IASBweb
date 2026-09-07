(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let cars = [], category = '', limit = 6, loaded = false, failed = false;
  let whatsappNumber = window.IASB_CONFIG?.fallbackWhatsapp || '60192788667';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const media = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
  const whatsapp = message => `https://wa.me/${String(whatsappNumber).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  const money = value => Number(value) >= 10000 ? `RM ${Number(value).toLocaleString('en-MY', {maximumFractionDigits:0})}` : 'Harga atas permintaan';
  const status = value => ({AVAILABLE:'READY STOCK',INCOMING:'INCOMING','PORT KLANG':'DI PELABUHAN','DONE PAID DUTI':'SEDIA DIPROSES',BOOKED:'DITEMPAH',RESERVED:'DITEMPAH',SOLD:'TERJUAL'}[String(value).toUpperCase()] || value || 'SEMAK STATUS');
  const menu = document.querySelector('.menu-toggle');
  const nav = $('navigation');
  function closeMenu() { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }
  menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
  nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menu.focus(); } });
  function applyContact() { document.querySelectorAll('[data-whatsapp]').forEach(link => { link.href = whatsapp('Hai Izuwan, saya ingin berbincang tentang kereta pilihan saya.'); }); }
  applyContact();
  function card(car) {
    const name = [car.brand, car.model].filter(Boolean).join(' ');
    const href = car.id ? `car.html?id=${encodeURIComponent(car.id)}` : 'inventory.html';
    const photo = media(car.image_url || car.gallery_urls?.[0]);
    const specs = [car.year, Number(car.mileage) > 0 ? `${Number(car.mileage).toLocaleString('en-MY')} km` : '', car.grade ? `Grade ${car.grade}` : ''].filter(Boolean);
    return `<article class="drive-card"><a class="drive-image" href="${href}" aria-label="Lihat ${safe(name)}">${photo ? `<img src="${safe(photo)}" alt="${safe(name)}" loading="lazy">` : `<span class="no-photo"><b>${safe(car.brand || 'IZUWAN')}</b>Gambar akan datang</span>`}<span class="stock-label">${safe(status(car.status))}</span><span class="card-arrow" aria-hidden="true">↗</span></a><div class="drive-info"><p class="car-meta">${safe(car.type || 'JAPAN RECOND')} / ${safe(car.location || 'IZUWAN AUTOMOBILE')}</p><h3><a href="${href}">${safe(name)}</a></h3><div class="drive-specs">${specs.map(spec => `<span>${safe(spec)}</span>`).join('') || '<span>Spesifikasi tersedia melalui advisor</span>'}</div><div class="drive-price"><strong>${money(car.price)}</strong><a href="${safe(whatsapp(`Hai, saya berminat dengan ${name}${car.year ? ` (${car.year})` : ''}${car.id ? `, unit ${car.id}` : ''}. Masih available?`))}" target="_blank" rel="noopener">Enquire ↗</a></div></div></article>`;
  }
  function render() {
    if (!loaded) return;
    const term = $('modelSearch').value.trim().toLowerCase();
    const make = $('makeSelect').value;
    const max = Number($('priceSelect').value);
    $('resetFilters').hidden = !(term || make || max || category);
    const filtered = cars.filter(car => (!category || String(car.type).toLowerCase() === category.toLowerCase()) && (!make || car.brand === make) && (!max || (Number(car.price) >= 10000 && Number(car.price) <= max)) && (!term || [car.brand,car.model,car.variant,car.year,car.color].join(' ').toLowerCase().includes(term)));
    $('driveGrid').setAttribute('aria-busy', 'false');
    $('resultCount').textContent = failed ? 'Koleksi belum dapat dimuatkan' : `${filtered.length} pilihan${filtered.length > limit ? ` · ${limit} dipaparkan` : ''}`;
    $('moreCars').hidden = filtered.length <= limit;
    if (!filtered.length) {
      const hasFilters = Boolean(term || make || max || category);
      $('driveGrid').innerHTML = `<div class="empty-state"><h3>${failed ? 'Koleksi belum dapat dimuatkan.' : hasFilters ? 'Belum jumpa yang kena?' : 'Koleksi sedang dikemaskini.'}</h3><p>${hasFilters ? 'Cuba jenama atau bajet lain, atau minta kami cari spesifikasi pilihan anda.' : 'Hubungi advisor untuk semak unit terkini atau cuba muatkan semula koleksi.'}</p>${hasFilters ? '<button class="button dark" type="button" data-reset>Reset carian ↺</button>' : '<button class="button dark" type="button" data-retry>Cuba semula ↻</button>'} <a class="button outline" href="${safe(whatsapp('Hai, boleh bantu cari kereta mengikut bajet dan spesifikasi saya?'))}">Bantu saya cari ↗</a></div>`;
    } else $('driveGrid').innerHTML = filtered.slice(0, limit).map(card).join('');
  }
  function reset() {
    $('finder').reset(); category = ''; limit = 6;
    document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === '')));
    render();
  }
  $('resetFilters').addEventListener('click', reset);
  $('finder').addEventListener('submit', event => { event.preventDefault(); limit = 6; render(); });
  $('modelSearch').addEventListener('input', () => { limit = 6; render(); });
  ['makeSelect','priceSelect'].forEach(id => $(id).addEventListener('change', () => { limit = 6; render(); }));
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
    category = button.dataset.category; limit = 6;
    document.querySelectorAll('[data-category]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    render();
  }));
  $('moreCars').addEventListener('click', () => {
    const firstNew = $('driveGrid').children.length;
    limit += 6; render();
    $('driveGrid').children[firstNew]?.querySelector('a')?.focus({preventScroll:true});
  });
  $('driveGrid').addEventListener('click', event => { if (event.target.closest('[data-reset]')) reset(); if (event.target.closest('[data-retry]')) load(); });
  $('driveGrid').addEventListener('error', event => {
    if (event.target.tagName === 'IMG') { const placeholder = document.createElement('span'); placeholder.className = 'no-photo'; placeholder.textContent = 'Gambar tidak tersedia'; event.target.replaceWith(placeholder); }
  }, true);
  async function load() {
    loaded = false; failed = false;
    $('driveGrid').setAttribute('aria-busy','true');
    $('resultCount').textContent = 'Memuatkan koleksi…';
    try {
      if (!window.IASBData?.configured && !window.IASBData?.sheetConfigured) throw new Error('Data not configured');
      const data = await window.IASBData.loadPublicData();
      cars = [...(data.inventory || [])].sort((a,b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) || Number(Boolean(b.image_url)) - Number(Boolean(a.image_url)));
      if (data.settings?.whatsapp_number) whatsappNumber = data.settings.whatsapp_number;
      applyContact();
      const previousMake = $('makeSelect').value;
      $('makeSelect').innerHTML = '<option value="">Semua jenama</option>' + [...new Set(cars.map(car => car.brand).filter(Boolean))].sort().map(brand => `<option value="${safe(brand)}">${safe(brand)}</option>`).join('');
      if ([...$('makeSelect').options].some(option => option.value === previousMake)) $('makeSelect').value = previousMake;
      const deliveries = (data.deliveries || []).filter(item => item.is_active !== false && media(item.photo_url)).slice(0,3);
      $('handover').hidden = !deliveries.length;
      $('handoverGrid').innerHTML = deliveries.map(item => `<article><img loading="lazy" src="${safe(media(item.photo_url))}" alt="${safe(item.title || 'Serahan pelanggan Izuwan')}"><p>${safe(item.model || item.title || 'Delivered by Izuwan')}</p><small>${safe(item.location || 'Izuwan Automobile')}</small></article>`).join('');
    } catch { cars = []; failed = true; }
    loaded = true; render();
  }
  load();
})();
// Motion remains optional: no hidden content, no continuous JavaScript render loop.
(() => {
  const hero = document.querySelector('.hero');
  const toggle = document.querySelector('.motion-toggle');
  if (!hero || !toggle) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let paused = false, visible = true, frame = 0, pointerX = 0, pointerY = 0;
  const activeAnimations = new Set();
  const motionAllowed = () => !paused && !reduced.matches && !document.hidden;
  function draw() {
    frame = 0;
    if (!motionAllowed() || !visible) return;
    const rect = hero.getBoundingClientRect();
    const scroll = Math.min(hero.offsetHeight, Math.max(0, -rect.top));
    hero.style.setProperty('--hero-x', `${pointerX * 9}px`);
    hero.style.setProperty('--hero-y', `${Math.min(23, scroll * .035) + pointerY * 6}px`);
  }
  function schedule() { if (!frame && visible && motionAllowed()) frame = requestAnimationFrame(draw); }
  function syncMotion() {
    document.body.classList.toggle('motion-paused', !motionAllowed());
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Play animations' : 'Pause animations');
    toggle.querySelector('span').textContent = paused ? '▶' : 'Ⅱ';
    activeAnimations.forEach(animation => {
      if (reduced.matches) animation.finish();
      else if (motionAllowed()) animation.play();
      else animation.pause();
    });
    if (!motionAllowed()) {
      cancelAnimationFrame(frame); frame = 0;
      hero.style.removeProperty('--hero-x'); hero.style.removeProperty('--hero-y');
    } else schedule();
  }
  toggle.addEventListener('click', () => { paused = !paused; syncMotion(); });
  reduced.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('scroll', schedule, {passive:true});
  hero.addEventListener('pointermove', event => {
    if (!finePointer.matches || !motionAllowed()) return;
    const rect = hero.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - .5;
    pointerY = (event.clientY - rect.top) / rect.height - .5;
    schedule();
  }, {passive:true});
  hero.addEventListener('pointerleave', () => { pointerX = pointerY = 0; schedule(); });
  if ('IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      document.body.classList.toggle('hero-out', !visible);
      if (visible) schedule();
    });
    heroObserver.observe(hero);
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        sectionObserver.unobserve(entry.target);
        if (!motionAllowed()) return;
        const animation = entry.target.animate([
          {opacity:0, transform:'translateY(24px)'},
          {opacity:1, transform:'translateY(0)'}
        ], {duration:750, easing:'cubic-bezier(.16,1,.3,1)'});
        activeAnimations.add(animation);
        animation.onfinish = () => activeAnimations.delete(animation);
      });
    }, {threshold:.12});
    document.querySelectorAll('.collection-heading,.finder,.select-content,.experience-heading,.experience-grid article,.handover h2,.visit>div').forEach(element => sectionObserver.observe(element));
  }
  syncMotion();
})();
// Depth-based light trails, capped at 30 fps and suspended outside the hero.
(() => {
  const canvas = document.querySelector('.velocity-canvas');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, frame = 0, last = 0;
  const trails = Array.from({length: matchMedia('(max-width:760px)').matches ? 32 : 68}, () => ({
    angle:Math.random()*Math.PI*2, radius:Math.random(), speed:.07+Math.random()*.11,
    color:Math.random()>.6 ? '255,77,96' : '146,190,255'
  }));
  const allowed = () => !reduced.matches && !document.hidden && !document.body.classList.contains('motion-paused') && !document.body.classList.contains('hero-out');
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width*ratio); canvas.height = Math.round(height*ratio);
    context.setTransform(ratio,0,0,ratio,0,0);
  }
  function draw(now) {
    if (!allowed()) { frame = 0; return; }
    frame = requestAnimationFrame(draw);
    if (now-last<33) return;
    const dt=Math.min((now-last)/1000,.06);last=now;
    context.clearRect(0,0,width,height);
    const cx=width*.71,cy=height*.38,reach=Math.hypot(width,height)*.72;
    for (const trail of trails) {
      trail.radius += dt*trail.speed;
      if(trail.radius>1.05) trail.radius=.05;
      const radius=trail.radius*trail.radius*reach;
      const tail=Math.max(0,radius-(12+trail.radius*100));
      const dx=Math.cos(trail.angle),dy=Math.sin(trail.angle);
      const gradient=context.createLinearGradient(cx+dx*tail,cy+dy*tail,cx+dx*radius,cy+dy*radius);
      gradient.addColorStop(0,`rgba(${trail.color},0)`);
      gradient.addColorStop(1,`rgba(${trail.color},${Math.min(.65,trail.radius*.75)})`);
      context.strokeStyle=gradient;context.lineWidth=.7+trail.radius;
      context.beginPath();context.moveTo(cx+dx*tail,cy+dy*tail);context.lineTo(cx+dx*radius,cy+dy*radius);context.stroke();
    }
  }
  function sync() {
    if (allowed() && !frame) {last=performance.now();frame=requestAnimationFrame(draw);}
    else if(!allowed()){cancelAnimationFrame(frame);frame=0;if(reduced.matches)context.clearRect(0,0,width,height);}
  }
  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  resize();sync();
})();