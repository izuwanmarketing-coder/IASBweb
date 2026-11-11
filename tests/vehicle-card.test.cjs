const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const cardScript = fs.readFileSync(path.join(root, 'vehicle-card.js'), 'utf8');
const inventoryScript = fs.readFileSync(path.join(root, 'inventory-page.js'), 'utf8');

function createCards() {
  const window = {
    IASBSite: {
      whatsappUrl: message => `https://wa.me/60192788667?text=${encodeURIComponent(message)}`,
      monthlyEstimate: value => Math.round(Number(value) / 100),
      financeAssumptions: () => ({ depositPct: 10, years: 9, rate: 3.2 }),
      statusLabel: value => value
    }
  };
  const context = vm.createContext({ window });
  vm.runInContext(cardScript, context);
  return { window, cards: window.IASBCards };
}

const vehicle = changes => ({
  id: 'unit-1', brand: 'Toyota', model: 'Alphard', variant: '2.5 SC Package',
  year: 2022, mileage: 23450, grade: '4.5', price: 189000, status: 'READY STOCK',
  type: 'MPV', location: 'Gombak', is_active: true, ...changes
});

test('unconfirmed prices never imply incoming stock or produce a loan calculator', () => {
  const { cards } = createCards();
  for (const status of ['READY STOCK', 'AVAILABLE', 'INCOMING', 'PORT KLANG', 'SOLD']) {
    const html = cards.renderCard(vehicle({ price: 0, status }));
    assert.match(html, /Harga belum disahkan/);
    assert.match(html, /Hubungi advisor untuk harga terkini\./);
    assert.doesNotMatch(html, /Incoming \/ port unit|landing|calculator\.html|\/bulan anggaran/);
  }
  assert.equal(cards.hasValidPrice(Infinity), false);
  assert.equal(cards.hasValidPrice('invalid'), false);
});

test('cards expose supplied year, variant, mileage and one copy of grade', () => {
  const { cards } = createCards();
  const html = cards.renderCard(vehicle());
  assert.match(html, /class="vehicle-variant">2\.5 SC Package/);
  assert.match(html, /class="vehicle-facts">2022 · 23,450 km · Grade 4\.5/);
  assert.equal(html.match(/Grade 4\.5/g).length, 1);
  assert.match(html, /RM 189,000/);
  assert.match(html, /calculator\.html\?price=189000/);
});

test('missing facts are omitted rather than invented, and raw anomalies remain unchanged', () => {
  const { cards } = createCards();
  const blank = cards.renderCard(vehicle({ year: null, mileage: null, grade: '', variant: '' }));
  assert.doesNotMatch(blank, /class="vehicle-facts"|class="vehicle-variant"|0 km|Japan recondition/);
  const supplied = vehicle({ brand: 'Suzuki', model: 'Jimny Momade FC', variant: 'Jimny Momade FC', grade: '54' });
  const html = cards.renderCard(supplied);
  assert.match(html, /Jimny Momade FC/);
  assert.match(html, /Grade 54/);
  assert.doesNotMatch(html, /class="vehicle-variant"/);
  assert.equal(supplied.model, 'Jimny Momade FC');
  assert.equal(supplied.grade, '54');
});

test('missing photos use an accessible, intentional placeholder', () => {
  const { cards } = createCards();
  const html = cards.renderCard(vehicle({ image_url: '  ', gallery_urls: [] }));
  assert.match(html, /class="vehicle-placeholder" role="img" aria-label="Gambar unit belum tersedia"/);
  assert.match(html, /class="vehicle-placeholder-icon"/);
  assert.match(html, /class="vehicle-placeholder-copy">Gambar unit belum tersedia/);
  assert.doesNotMatch(html, /<img |vehicle-placeholder">TOYOTA/);
});

test('photo selection trims, deduplicates and safely ignores malformed galleries', () => {
  const { cards } = createCards();
  const car = vehicle({ image_url: ' https://example.com/one.jpg ', gallery_urls: ['https://example.com/one.jpg', '', ' https://example.com/two.jpg '] });
  assert.equal(cards.mediaSrc(car), 'https://example.com/one.jpg');
  assert.match(cards.renderCard(car), /<span>2 gambar<\/span>/);
  assert.doesNotMatch(cards.renderCard(car), /3 gambar/);
  assert.equal(cards.mediaSrc({ image_url: ' ', gallery_urls: ['https://example.com/two.jpg'] }), 'https://example.com/two.jpg');
  assert.equal(cards.mediaSrc({ image_url: null, gallery_urls: 'malformed' }), '');
});

test('status labels never silently convert an unknown status to ready stock', () => {
  const { cards } = createCards();
  assert.equal(cards.statusInfo(' ready stock ').key, 'available');
  assert.equal(cards.statusInfo('reserved').key, 'booked');
  assert.equal(cards.statusInfo('').label, 'Semak status');
  assert.equal(cards.statusInfo('Inspection').label, 'Inspection');
  assert.equal(cards.statusInfo('Inspection').key, 'unknown');
});

test('source text is escaped in card HTML', () => {
  const { cards } = createCards();
  const html = cards.renderCard(vehicle({ model: '<script>alert(1)</script>', variant: '" onclick="bad' }));
  assert.doesNotMatch(html, /<script>| onclick="bad/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&quot; onclick=&quot;bad/);
});

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.dataset = {};
    this.value = '';
    this.textContent = '';
    this.listeners = {};
    this.attributes = {};
    this.children = [];
    this._html = '';
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value), remove: value => classes.delete(value),
      contains: value => classes.has(value),
      toggle: (value, force) => {
        const enabled = force === undefined ? !classes.has(value) : force;
        enabled ? classes.add(value) : classes.delete(value);
        return enabled;
      }
    };
  }
  set innerHTML(value) { this._html = value; this.children = []; this._typeButtons = null; }
  get innerHTML() { return this._html; }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  emit(name, event = {}) { for (const listener of this.listeners[name] || []) listener({ target: this, currentTarget: this, ...event }); }
  dispatchEvent(event) { this.emit(event.type); return true; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; if (name === 'open') this.open = false; }
  appendChild(node) { this.children.push(node); }
  contains(node) { return node === this || this.children.includes(node); }
  focus() { this.focused = true; }
  querySelector() { return null; }
  querySelectorAll(selector) {
    if (selector !== '[data-type]') return [];
    if (!this._typeButtons) {
      this._typeButtons = [...this._html.matchAll(/<button[^>]*data-type="([^"]+)"[^>]*>/g)].map(match => {
        const button = new FakeElement();
        button.dataset.type = match[1];
        return button;
      });
    }
    return this._typeButtons;
  }
}

async function createInventory(data, { reject = false, eventBeforeResolve = false, url = 'https://izuwanautomobile.com/inventory' } = {}) {
  const { window, cards } = createCards();
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new FakeElement(id));
    return elements.get(id);
  };
  const types = new FakeElement('types');
  const moreFilters = new FakeElement('moreFilters');
  const document = new FakeElement('document');
  document.getElementById = get;
  document.body = new FakeElement('body');
  document.createElement = () => new FakeElement();
  document.querySelector = selector => selector === '.filters.inventory-types' ? types : selector === '.inventory-more-filters' ? moreFilters : null;
  document.querySelectorAll = () => [];
  const listeners = {};
  window.addEventListener = (name, listener) => (listeners[name] ||= []).push(listener);
  window.dispatch = (name, detail) => { for (const listener of listeners[name] || []) listener({ detail }); };
  window.IASBData = { configured: true, sheetConfigured: true };
  const requests = [];
  let shouldReject = reject;
  window.IASBSite.loadManagedData = options => {
    requests.push(options);
    return Promise.resolve().then(() => {
      if (shouldReject) throw new Error('Offline');
      if (eventBeforeResolve) window.dispatch('iasb:data', data);
      return data;
    });
  };
  const rendered = [];
  cards.renderCard = car => { rendered.push(car.id); return `<article data-unit="${car.id}"></article>`; };
  window.location = new URL(url);
  window.history = { replaceState: (_state, _title, href) => { window.location = new URL(href, window.location); } };
  const stored = new Map();
  const sessionStorage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  const context = vm.createContext({ window, document, Event, URL, URLSearchParams, sessionStorage });
  vm.runInContext(inventoryScript, context);
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
  await settle();
  return {
    window, get, document, types, requests, rendered, settle,
    setReject: value => { shouldReject = value; },
    ids: () => [...get('carGrid').innerHTML.matchAll(/data-unit="([^"]+)"/g)].map(match => match[1]),
    change: (id, value) => { get(id).value = value; get(id).emit(id === 'stockSearch' ? 'input' : 'change'); },
    click: (id, selector, dataset = {}) => get(id).emit('click', { target: { closest: requested => requested === selector ? { dataset } : null } })
  };
}

const payload = rows => ({ inventory: rows, inventorySource: 'google-sheet' });

test('default ordering promotes active photographed stock without hiding other real units', async () => {
  const rows = [
    vehicle({ id: 'missing-photo', created_at: '2026-09-30' }),
    vehicle({ id: 'sold-photo', status: 'SOLD', image_url: 'sold.jpg', created_at: '2026-09-30' }),
    vehicle({ id: 'active-photo', image_url: 'active.jpg', created_at: '2025-01-01' }),
    vehicle({ id: 'reserved', status: 'RESERVED' }),
    vehicle({ id: 'inactive-photo', is_active: false, image_url: 'inactive.jpg' })
  ];
  const app = await createInventory(payload(rows));
  assert.deepEqual(app.ids(), ['active-photo', 'missing-photo', 'sold-photo', 'inactive-photo', 'reserved']);
  assert.equal(app.get('inventoryCount').textContent, '5');
  assert.equal(app.get('unitCount').textContent, '2');
});

test('explicit price and mileage sorts are not overridden by photo priority', async () => {
  const app = await createInventory(payload([
    vehicle({ id: 'photo', image_url: 'one.jpg', price: 250000, mileage: 30000 }),
    vehicle({ id: 'cheap', price: 75000, mileage: 0 }),
    vehicle({ id: 'unknown', price: 0, mileage: null })
  ]));
  app.change('sortFilter', 'price-low');
  assert.deepEqual(app.ids(), ['cheap', 'photo', 'unknown']);
  app.change('sortFilter', 'price-high');
  assert.deepEqual(app.ids(), ['photo', 'cheap', 'unknown']);
  app.change('sortFilter', 'mileage-low');
  assert.deepEqual(app.ids(), ['cheap', 'photo', 'unknown']);
  app.change('sortFilter', 'monthly-low');
  assert.deepEqual(app.ids(), ['cheap', 'photo', 'unknown']);
});

test('ready and reserved aliases filter correctly and unusual types stay findable', async () => {
  const app = await createInventory(payload([
    vehicle({ id: 'ready', status: 'READY STOCK' }), vehicle({ id: 'available', status: 'AVAILABLE' }),
    vehicle({ id: 'reserved', status: 'RESERVED' }), vehicle({ id: 'wagon', status: 'INCOMING', type: 'Wagon' })
  ]));
  app.change('statusFilter', 'AVAILABLE');
  assert.deepEqual(app.ids(), ['ready', 'available']);
  app.change('statusFilter', 'BOOKED');
  assert.deepEqual(app.ids(), ['reserved']);
  app.get('clearFilters').emit('click');
  assert.match(app.types.innerHTML, /data-type="Wagon"/);
  app.types.querySelectorAll('[data-type]').find(button => button.dataset.type === 'Wagon').emit('click');
  assert.deepEqual(app.ids(), ['wagon']);
});

test('load more, repeated filters, removable chips and empty-state reset recover consistently', async () => {
  const rows = Array.from({ length: 29 }, (_, index) => vehicle({ id: `unit-${index}`, brand: index < 16 ? 'Toyota' : 'Honda', image_url: `${index}.jpg` }));
  const app = await createInventory(payload(rows));
  assert.equal(app.ids().length, 12);
  app.click('carGrid', '[data-load-more]');
  assert.equal(app.ids().length, 24);
  app.click('carGrid', '[data-load-more]');
  assert.equal(app.ids().length, 29);
  assert.doesNotMatch(app.get('carGrid').innerHTML, /data-load-more/);
  app.change('brandFilter', 'Honda');
  assert.equal(app.ids().length, 12);
  app.click('carGrid', '[data-load-more]');
  assert.equal(app.ids().length, 13);
  app.change('stockSearch', 'not-a-real-model');
  assert.match(app.get('carGrid').innerHTML, /Tiada stok sepadan/);
  app.click('activeFilterChips', '[data-clear-filter]', { clearFilter: 'search' });
  assert.equal(app.ids().length, 12);
  assert.equal(app.get('stockSearch').value, '');
  app.change('stockSearch', 'not-a-real-model');
  app.document.emit('click', { target: { closest: selector => selector === '[data-clear-all]' ? {} : null } });
  assert.equal(app.ids().length, 12);
  assert.equal(app.get('brandFilter').value, 'all');
  assert.equal(app.get('stockSearch').value, '');
  assert.equal(app.get('sortFilter').value, 'latest');
  assert.equal(app.get('inventoryCount').textContent, '29');
});

test('shared loader initializes only once if its event and promise both deliver data', async () => {
  const data = payload([vehicle()]);
  const app = await createInventory(data, { eventBeforeResolve: true });
  assert.equal(app.requests.length, 1);
  assert.equal(app.rendered.length, 1);
  assert.equal(app.document.body.dataset.inventorySource, 'google-sheet');
  app.change('brandFilter', 'Toyota');
  app.window.dispatch('iasb:data', payload([vehicle({ id: 'updated' })]));
  assert.equal(app.get('brandFilter').value, 'Toyota');
  assert.deepEqual(app.ids(), ['updated']);
});

test('failed loads offer retry and recover with current data', async () => {
  const app = await createInventory(payload([vehicle()]), { reject: true });
  assert.match(app.get('carGrid').innerHTML, /data-retry-inventory/);
  assert.match(app.get('carGrid').innerHTML, /Inventory tidak dapat dimuatkan/);
  app.setReject(false);
  app.click('carGrid', '[data-retry-inventory]');
  await app.settle();
  assert.equal(app.requests.length, 2);
  assert.equal(app.requests[1].force, true);
  assert.deepEqual(app.ids(), ['unit-1']);
});

test('card estimate labels use the same configured finance assumptions as the site', () => {
  const { cards, window } = createCards();
  window.IASBSite.financeAssumptions = () => ({ depositPct: 15, years: 7, rate: 3.6 });
  assert.match(cards.renderCard(vehicle()), /15% · 7 thn · 3\.6%/);
  assert.doesNotMatch(cards.renderCard(vehicle()), /10% · 9 thn · 3\.2%/);
});

test('a missing source is a retryable error while a successful empty source stays honest', async () => {
  const missing = await createInventory({ inventory: [], inventorySource: 'none' });
  assert.match(missing.get('carGrid').innerHTML, /data-retry-inventory/);
  const empty = await createInventory(payload([]));
  assert.match(empty.get('carGrid').innerHTML, /Inventory sedang dikemaskini/);
  assert.doesNotMatch(empty.get('carGrid').innerHTML, /data-unit=|data-load-more/);
});

test('refresh drops stale facets without losing matching selected values', async () => {
  const app = await createInventory(payload([
    vehicle({ id: 'old', location: 'Gombak' }), vehicle({ id: 'old-two', brand: 'Honda', location: 'Wahyu' })
  ]));
  app.change('brandFilter', 'Toyota');
  app.change('locationFilter', 'Gombak');
  app.window.dispatch('iasb:data', payload([vehicle({ id: 'new', brand: 'Honda', location: 'Gombak' })]));
  assert.equal(app.get('brandFilter').value, 'all');
  assert.equal(app.get('locationFilter').value, 'Gombak');
  assert.deepEqual(app.ids(), ['new']);
});

test('removable chips and reset notify custom select labels without replaying change events', async () => {
  const app = await createInventory(payload([vehicle()]));
  let syncs = 0;
  let changes = 0;
  app.change('brandFilter', 'Toyota');
  app.get('brandFilter').addEventListener('iasb:select-sync', () => { syncs++; });
  app.get('brandFilter').addEventListener('change', () => { changes++; });
  app.click('activeFilterChips', '[data-clear-filter]', { clearFilter: 'brand' });
  assert.equal(app.get('brandFilter').value, 'all');
  assert.equal(syncs, 1);
  assert.equal(changes, 0);
  app.get('clearFilters').emit('click');
  assert.equal(syncs, 2);
  assert.equal(changes, 0);
});

test('real smooth-select script refreshes its visible label after programmatic reset', () => {
  const script = fs.readFileSync(path.join(root, 'smooth-select.js'), 'utf8');
  const created = [];
  const element = (id = '') => {
    const node = new FakeElement(id);
    node.getAttribute = name => node.attributes[name] || null;
    node.closest = () => null;
    node.append = (...children) => {
      node.children.push(...children);
      children.forEach(child => { child.parentNode = node; child.parentElement = node; });
    };
    node.replaceChildren = () => { node.children = []; };
    node.insertBefore = () => {};
    created.push(node);
    return node;
  };
  const select = element('brandFilter');
  select.value = 'Toyota';
  select.parentNode = element('parent');
  select.parentElement = select.parentNode;
  select.options = [
    { value: 'all', textContent: 'Semua brand', disabled: false },
    { value: 'Toyota', textContent: 'Toyota', disabled: false }
  ];
  select.options.forEach(option => Object.defineProperty(option, 'selected', { get: () => option.value === select.value }));
  Object.defineProperty(select, 'selectedOptions', { get: () => select.options.filter(option => option.selected) });
  const document = element('document');
  document.querySelectorAll = () => [select];
  document.querySelector = () => null;
  document.createElement = () => element();
  document.body = element('body');
  const context = vm.createContext({
    document, window: { innerHeight: 900 }, Event,
    CSS: { escape: value => value },
    Node: { TEXT_NODE: 3 },
    MutationObserver: class { observe() {} }
  });
  vm.runInContext(script, context);
  const displayedValue = created.find(node => node.id === 'brandFilter-value');
  assert.equal(displayedValue.textContent, 'Toyota');
  select.value = 'all';
  select.dispatchEvent(new Event('iasb:select-sync'));
  assert.equal(displayedValue.textContent, 'Semua brand');
  const options = created.filter(node => node.attributes.role === 'option');
  assert.equal(options[0].attributes['aria-selected'], 'true');
  assert.equal(options[1].attributes['aria-selected'], 'false');
});


test('shareable filters restore the same sorted results and preserve unrelated parameters', async () => {
  const rows = [vehicle({id:'h-high',brand:'Honda',price:220000}),vehicle({id:'h-low',brand:'Honda',price:120000}),vehicle({id:'t',brand:'Toyota',price:100000})];
  const app = await createInventory(payload(rows), {url:'https://izuwanautomobile.com/inventory?brand=Honda&sort=price-low&utm_source=review'});
  assert.deepEqual(app.ids(), ['h-low','h-high']);
  assert.equal(app.get('brandFilter').value,'Honda');
  assert.equal(app.get('sortFilter').value,'price-low');
  app.change('stockSearch','honda');
  const url = app.window.location;
  assert.equal(url.searchParams.get('utm_source'),'review');
  assert.equal(url.searchParams.get('search'),'honda');
  const restored = await createInventory(payload(rows), {url:url.href});
  assert.deepEqual(restored.ids(),app.ids());
  restored.get('clearFilters').emit('click');
  assert.equal(restored.window.location.search,'?utm_source=review');
});

test('load-more depth survives return URLs and invalid filter enums fall back safely', async () => {
  const rows = Array.from({length:30},(_,i)=>vehicle({id:String(i)}));
  const app = await createInventory(payload(rows), {url:'https://izuwanautomobile.com/inventory?limit=24&sort=unknown&budget=oops'});
  assert.equal(app.ids().length,24);
  assert.equal(app.get('sortFilter').value,'latest');
  assert.equal(app.get('budgetFilter').value,'all');
});
