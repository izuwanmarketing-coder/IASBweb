(() => {
  if (!document.body.classList.contains('glass-pages')) return;
  document.body.classList.remove('light');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const svg = '<svg viewBox="0 0 300 300" fill="none"><circle cx="150" cy="150" r="130" stroke="#c2d4ff" stroke-opacity=".4"/><circle cx="150" cy="150" r="112" stroke="#b1c5ff" stroke-width="4" stroke-dasharray="1 10" stroke-opacity=".5"/><g class="glass-orbit"><circle cx="150" cy="150" r="130" stroke="#ff677f" stroke-width="3" stroke-dasharray="220 597"/><circle cx="280" cy="150" r="5" fill="#c1ecff"/></g><path d="M140 150h20M150 140v20" stroke="#ffffff77"/></svg>';
  document.querySelectorAll('.page-hero').forEach(hero => {
    const art = document.createElement('div'); art.className='page-motion-art'; art.setAttribute('aria-hidden','true'); art.innerHTML=svg; hero.append(art);
  });
  const footer=document.querySelector('.site-footer');
  if(footer){const mark=document.createElement('a');mark.className='glass-footer-wordmark';mark.href='index.html';mark.textContent='IZUWAN';footer.prepend(mark);}
  const nav=document.getElementById('siteNav');
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav?.classList.contains('open')){nav.classList.remove('open');const menu=document.getElementById('menuButton');menu?.setAttribute('aria-expanded','false');menu?.focus();}});
  let paused=false;
  try { paused=sessionStorage.getItem('iasb-motion-paused')==='true'; } catch {}
  const control=document.createElement('button'); control.type='button';control.className='page-motion-control';
  document.body.append(control);
  function sync(){document.body.classList.toggle('motion-paused',paused||document.hidden);control.setAttribute('aria-pressed',String(paused));control.setAttribute('aria-label',paused?'Play animations':'Pause animations');control.textContent=paused?'▶ MOTION':'Ⅱ MOTION';}
  control.addEventListener('click',()=>{paused=!paused;try{sessionStorage.setItem('iasb-motion-paused',String(paused));}catch{}sync();});
  document.addEventListener('visibilitychange',sync); sync();
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{entry.target.classList.toggle('page-hero-offscreen',!entry.isIntersecting);}),{threshold:0});document.querySelectorAll('.page-hero').forEach(hero=>observer.observe(hero));}
})();