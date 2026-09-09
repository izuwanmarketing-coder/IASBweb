(() => {
  const enhanced = new WeakSet();
  let openInstance = null;

  const closeOpen = (restoreFocus = false) => {
    if (!openInstance) return;
    const current = openInstance;
    current.wrap.classList.remove('is-open');
    current.trigger.setAttribute('aria-expanded', 'false');
    openInstance = null;
    if (restoreFocus) current.trigger.focus();
  };

  function enhance(select) {
    if (enhanced.has(select) || select.multiple || select.size > 1) return;
    enhanced.add(select);

    const wrap = document.createElement('div');
    wrap.className = 'smooth-select';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'smooth-select__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const value = document.createElement('span');
    value.className = 'smooth-select__value';
    const chevron = document.createElement('span');
    chevron.className = 'smooth-select__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    trigger.append(value, chevron);
    const menu = document.createElement('ul');
    menu.className = 'smooth-select__menu';
    menu.setAttribute('role', 'listbox');
    menu.tabIndex = -1;

    const id = select.id || `smooth-select-${Math.random().toString(36).slice(2, 9)}`;
    select.id ||= id;
    menu.id = `${id}-menu`;
    trigger.setAttribute('aria-controls', menu.id);
    const label = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
    const wrappingLabel = select.closest('label');
    const wrappingText = wrappingLabel
      ? (wrappingLabel.querySelector(':scope > span')?.textContent.trim() || [...wrappingLabel.childNodes]
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent.trim()).filter(Boolean).join(' '))
      : '';
    const fieldLabel = select.getAttribute('aria-label') || wrappingText || select.name || 'Pilihan';
    if (label) trigger.setAttribute('aria-labelledby', `${label.id ||= `${id}-label`} ${id}-value`);
    value.id = `${id}-value`;

    select.parentNode.insertBefore(wrap, select);
    wrap.append(select, trigger, menu);
    select.classList.add('smooth-select__native');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    select.parentElement?.parentElement?.classList.add('select-enhanced');

    const instance = { select, wrap, trigger, menu, value, options: [], active: -1 };

    const setActive = index => {
      const enabled = instance.options.filter(item => item.option && !item.option.disabled);
      if (!enabled.length) return;
      const next = ((index % enabled.length) + enabled.length) % enabled.length;
      instance.options.forEach(item => item.node.classList.remove('is-active'));
      enabled[next].node.classList.add('is-active');
      const node = enabled[next].node;
      const nodeTop = node.offsetTop;
      const nodeBottom = nodeTop + node.offsetHeight;
      if (nodeTop < menu.scrollTop) menu.scrollTop = nodeTop;
      else if (nodeBottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = nodeBottom - menu.clientHeight;
      instance.active = instance.options.indexOf(enabled[next]);
    };

    const choose = item => {
      if (!item?.option || item.option.disabled) return;
      select.value = item.option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
      closeOpen(true);
    };

    const render = () => {
      menu.replaceChildren();
      instance.options = [...select.options].map((option, index) => {
        const node = document.createElement('li');
        node.className = 'smooth-select__option';
        node.setAttribute('role', 'option');
        node.setAttribute('aria-selected', String(option.selected));
        node.setAttribute('aria-disabled', String(option.disabled));
        node.dataset.index = String(index);
        node.textContent = option.textContent.trim();
        node.addEventListener('pointerdown', event => event.preventDefault());
        const item = { option, node };
        node.addEventListener('click', () => choose(item));
        menu.append(node);
        return item;
      });
      sync();
    };

    function sync() {
      const selected = select.selectedOptions[0] || select.options[0];
      value.textContent = selected?.textContent.trim() || 'Pilih';
      if (!label) trigger.setAttribute('aria-label', `${fieldLabel} ${value.textContent}`);
      trigger.disabled = select.disabled;
      instance.options.forEach(item => {
        const isSelected = item.option === selected;
        item.node.classList.toggle('is-selected', isSelected);
        item.node.setAttribute('aria-selected', String(isSelected));
      });
      instance.active = Math.max(0, instance.options.findIndex(item => item.option === selected));
    }

    const open = () => {
      if (trigger.disabled) return;
      if (openInstance && openInstance !== instance) closeOpen();
      const willOpen = !wrap.classList.contains('is-open');
      if (!willOpen) return closeOpen();
      wrap.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      openInstance = instance;
      const triggerRect = trigger.getBoundingClientRect();
      const menuHeight = Math.min(menu.scrollHeight, 300, window.innerHeight * .42);
      wrap.classList.toggle('opens-up', window.innerHeight - triggerRect.bottom < menuHeight + 16 && triggerRect.top > window.innerHeight - triggerRect.bottom);
      setActive(instance.options.filter(item => !item.option.disabled).findIndex(item => item.option.selected));
    };

    trigger.addEventListener('click', open);
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (!wrap.classList.contains('is-open')) open();
        const enabled = instance.options.filter(item => !item.option.disabled);
        const current = Math.max(0, enabled.findIndex(item => item.node.classList.contains('is-active')));
        if (event.key === 'ArrowDown') setActive(current + 1);
        if (event.key === 'ArrowUp') setActive(current - 1);
        if (event.key === 'Home') setActive(0);
        if (event.key === 'End') setActive(enabled.length - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        if (wrap.classList.contains('is-open')) {
          event.preventDefault();
          choose(instance.options[instance.active]);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeOpen(true);
      }
    });
    select.addEventListener('change', sync);
    new MutationObserver(render).observe(select, { childList: true, subtree: true, attributes: true });
    render();
  }

  const scan = root => {
    if (root.matches?.('select')) enhance(root);
    root.querySelectorAll?.('select').forEach(enhance);
  };

  document.addEventListener('click', event => {
    if (openInstance && !openInstance.wrap.contains(event.target)) closeOpen();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && openInstance) closeOpen(true);
  });
  scan(document);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => node.nodeType === 1 && scan(node))))
    .observe(document.body, { childList: true, subtree: true });
})();
