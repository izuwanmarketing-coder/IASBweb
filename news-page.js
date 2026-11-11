(() => {
  const root = document.querySelector('[data-news-root]');
  if (!root) return;
  const grid = document.getElementById('newsGrid');
  const status = document.getElementById('newsStatus');
  const search = document.getElementById('newsSearch');
  const source = document.getElementById('newsSource');
  const more = document.getElementById('newsMore');
  const retry = document.getElementById('newsRetry');
  const home = Boolean(root.dataset.newsLimit);
  let articles = [], count = 12, note = '', loading = false;
  const date = value => new Date(value).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  function render() {
    const query = (search?.value || '').trim().toLowerCase();
    let matches = articles.filter(item => (!source?.value || item.source === source.value) && `${item.title} ${item.source} ${item.region}`.toLowerCase().includes(query));
    if (home) {
      const seen = new Set();
      const photoFirst = [...matches.filter(item => imageUrl(item)), ...matches.filter(item => !imageUrl(item))];
      const varied = photoFirst.filter(item => { if (seen.has(item.source)) return false; seen.add(item.source); return true; });
      matches = [...varied, ...matches.filter(item => !varied.includes(item))].slice(0, 3);
    }
    const visible = matches.slice(0, home ? 3 : count);
    grid.replaceChildren(...visible.map(item => {
      const card = document.createElement('article'); card.className = 'news-card';
      const media = document.createElement('div'); media.className = 'news-card-media';
      const fallback = document.createElement('div'); fallback.className = 'news-image-fallback'; fallback.setAttribute('aria-hidden', 'true');
      const mark = document.createElement('span'); mark.textContent = 'DUNIA AUTO';
      const brand = document.createElement('strong'); brand.textContent = item.source;
      const caption = document.createElement('small'); caption.textContent = 'GLOBAL NEWSROOM';
      fallback.append(mark, brand, caption); media.append(fallback);
      const photo = imageUrl(item);
      if (photo) {
        const img = document.createElement('img'); img.alt = ''; img.width = 640; img.height = 360; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
        img.addEventListener('load', () => { media.classList.add('has-image'); });
        img.addEventListener('error', () => { img.remove(); media.classList.remove('has-image'); }, { once: true });
        img.src = photo; media.append(img);
      }
      const meta = document.createElement('div'); meta.className = 'news-card-meta';
      const region = document.createElement('span'); region.textContent = item.region;
      const time = document.createElement('time'); time.dateTime = item.publishedAt; time.textContent = date(item.publishedAt);
      meta.append(region, time);
      const heading = document.createElement('h3');
      const link = document.createElement('a'); link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = item.title; link.lang = 'en';
      heading.append(link);
      const footer = document.createElement('div'); footer.className = 'news-card-footer';
      const publisher = document.createElement('strong'); publisher.textContent = item.source;
      const arrow = document.createElement('span'); arrow.textContent = 'Baca sumber ↗'; arrow.setAttribute('aria-hidden', 'true');
      footer.append(publisher, arrow); card.append(media, meta, heading, footer); return card;
    }));
    status.textContent = articles.length ? (matches.length ? `${home ? 'Pilihan daripada newsroom dunia' : `${visible.length} daripada ${matches.length} berita`} · ${note}` : 'Tiada berita sepadan. Cuba kata kunci lain atau reset penapis.') : 'Berita belum dapat dimuatkan. Cuba lagi atau layari sumber rasmi di bawah.';
    if (more) more.hidden = visible.length >= matches.length;
    grid.setAttribute('aria-busy', 'false');
  }
  function imageUrl(item) {
    try { const url = new URL(item.imageUrl); return url.protocol === 'https:' && !url.username && !url.password && ['global.toyota', 'toyotatimes.jp', 'news.mazdausa.com', 'mmx.prnewswire.com'].includes(url.hostname) ? url.href : ''; } catch { return ''; }
  }
  function valid(item) {
    try { const url = new URL(item.url); return url.protocol === 'https:' && ['global.toyota', 'toyotatimes.jp', 'www.stellantis.com', 'news.mazdausa.com'].includes(url.hostname) && typeof item.title === 'string' && Number.isFinite(Date.parse(item.publishedAt)); } catch { return false; }
  }
  async function load() {
    if (loading) return;
    loading = true; retry.hidden = true; grid.setAttribute('aria-busy', 'true'); status.textContent = 'Memuatkan berita dunia…';
    try {
      let data, saved = false;
      try {
        const response = await fetch('/api/automotive-news?schema=images-v1', { signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error('Feed unavailable');
        data = await response.json();
        if (!Array.isArray(data.articles) || !data.articles.some(valid)) throw new Error('Invalid feed');
      } catch {
        const response = await fetch('/news-snapshot.json');
        if (!response.ok) throw new Error('Snapshot unavailable');
        data = await response.json(); saved = true;
      }
      articles = data.articles.filter(valid);
      note = `${saved ? 'Salinan simpanan' : 'Disemak'} ${date(data.fetchedAt)}${data.partial ? ' · Sebahagian sumber belum tersedia' : ''}`;
      retry.hidden = !saved && !data.partial;
      render();
    } catch { articles = []; render(); retry.hidden = false; }
    finally { loading = false; }
  }
  search?.addEventListener('input', () => { count = 12; render(); });
  source?.addEventListener('change', () => { count = 12; render(); });
  document.getElementById('newsReset')?.addEventListener('click', () => { search.value = ''; source.value = ''; count = 12; render(); search.focus(); });
  more?.addEventListener('click', () => { const previous = grid.children.length; count += 12; render(); grid.children[previous]?.querySelector('a')?.focus(); });
  retry.addEventListener('click', load);
  if (home && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); } }, { rootMargin: '400px' }); observer.observe(root);
  } else load();
})();
