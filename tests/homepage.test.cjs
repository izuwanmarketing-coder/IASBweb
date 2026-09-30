const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const homeSource = fs.readFileSync(path.join(root, 'overhaul.js'), 'utf8');
const siteSource = fs.readFileSync(path.join(root, 'site.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

class Element {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.attrs = new Map();
    this.listeners = new Map();
    this.children = [];
    this.classes = new Set();
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.style = { setProperty() {} };
    this.classList = {
      add: (...names) => names.forEach(name => this.classes.add(name)),
      remove: (...names) => names.forEach(name => this.classes.delete(name)),
      contains: name => this.classes.has(name),
      toggle: (name, force) => {
        const present = force === undefined ? !this.classes.has(name) : force;
        present ? this.classes.add(name) : this.classes.delete(name);
        return present;
      }
    };
  }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  removeAttribute(name) { this.attrs.delete(name); }
  addEventListener(name, listener) {
    const list = this.listeners.get(name) || [];
    list.push(listener);
    this.listeners.set(name, list);
  }
  fire(name, target = this) {
    for (const listener of this.listeners.get(name) || []) listener({ target, currentTarget: this, preventDefault() {} });
  }
  querySelectorAll(selector) { return selector === 'button[data-filter]' || selector === 'button' ? this.children : []; }
  querySelector() { return null; }
  closest(selector) {
    return selector === 'button[data-filter]' && this.dataset.filter !== undefined
      || selector === '[data-stock-retry]' && this.dataset.stockRetry !== undefined
      || selector === '[data-stock-reset]' && this.dataset.stockReset !== undefined
      || selector === 'button[data-years]' && this.dataset.years !== undefined ? this : null;
  }
  contains(node) { return this === node || this.children.includes(node); }
  focus() { this.focused = true; }
  prepend() {}
  appendChild(node) { this.children.push(node); }
}

function harness({ load, configured = true, withFinance = false, manualTimers = false, startHome = true } = {}) {
  const ids = Object.fromEntries(['inventoryGrid', 'stockSearch', 'stockFilters', 'stockStatus', 'heroLiveChip', 'handoverGrid', 'handover'].map(id => [id, new Element()]));
  ids.stockFilters.children = ['all', 'MPV', 'SUV', 'Sedan', 'Performance'].map(filter => new Element({ filter }));
  const segment = new Element();
  segment.children = ['5', '7', '9'].map(years => new Element({ years }));
  if (withFinance) {
    for (const id of ['vehiclePrice', 'downpayment', 'interestRate', 'priceOutput', 'depositOutput', 'rateOutput', 'monthlyPayment', 'financeSummary', 'loanWhatsapp']) ids[id] = new Element();
    ids.vehiclePrice.value = '220000';
    ids.downpayment.value = '22000';
    ids.interestRate.value = '3.2';
  }
  const body = new Element();
  const windowEvents = new Map();
  const timers = new Map();
  let timerId = 0;
  let loadCount = 0;
  const rendered = [];
  const document = {
    body,
    getElementById: id => ids[id] || null,
    querySelectorAll: selector => selector === '[data-years]' ? segment.children : [],
    querySelector: selector => {
      if (selector === '.segment-control') return segment;
      // The test document supplies the existing homepage/mobile controls.
      if (selector === '.quick-actions' || selector === '.mobile-action-bar, .mobile-cta') return new Element();
      return null;
    },
    createElement: () => new Element(),
    addEventListener() {}
  };
  const window = {
    IASB_CONFIG: { fallbackWhatsapp: '60192788667' },
    IASBData: {
      configured,
      sheetConfigured: false,
      loadPublicData() { loadCount++; return load ? load(loadCount) : Promise.resolve({ inventory: [] }); }
    },
    IASBCards: {
      money: value => `RM ${Math.round(Number(value) || 0).toLocaleString('en-MY')}`,
      renderCard(car) { rendered.push(car); return `<article class="vehicle-card">${car.id ?? car.model}</article>`; }
    },
    addEventListener(name, listener) {
      const list = windowEvents.get(name) || [];
      list.push(listener);
      windowEvents.set(name, list);
    },
    dispatchEvent(event) { for (const listener of windowEvents.get(event.type) || []) listener(event); },
    setTimeout: manualTimers ? (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; } : setTimeout,
    clearTimeout: manualTimers ? id => timers.delete(id) : clearTimeout,
    matchMedia: () => ({ matches: true }),
    scrollY: 0
  };
  const context = vm.createContext({
    window, document, URL, Intl, console: { warn() {} },
    location: { pathname: '/' },
    sessionStorage: { getItem: () => null },
    MutationObserver: class { observe() {} },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  });
  vm.runInContext(siteSource, context, { filename: 'site.js' });
  const runHome = () => vm.runInContext(homeSource, context, { filename: 'overhaul.js' });
  if (startHome) runHome();
  return {
    ids, window, timers, segment, rendered, runHome,
    get loadCount() { return loadCount; },
    search(value) { ids.stockSearch.value = value; ids.stockSearch.fire('input'); },
    filter(value) { ids.stockFilters.fire('click', ids.stockFilters.children.find(button => button.dataset.filter === value)); },
    reset() { ids.inventoryGrid.fire('click', new Element({ stockReset: '' })); },
    retry() { ids.inventoryGrid.fire('click', new Element({ stockRetry: '' })); }
  };
}

const car = (id, overrides = {}) => ({ id, brand: 'Toyota', model: `Model ${id}`, type: 'MPV', status: 'AVAILABLE', is_active: true, price: 150000 + Number(id || 0), image_url: `https://example.test/${id}.jpg`, ...overrides });
const data = inventory => ({ inventory, inventorySource: 'supabase', settings: {}, deliveries: [] });

test('one shared request serves the shell and homepage, including a late homepage script', async () => {
  const h = harness({ load: () => Promise.resolve(data([car('1')])), startHome: false });
  await flush();
  h.runHome();
  await flush();
  assert.equal(h.loadCount, 1);
  assert.match(h.ids.inventoryGrid.innerHTML, /vehicle-card/);
  assert.equal(h.ids.inventoryGrid.getAttribute('aria-busy'), 'false');
  const first = h.window.IASBSite.loadManagedData();
  assert.equal(first, h.window.IASBSite.loadManagedData());
});

test('default view stays at six photographic units, search reaches all inventory including units without photos', async () => {
  const cars = Array.from({ length: 8 }, (_, i) => car(String(i + 1)));
  cars.unshift(car('plain-featured', { model: 'Rare Crown', image_url: '', is_featured: true }));
  const h = harness({ load: () => Promise.resolve(data(cars)) });
  await flush();
  assert.equal(h.rendered.length, 6);
  assert.ok(h.rendered.every(item => item.image_url));
  assert.equal(h.ids.stockStatus.textContent, '6 daripada 9 pilihan dipaparkan');
  h.search('Rare Crown');
  assert.match(h.ids.inventoryGrid.innerHTML, /plain-featured/);
  assert.equal(h.ids.stockStatus.textContent, '1 pilihan ditemui');
  h.search('Toyota');
  assert.equal((h.ids.inventoryGrid.innerHTML.match(/vehicle-card/g) || []).length, 9);
});

test('search and category filters combine, retain selection, and reset coherently', async () => {
  const cars = [car('mpv', { model: 'Alphard' }), car('suv', { model: 'Harrier', type: 'SUV' }), car('sport', { model: 'GR 86', type: 'Coupe' })];
  const h = harness({ load: () => Promise.resolve(data(cars)) });
  await flush();
  h.filter('SUV');
  assert.match(h.ids.inventoryGrid.innerHTML, />suv</);
  assert.doesNotMatch(h.ids.inventoryGrid.innerHTML, />mpv</);
  h.search('Alphard');
  assert.match(h.ids.inventoryGrid.innerHTML, /data-stock-reset/);
  assert.equal(h.ids.stockFilters.children.find(x => x.dataset.filter === 'SUV').getAttribute('aria-pressed'), 'true');
  h.search('Harrier');
  assert.match(h.ids.inventoryGrid.innerHTML, />suv</);
  h.search('');
  assert.match(h.ids.inventoryGrid.innerHTML, />suv</);
  h.filter('MPV');
  assert.match(h.ids.inventoryGrid.innerHTML, />mpv</);
  h.filter('Performance');
  assert.match(h.ids.inventoryGrid.innerHTML, />sport</);
  h.search('unknown');
  h.reset();
  assert.equal(h.ids.stockSearch.value, '');
  assert.equal(h.ids.stockFilters.children[0].getAttribute('aria-pressed'), 'true');
  assert.ok(h.ids.stockFilters.children.slice(1).every(button => button.getAttribute('aria-pressed') === 'false'));
  assert.equal(h.ids.stockSearch.focused, true);
  assert.equal((h.ids.inventoryGrid.innerHTML.match(/vehicle-card/g) || []).length, 3);
});

test('ready-stock count excludes incoming, sold, reserved, inactive and unknown statuses', async () => {
  const cars = [car('ready', { units: 3 }), car('missing-units'), car('zero', { units: 0 }), car('incoming', { status: 'INCOMING' }), car('sold', { status: 'SOLD' }), car('booked', { status: 'BOOKED' }), car('reserved', { status: 'RESERVED' }), car('port', { status: 'PORT KLANG' }), car('unknown', { status: '' }), car('inactive', { is_active: false, units: 99 })];
  const h = harness({ load: () => Promise.resolve(data(cars)) });
  await flush();
  assert.match(h.ids.heroLiveChip.innerHTML, /<b>4 unit<\/b> ready stock/);
  assert.doesNotMatch(h.ids.inventoryGrid.innerHTML, /inactive/);
});

test('a genuinely empty inventory clears skeletons and displays zero, with no misleading error', async () => {
  const h = harness({ load: () => Promise.resolve(data([])) });
  await flush();
  assert.equal(h.ids.inventoryGrid.getAttribute('aria-busy'), 'false');
  assert.match(h.ids.heroLiveChip.innerHTML, /<b>0 unit<\/b>/);
  assert.match(h.ids.inventoryGrid.innerHTML, /Koleksi sedang dikemaskini/);
  assert.doesNotMatch(h.ids.inventoryGrid.innerHTML, /stock-skeleton|data-stock-retry/);
  assert.equal(h.ids.handover.hidden, true);
});

test('failed load has a retry that reuses one pending request and retains user filters', async () => {
  const retry = deferred();
  const h = harness({ load: n => n === 1 ? Promise.reject(new Error('network failure')) : retry.promise });
  await flush();
  assert.match(h.ids.inventoryGrid.innerHTML, /data-stock-retry/);
  assert.equal(h.ids.inventoryGrid.getAttribute('aria-busy'), 'false');
  assert.doesNotMatch(h.ids.inventoryGrid.innerHTML, /stock-skeleton/);
  assert.equal(h.ids.heroLiveChip.textContent, 'Semakan stok tidak tersedia');
  h.filter('SUV');
  h.search('Harrier');
  h.retry();
  h.retry();
  assert.equal(h.loadCount, 2);
  assert.equal(h.ids.inventoryGrid.getAttribute('aria-busy'), 'true');
  retry.resolve(data([car('suv', { model: 'Harrier', type: 'SUV' }), car('mpv')]));
  await flush();
  assert.equal(h.ids.inventoryGrid.getAttribute('aria-busy'), 'false');
  assert.match(h.ids.inventoryGrid.innerHTML, />suv</);
  assert.doesNotMatch(h.ids.inventoryGrid.innerHTML, />mpv</);
  assert.equal(h.ids.stockSearch.value, 'Harrier');
});

test('a stalled load times out; retry succeeds and a late old response cannot overwrite it', async () => {
  const old = deferred();
  const h = harness({ manualTimers: true, load: n => n === 1 ? old.promise : Promise.resolve(data([car('fresh')])) });
  assert.equal(h.loadCount, 1);
  assert.equal(h.timers.size, 1);
  const timer = [...h.timers.values()][0];
  assert.equal(timer.ms, 15000);
  timer.fn();
  await flush();
  assert.match(h.ids.inventoryGrid.innerHTML, /data-stock-retry/);
  assert.equal(h.timers.size, 0);
  h.retry();
  await flush();
  assert.match(h.ids.inventoryGrid.innerHTML, />fresh</);
  old.resolve(data([car('stale')]));
  await flush();
  assert.match(h.ids.inventoryGrid.innerHTML, />fresh</);
  assert.doesNotMatch(h.ids.inventoryGrid.innerHTML, /stale/);
});

test('unconfigured and unavailable source responses show honest recoverable errors', async () => {
  const unconfigured = harness({ configured: false });
  await flush();
  assert.equal(unconfigured.loadCount, 0);
  assert.match(unconfigured.ids.inventoryGrid.innerHTML, /data-stock-retry/);
  const missing = harness({ load: () => Promise.resolve({ inventory: [], inventorySource: 'none' }) });
  await flush();
  assert.match(missing.ids.inventoryGrid.innerHTML, /data-stock-retry/);
});

test('only real, active delivery images reveal the handover section', async () => {
  const h = harness({ load: () => Promise.resolve({ ...data([]), deliveries: [{ title: 'Real handover', photo_url: 'https://example.test/delivery.jpg' }, { title: 'Inactive', photo_url: 'https://example.test/no.jpg', is_active: false }, { title: 'Invalid', photo_url: 'javascript:alert(1)' }] }) });
  await flush();
  assert.equal(h.ids.handover.hidden, false);
  assert.match(h.ids.handoverGrid.innerHTML, /Real handover/);
  assert.doesNotMatch(h.ids.handoverGrid.innerHTML, /Inactive|Invalid/);
});

test('finance term controls expose current state and preserve the shared finance calculation', async () => {
  const h = harness({ withFinance: true, load: () => Promise.resolve(data([])) });
  await flush();
  assert.equal(h.segment.children[2].getAttribute('aria-pressed'), 'true');
  assert.equal(h.ids.monthlyPayment.textContent, 'RM 2,361');
  h.segment.fire('click', h.segment.children[0]);
  assert.equal(h.segment.children[0].getAttribute('aria-pressed'), 'true');
  assert.equal(h.segment.children[2].getAttribute('aria-pressed'), 'false');
  assert.equal(h.ids.monthlyPayment.textContent, 'RM 3,828');
});

test('forced calls during a pending load share its promise and emit one data event', async () => {
  const pending = deferred();
  const h = harness({ load: () => pending.promise });
  let events = 0;
  h.window.addEventListener('iasb:data', () => { events++; });
  const first = h.window.IASBSite.loadManagedData();
  assert.equal(first, h.window.IASBSite.loadManagedData({ force: true }));
  assert.equal(h.loadCount, 1);
  pending.resolve(data([car('one')]));
  await flush();
  assert.equal(events, 1);
  assert.equal(h.loadCount, 1);
});

test('inventory rows without an id do not collapse into a single featured item', async () => {
  const rows = Array.from({ length: 7 }, (_, i) => car(undefined, { model: `Anonymous ${i}`, image_url: `https://example.test/anonymous-${i}.jpg` }));
  const h = harness({ load: () => Promise.resolve(data(rows)) });
  await flush();
  assert.equal(h.rendered.length, 6);
  h.search('Anonymous');
  assert.equal((h.ids.inventoryGrid.innerHTML.match(/vehicle-card/g) || []).length, 7);
});

test('inactive rows are never searchable and pricelist data is escaped', async () => {
  const h = harness({ load: () => Promise.resolve({ ...data([car('active'), car('hidden', { is_active: false, model: 'Hidden Sedan' })]), settings: { pricelist_date: '<script>alert(1)</script>' } }) });
  await flush();
  assert.match(h.ids.heroLiveChip.innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(h.ids.heroLiveChip.innerHTML, /<script>/);
  h.search('Hidden Sedan');
  assert.match(h.ids.inventoryGrid.innerHTML, /Belum jumpa padanan/);
});

test('search input entered during loading is applied when the response arrives', async () => {
  const pending = deferred();
  const h = harness({ load: () => pending.promise });
  h.filter('SUV');
  h.search('Harrier');
  assert.equal(h.ids.inventoryGrid.getAttribute('aria-busy'), 'true');
  pending.resolve(data([car('mpv'), car('harrier', { model: 'Harrier', type: 'SUV' })]));
  await flush();
  assert.match(h.ids.inventoryGrid.innerHTML, />harrier</);
  assert.doesNotMatch(h.ids.inventoryGrid.innerHTML, />mpv</);
  assert.equal(h.ids.stockFilters.children.find(x => x.dataset.filter === 'SUV').getAttribute('aria-pressed'), 'true');
});
