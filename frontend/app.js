  const STORAGE_KEY = 'servicepilot_work_orders';
  const INVOICE_STORAGE_KEY = 'servicepilot_invoices';
  const STATUSES = [
    { id: 'new', label: 'New' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'progress', label: 'In Progress' },
    { id: 'done', label: 'Done' },
  ];
  const DRAG_MAX = 130;
  const ACTION_THRESHOLD = 84;

  let workOrders = load();
  let editingId = null;
  let activeFilter = 'active';
  let dragState = null;
  let selectMode = false;
  let selectedIds = new Set();
  let currentPage = 'orders';
  let calendarMonth = startOfMonth(new Date());
  let selectedDay = dateKey(new Date());
  let invoices = loadInvoices();
  let invoiceItemCounter = 0;
  let lastGeneratedInvoice = null;
  let linkedWorkOrder = null;
  let editingInvoiceId = null;

  function pad2(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function todayKey() { return dateKey(new Date()); }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

  function load() {
    let list;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      list = raw ? JSON.parse(raw) : seedData();
    } catch (e) {
      list = seedData();
    }
    // migrate legacy records (pre swipe/appointment-date schema)
    list.forEach(w => {
      if (w.seen === undefined) w.seen = true;
      if (w.appointmentDate === undefined) w.appointmentDate = w.date || '';
      if (w.created === undefined) w.created = Date.now();
    });
    return list;
  }

  function seedData() {
    return [
      {
        id: cryptoId(), num: 'WO-0001', customer: 'Maria Chen', phone: '(801) 555-0192',
        address: '412 Willow St, Unit 4',
        description: 'Kitchen faucet leaking at base, needs new cartridge or full replacement.',
        priority: 'normal', status: 'new', appointmentDate: '', seen: true,
        created: Date.now() - 4 * 86400000,
      },
      {
        id: cryptoId(), num: 'WO-0002', customer: 'Riverbend Apartments — Bldg C', phone: '(801) 555-0410',
        address: '88 Riverbend Ave, Unit 12',
        description: 'Dead grass patch near sprinkler head, possible lateral line leak. Shutoff test needed.',
        priority: 'high', status: 'scheduled', appointmentDate: nextDays(1), seen: true,
        created: Date.now() - 2 * 86400000,
      },
      {
        id: cryptoId(), num: 'WO-0003', customer: 'Tom Reyes', phone: '(801) 555-0777',
        address: '9 Copperfield Ln',
        description: 'Ceiling fan remote not pairing after replacement. Bring compatible remote.',
        priority: 'low', status: 'progress', appointmentDate: nextDays(0), seen: true,
        created: Date.now() - 86400000,
      },
    ];
  }

  function nextDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  function cryptoId() {
    return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workOrders));
  }

  function nextTicketNum() {
    const max = workOrders.reduce((m, w) => {
      const n = parseInt((w.num || '').replace('WO-', ''), 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 0);
    return 'WO-' + String(max + 1).padStart(4, '0');
  }

  function statusLabel(id) {
    return (STATUSES.find(s => s.id === id) || {}).label || id;
  }

  function formatDate(str) {
    if (!str) return '—';
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatCreated(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderFilters() {
    const row = document.getElementById('filterRow');
    const counts = {
      active: workOrders.filter(w => w.status !== 'done').length,
      all: workOrders.length,
      new: workOrders.filter(w => w.status === 'new').length,
      scheduled: workOrders.filter(w => w.status === 'scheduled').length,
      progress: workOrders.filter(w => w.status === 'progress').length,
      done: workOrders.filter(w => w.status === 'done').length,
    };
    const tabs = [
      { id: 'active', label: 'Active' },
      { id: 'new', label: 'New' },
      { id: 'scheduled', label: 'Scheduled' },
      { id: 'progress', label: 'In Progress' },
      { id: 'done', label: 'Done' },
      { id: 'all', label: 'All' },
    ];
    row.innerHTML = tabs.map(t => `
      <button class="filter-tab ${activeFilter === t.id ? 'active' : ''}" onclick="setFilter('${t.id}')">
        ${t.label}<span class="count">${counts[t.id]}</span>
      </button>
    `).join('');

    document.getElementById('navCount').textContent = counts.active;
    document.getElementById('topCount').textContent = counts.active + ' active';
  }

  function setFilter(id) {
    activeFilter = id;
    render();
  }

  function filteredOrders() {
    let list = [...workOrders];
    if (activeFilter === 'active') list = list.filter(w => w.status !== 'done');
    else if (activeFilter !== 'all') list = list.filter(w => w.status === activeFilter);
    return list.sort((a, b) => {
      const order = { urgent: 0, high: 1, normal: 2, low: 3 };
      if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
      const ad = a.appointmentDate || '9999', bd = b.appointmentDate || '9999';
      return ad.localeCompare(bd);
    });
  }

  const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const ICON_FLAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4"/><path d="M4 4h14l-3 5 3 5H4"/></svg>';
  const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>';

  function renderList() {
    const list = document.getElementById('ticketList');
    const orders = filteredOrders();

    if (orders.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <div class="icon">🗂</div>
          <h3>No work orders here</h3>
          <p>Click "New Work Order" to create your first ticket.</p>
        </div>`;
      return;
    }

    list.innerHTML = orders.map(w => {
      const hasAppt = !!w.appointmentDate;
      const dateHtml = hasAppt
        ? `<div class="ticket-date scheduled" title="Appointment: ${formatDate(w.appointmentDate)}">${ICON_CAL}${formatDate(w.appointmentDate)}</div>`
        : `<div class="ticket-date" title="Created ${formatCreated(w.created)}">${formatDate(w.created ? new Date(w.created).toISOString().split('T')[0] : '')}</div>`;

      const isSelected = selectedIds.has(w.id);
      return `
      <div class="ticket-swipe" data-id="${w.id}">
        <div class="swipe-bg swipe-bg-left">${ICON_CHECK}<span>Done</span></div>
        <div class="swipe-bg swipe-bg-right"><span>Unseen</span>${ICON_FLAG}</div>
        <div class="ticket ${isSelected ? 'row-selected' : ''}" data-id="${w.id}">
          ${selectMode ? `<div class="select-box ${isSelected ? 'checked' : ''}">${isSelected ? ICON_CHECK : ''}</div>` : ''}
          <div class="ticket-num">${w.num}</div>
          <div class="priority-flag ${w.priority}" title="${w.priority} priority"></div>
          <div class="ticket-main">
            <div class="ticket-customer">${w.seen === false ? '<span class="unseen-dot"></span>' : ''}${escapeHtml(w.customer || 'Unnamed customer')}</div>
            <div class="ticket-desc">${escapeHtml(w.description || 'No description')}</div>
            <div class="ticket-address">${escapeHtml(w.address || '')}</div>
          </div>
          <div class="ticket-meta">
            <span class="badge status-${w.status}">${statusLabel(w.status)}</span>
          </div>
          ${dateHtml}
        </div>
      </div>
    `;
    }).join('');
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function render() {
    renderFilters();
    renderList();
    renderBulkBar();
    const btn = document.getElementById('selectToggleBtn');
    btn.classList.toggle('active', selectMode);
    btn.innerHTML = selectMode
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="8 12 11 15 16 9"/></svg> Select`;
    document.getElementById('navCalCount').textContent = workOrders.filter(w => w.appointmentDate).length;
    document.getElementById('navInvoiceCount').textContent = invoices.length;
    if (currentPage === 'calendar') renderCalendar();
    if (currentPage === 'invoices') renderInvoiceList();
  }

  function switchPage(page) {
    currentPage = page;
    document.getElementById('ordersPage').classList.toggle('hidden', page !== 'orders');
    document.getElementById('calendarPage').classList.toggle('hidden', page !== 'calendar');
    document.getElementById('invoicesPage').classList.toggle('hidden', page !== 'invoices');
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    render();
  }

  // ---------- Calendar ----------
  function calPrevMonth() {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    renderCalendar();
  }

  function calNextMonth() {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    renderCalendar();
  }

  function calGoToday() {
    calendarMonth = startOfMonth(new Date());
    selectedDay = todayKey();
    renderCalendar();
  }

  function ordersByDate() {
    const map = {};
    workOrders.forEach(w => {
      if (!w.appointmentDate) return;
      (map[w.appointmentDate] = map[w.appointmentDate] || []).push(w);
    });
    return map;
  }

  function sortByPriority(list) {
    const order = { urgent: 0, high: 1, normal: 2, low: 3 };
    return [...list].sort((a, b) => order[a.priority] - order[b.priority]);
  }

  function renderCalendar() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    document.getElementById('calMonthLabel').textContent =
      calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const map = ordersByDate();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInThisMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) {
      const dayNum = daysInPrevMonth - startOffset + 1 + i;
      cells.push({ date: new Date(year, month - 1, dayNum), outside: true });
    }
    for (let d = 1; d <= daysInThisMonth; d++) {
      cells.push({ date: new Date(year, month, d), outside: false });
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last);
      next.setDate(next.getDate() + 1);
      cells.push({ date: next, outside: true });
    }

    const today = todayKey();
    const grid = document.getElementById('calGrid');
    const maxShow = 2;

    grid.innerHTML = cells.map(c => {
      const key = dateKey(c.date);
      const dayOrders = sortByPriority(map[key] || []);
      const shown = dayOrders.slice(0, maxShow);
      const extra = dayOrders.length - shown.length;
      const classes = ['cal-cell'];
      if (c.outside) classes.push('outside');
      if (key === today) classes.push('today');
      if (key === selectedDay) classes.push('selected');
      return `
        <div class="${classes.join(' ')}" data-date="${key}">
          <div class="cal-daynum">${c.date.getDate()}</div>
          ${shown.map(w => `<div class="cal-chip status-${w.status}" data-id="${w.id}" title="${escapeHtml(w.customer || '')}">${escapeHtml(w.customer || 'Untitled')}</div>`).join('')}
          ${extra > 0 ? `<div class="cal-more">+${extra} more</div>` : ''}
        </div>
      `;
    }).join('');

    renderAgenda();
  }

  function renderAgenda() {
    const map = ordersByDate();
    const list = sortByPriority(map[selectedDay] || []);
    const d = new Date(selectedDay + 'T00:00:00');
    const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const isToday = selectedDay === todayKey();
    const agenda = document.getElementById('calAgenda');

    agenda.innerHTML = `
      <div class="cal-agenda-header">
        <div class="cal-agenda-title">${label}${isToday ? '<span class="cal-agenda-today-tag">TODAY</span>' : ''}</div>
        <button class="cal-agenda-add">+ Add for this day</button>
      </div>
      ${list.length === 0 ? `<div class="cal-agenda-empty">No appointments scheduled this day.</div>` : `
      <div class="cal-agenda-list">
        ${list.map(w => `
          <div class="ticket" data-id="${w.id}">
            <div class="ticket-num">${w.num}</div>
            <div class="priority-flag ${w.priority}"></div>
            <div class="ticket-main">
              <div class="ticket-customer">${w.seen === false ? '<span class="unseen-dot"></span>' : ''}${escapeHtml(w.customer || 'Unnamed customer')}</div>
              <div class="ticket-desc">${escapeHtml(w.description || 'No description')}</div>
              <div class="ticket-address">${escapeHtml(w.address || '')}</div>
            </div>
            <div class="ticket-meta"><span class="badge status-${w.status}">${statusLabel(w.status)}</span></div>
          </div>
        `).join('')}
      </div>`}
    `;
  }

  document.getElementById('calendarPage').addEventListener('click', e => {
    const chip = e.target.closest('.cal-chip');
    if (chip) { openPanel(chip.dataset.id); return; }
    const addBtn = e.target.closest('.cal-agenda-add');
    if (addBtn) { openPanel(null, selectedDay); return; }
    const ticket = e.target.closest('.ticket');
    if (ticket) { openPanel(ticket.dataset.id); return; }
    const cell = e.target.closest('.cal-cell');
    if (cell) { selectedDay = cell.dataset.date; renderCalendar(); return; }
  });

  function renderBulkBar() {
    const bar = document.getElementById('bulkBar');
    if (!selectMode) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const visible = filteredOrders().map(w => w.id);
    const allSelected = visible.length > 0 && visible.every(id => selectedIds.has(id));
    bar.innerHTML = `
      <div class="bulk-left">
        <div class="select-box select-all-box ${allSelected ? 'checked' : ''}" onclick="toggleSelectAll()">${allSelected ? ICON_CHECK : ''}</div>
        <span class="bulk-count">${selectedIds.size} selected</span>
      </div>
      <div class="bulk-actions">
        <span class="bulk-label">Mark as:</span>
        ${STATUSES.map(s => `<button class="bulk-status-btn" onclick="bulkSetStatus('${s.id}')" ${selectedIds.size === 0 ? 'disabled' : ''}>${s.label}</button>`).join('')}
        <button class="bulk-cancel" onclick="toggleSelectMode()">Cancel</button>
      </div>
    `;
  }

  function toggleSelectMode() {
    selectMode = !selectMode;
    selectedIds.clear();
    render();
  }

  function toggleSelect(id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    render();
  }

  function toggleSelectAll() {
    const visible = filteredOrders().map(w => w.id);
    const allSelected = visible.length > 0 && visible.every(id => selectedIds.has(id));
    if (allSelected) visible.forEach(id => selectedIds.delete(id));
    else visible.forEach(id => selectedIds.add(id));
    render();
  }

  function bulkSetStatus(status) {
    if (selectedIds.size === 0) return;
    workOrders.forEach(w => { if (selectedIds.has(w.id)) w.status = status; });
    save();
    selectedIds.clear();
    render();
  }

  // ---------- Swipe gestures ----------
  const ticketListEl = document.getElementById('ticketList');

  ticketListEl.addEventListener('pointerdown', e => {
    if (selectMode) return;
    const card = e.target.closest('.ticket');
    if (!card) return;
    dragState = { id: card.dataset.id, el: card, wrap: card.closest('.ticket-swipe'), startX: e.clientX, dx: 0, moved: false };
    card.style.transition = 'none';
  });

  document.addEventListener('pointermove', e => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    if (Math.abs(dx) > 4) dragState.moved = true;
    dragState.dx = Math.max(-DRAG_MAX, Math.min(DRAG_MAX, dx));
    applyDragVisual(dragState);
  });

  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  function endDrag() {
    if (!dragState) return;
    const { id, dx, moved, el } = dragState;
    if (moved && Math.abs(dx) > ACTION_THRESHOLD) {
      if (dx > 0) markDone(id);
      else markUnseen(id);
    }
    resetDragVisual(dragState);
    if (moved) {
      el.dataset.suppressClick = '1';
      setTimeout(() => { delete el.dataset.suppressClick; }, 0);
    }
    dragState = null;
  }

  function applyDragVisual(state) {
    state.el.style.transform = `translateX(${state.dx}px)`;
    const leftBg = state.wrap.querySelector('.swipe-bg-left');
    const rightBg = state.wrap.querySelector('.swipe-bg-right');
    if (state.dx > 0) {
      leftBg.style.opacity = Math.min(state.dx / ACTION_THRESHOLD, 1);
      rightBg.style.opacity = 0;
    } else if (state.dx < 0) {
      rightBg.style.opacity = Math.min(-state.dx / ACTION_THRESHOLD, 1);
      leftBg.style.opacity = 0;
    } else {
      leftBg.style.opacity = 0;
      rightBg.style.opacity = 0;
    }
  }

  function resetDragVisual(state) {
    state.el.style.transition = 'transform 0.2s ease';
    state.el.style.transform = 'translateX(0)';
    const leftBg = state.wrap.querySelector('.swipe-bg-left');
    const rightBg = state.wrap.querySelector('.swipe-bg-right');
    leftBg.style.transition = 'opacity 0.2s ease';
    rightBg.style.transition = 'opacity 0.2s ease';
    leftBg.style.opacity = 0;
    rightBg.style.opacity = 0;
  }

  ticketListEl.addEventListener('click', e => {
    const card = e.target.closest('.ticket');
    if (!card) return;
    if (selectMode) { toggleSelect(card.dataset.id); return; }
    if (card.dataset.suppressClick) return;
    openPanel(card.dataset.id);
  });

  function markDone(id) {
    const w = workOrders.find(x => x.id === id);
    if (!w) return;
    w.status = 'done';
    save();
    render();
  }

  function markUnseen(id) {
    const w = workOrders.find(x => x.id === id);
    if (!w) return;
    w.seen = false;
    save();
    render();
  }

  // ---------- Panel ----------
  function renderStatusRow(selected) {
    const row = document.getElementById('statusRow');
    row.innerHTML = STATUSES.map(s => `
      <div class="status-pill status-${s.id} ${selected === s.id ? 'selected' : ''}" data-status="${s.id}" onclick="selectStatus('${s.id}')">
        ${s.label}
      </div>
    `).join('');
  }

  function selectStatus(id) {
    document.querySelectorAll('.status-pill').forEach(el => {
      el.classList.toggle('selected', el.dataset.status === id);
    });
  }

  function getSelectedStatus() {
    const el = document.querySelector('.status-pill.selected');
    return el ? el.dataset.status : 'new';
  }

  function openPanel(id, prefillAppointment) {
    editingId = id || null;
    const panel = document.getElementById('panel');

    if (id) {
      const w = workOrders.find(x => x.id === id);
      document.getElementById('panelLabel').textContent = w.num;
      document.getElementById('panelTitle').textContent = 'Edit Work Order';
      document.getElementById('f-customer').value = w.customer || '';
      document.getElementById('f-phone').value = w.phone || '';
      document.getElementById('f-address').value = w.address || '';
      document.getElementById('f-description').value = w.description || '';
      document.getElementById('f-priority').value = w.priority || 'normal';
      document.getElementById('f-created').value = formatCreated(w.created);
      document.getElementById('f-appointment').value = w.appointmentDate || '';
      renderStatusRow(w.status);
      document.getElementById('deleteBtn').style.display = 'block';
      document.getElementById('pdfUploadSection').style.display = 'none';
      document.getElementById('formDivider').style.display = 'none';
      document.getElementById('billJobBtn').style.display = 'flex';

      if (w.seen === false) {
        w.seen = true;
        save();
        render();
      }
    } else {
      document.getElementById('panelLabel').textContent = nextTicketNum();
      document.getElementById('panelTitle').textContent = 'Create Work Order';
      document.getElementById('f-customer').value = '';
      document.getElementById('f-phone').value = '';
      document.getElementById('f-address').value = '';
      document.getElementById('f-description').value = '';
      document.getElementById('f-priority').value = 'normal';
      document.getElementById('f-created').value = formatCreated(Date.now());
      document.getElementById('f-appointment').value = prefillAppointment || '';
      renderStatusRow('new');
      document.getElementById('deleteBtn').style.display = 'none';
      document.getElementById('pdfUploadSection').style.display = 'flex';
      document.getElementById('formDivider').style.display = 'flex';
      document.getElementById('billJobBtn').style.display = 'none';
    }

    panel.classList.add('open');
    if (!id) setTimeout(() => document.getElementById('f-customer').focus(), 220);
  }


  function closePanel() {
    document.getElementById('panel').classList.remove('open');
    editingId = null;
    render();
  }

  function saveTicket() {
    const customer = document.getElementById('f-customer').value.trim();
    if (!customer) {
      document.getElementById('f-customer').focus();
      document.getElementById('f-customer').style.borderColor = 'var(--red)';
      return;
    }

    const appointmentDate = document.getElementById('f-appointment').value;
    let status = getSelectedStatus();
    if (appointmentDate && status === 'new') status = 'scheduled';

    const data = {
      customer,
      phone: document.getElementById('f-phone').value.trim(),
      address: document.getElementById('f-address').value.trim(),
      description: document.getElementById('f-description').value.trim(),
      priority: document.getElementById('f-priority').value,
      status,
      appointmentDate,
      seen: true,
    };

    if (editingId) {
      const w = workOrders.find(x => x.id === editingId);
      Object.assign(w, data);
    } else {
      workOrders.push({ id: cryptoId(), num: nextTicketNum(), created: Date.now(), ...data });
    }

    save();
    closePanel();
    render();
  }

  function deleteTicket() {
    if (!editingId) return;
    if (!confirm('Delete this work order? This cannot be undone.')) return;
    workOrders = workOrders.filter(x => x.id !== editingId);
    save();
    closePanel();
    render();
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('panel').classList.contains('open')) closePanel();
      else if (document.getElementById('invoicePanel').classList.contains('open')) closeInvoicePanel();
      else if (selectMode) toggleSelectMode();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openPanel();
    }
  });

  // ---------- Invoices ----------
  function loadInvoices() {
    try {
      const raw = localStorage.getItem(INVOICE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveInvoices() {
    localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices));
  }

  function nextInvoiceNum() {
    return invoices.reduce((m, i) => Math.max(m, i.num || 0), 100) + 1;
  }

  function invFmtMoney(n) {
    if (isNaN(n)) n = 0;
    return '$' + n.toFixed(2);
  }

  function invFmtDateDisplay(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function updateInvLinkedTag() {
    const tag = document.getElementById('invLinkedTag');
    if (linkedWorkOrder && linkedWorkOrder.num) {
      tag.style.display = 'flex';
      tag.textContent = `Linked to work order ${linkedWorkOrder.num}`;
    } else {
      tag.style.display = 'none';
    }
  }

  function makeInvoiceItemRow(prefill) {
    invoiceItemCounter++;
    const id = 'inv-item-' + invoiceItemCounter;
    const wrap = document.createElement('div');
    wrap.className = 'item-card';
    wrap.id = id;
    wrap.innerHTML = `
      <div class="item-row">
        <div class="field">
          <label>What you bought</label>
          <input type="text" class="itemDesc" placeholder="2.4 gallon toilet fill valve" value="${prefill ? escapeHtml(prefill.desc || '') : ''}">
        </div>
        <div class="field-row-2">
          <div class="field"><label>Qty</label><input type="number" class="itemQty" min="0" step="1" value="${prefill ? prefill.qty : 1}"></div>
          <div class="field"><label>Cost each</label><input type="number" class="itemCost" min="0" step="0.01" value="${prefill ? prefill.cost.toFixed(2) : '0.00'}"></div>
        </div>
        <div class="field">
          <label>Type</label>
          <select class="itemType">
            <option value="Part">Part</option>
            <option value="Labor">Labor</option>
            <option value="Labor billed to tenant">Billed to tenant</option>
          </select>
        </div>
        <div class="item-amount-row">
          <span class="item-amount-display">$0.00</span>
          <button class="remove-item-btn" type="button">Remove</button>
        </div>
      </div>
    `;
    document.getElementById('invItemsContainer').appendChild(wrap);
    if (prefill) wrap.querySelector('.itemType').value = prefill.type || 'Part';

    const qtyEl = wrap.querySelector('.itemQty');
    const costEl = wrap.querySelector('.itemCost');
    const amountEl = wrap.querySelector('.item-amount-display');
    const removeBtn = wrap.querySelector('.remove-item-btn');

    function recalc() {
      const qty = parseFloat(qtyEl.value) || 0;
      const cost = parseFloat(costEl.value) || 0;
      amountEl.textContent = invFmtMoney(qty * cost);
    }
    qtyEl.addEventListener('input', recalc);
    costEl.addEventListener('input', recalc);
    removeBtn.addEventListener('click', () => wrap.remove());
    recalc();
    return wrap;
  }

  function invCollectItems() {
    return Array.from(document.getElementById('invItemsContainer').querySelectorAll('.item-card')).map(card => {
      const desc = card.querySelector('.itemDesc').value.trim();
      const qty = parseFloat(card.querySelector('.itemQty').value) || 0;
      const cost = parseFloat(card.querySelector('.itemCost').value) || 0;
      const type = card.querySelector('.itemType').value;
      return { desc, qty, cost, amount: qty * cost, type };
    }).filter(i => i.desc || i.amount > 0);
  }

  function renderInvoiceReceipt(data) {
    const rows = [];
    rows.push(`
      <tr>
        <td><strong>Labor</strong><span class="desc-sub">${escapeHtml(data.labor.desc || 'No description provided')}</span></td>
        <td class="num">${data.labor.hours}</td>
        <td class="num">${invFmtMoney(data.labor.rate)}</td>
        <td class="num">${invFmtMoney(data.labor.amount)}</td>
      </tr>
    `);
    data.items.forEach(item => {
      rows.push(`
        <tr>
          <td><strong>${escapeHtml(item.desc || 'Untitled item')}</strong><span class="type-badge">${escapeHtml(item.type)}</span></td>
          <td class="num">${item.qty}</td>
          <td class="num">${invFmtMoney(item.cost)}</td>
          <td class="num">${invFmtMoney(item.amount)}</td>
        </tr>
      `);
    });

    document.getElementById('invReceipt').innerHTML = `
      <div class="eyebrow">Invoice</div>
      <h3>INV-${String(data.num).padStart(4, '0')}${data.workOrderNum ? ` <span style="font-family:var(--mono);font-size:11px;color:var(--ink-faint);font-weight:500;">· ${escapeHtml(data.workOrderNum)}</span>` : ''}</h3>
      <div class="inv-meta">
        <span>Bill to</span><strong>${escapeHtml(data.custName || '—')}</strong>
        <span>Email</span><span>${escapeHtml(data.custEmail || '—')}</span>
        <span>Job location</span><span>${escapeHtml(data.jobAddress || '—')}</span>
        <span>Date</span><span>${invFmtDateDisplay(data.woDate)}</span>
        <span>Payment due</span><span>${invFmtDateDisplay(data.dueDate)}</span>
      </div>
      <table>
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <div class="totals">
        <div class="totals-row grand"><span>Total due</span><span>${invFmtMoney(data.total)}</span></div>
      </div>
      ${data.notes ? `<div class="inv-notes"><strong>Notes / Terms</strong><br>${escapeHtml(data.notes)}</div>` : ''}
    `;
  }

  function openInvoicePanel(existingInvoiceId, fromWorkOrder) {
    editingInvoiceId = existingInvoiceId || null;
    linkedWorkOrder = fromWorkOrder || null;

    const itemsContainer = document.getElementById('invItemsContainer');
    itemsContainer.innerHTML = '';
    invoiceItemCounter = 0;
    lastGeneratedInvoice = null;
    document.getElementById('invReceiptWrap').style.display = 'none';
    document.getElementById('inv-laborDesc').style.borderColor = '';

    if (existingInvoiceId) {
      const inv = invoices.find(x => x.id === existingInvoiceId);
      if (!inv) return;
      if (inv.workOrderId) linkedWorkOrder = { id: inv.workOrderId, num: inv.workOrderNum };
      document.getElementById('invoicePanelLabel').textContent = 'INV-' + String(inv.num).padStart(4, '0');
      document.getElementById('inv-custName').value = inv.custName || '';
      document.getElementById('inv-custEmail').value = inv.custEmail || '';
      document.getElementById('inv-jobAddress').value = inv.jobAddress || '';
      document.getElementById('inv-woDate').value = inv.woDate || '';
      document.getElementById('inv-dueDate').value = inv.dueDate || '';
      document.getElementById('inv-laborDesc').value = inv.labor.desc || '';
      document.getElementById('inv-laborHours').value = inv.labor.hours;
      document.getElementById('inv-laborRate').value = inv.labor.rate;
      document.getElementById('inv-notes').value = inv.notes || '';
      (inv.items.length ? inv.items : []).forEach(it => makeInvoiceItemRow(it));
      if (inv.items.length === 0) makeInvoiceItemRow();
      lastGeneratedInvoice = inv;
      renderInvoiceReceipt(inv);
      document.getElementById('invReceiptWrap').style.display = 'block';
    } else {
      const today = new Date();
      const due = new Date(today);
      due.setDate(due.getDate() + 30);
      document.getElementById('invoicePanelLabel').textContent = 'INV-' + String(nextInvoiceNum()).padStart(4, '0');
      document.getElementById('inv-custName').value = fromWorkOrder ? (fromWorkOrder.customer || '') : '';
      document.getElementById('inv-custEmail').value = '';
      document.getElementById('inv-jobAddress').value = fromWorkOrder ? (fromWorkOrder.address || '') : '';
      document.getElementById('inv-woDate').value = today.toISOString().slice(0, 10);
      document.getElementById('inv-dueDate').value = due.toISOString().slice(0, 10);
      document.getElementById('inv-laborDesc').value = '';
      document.getElementById('inv-laborHours').value = 1;
      document.getElementById('inv-laborRate').value = 25.00;
      document.getElementById('inv-notes').value = '';
      makeInvoiceItemRow();
    }

    updateInvLinkedTag();
    document.getElementById('invoicePanel').classList.add('open');
  }

  function closeInvoicePanel() {
    document.getElementById('invoicePanel').classList.remove('open');
    editingInvoiceId = null;
    linkedWorkOrder = null;
    render();
  }

  function billThisJob() {
    if (!editingId) return;
    const w = workOrders.find(x => x.id === editingId);
    if (!w) return;
    closePanel();
    openInvoicePanel(null, { id: w.id, num: w.num, customer: w.customer, address: w.address });
  }

  function invGenerate() {
    const laborDesc = document.getElementById('inv-laborDesc').value.trim();
    const laborHours = parseFloat(document.getElementById('inv-laborHours').value) || 0;
    const laborRate = parseFloat(document.getElementById('inv-laborRate').value) || 0;
    const laborAmount = laborHours * laborRate;

    if (!laborDesc) {
      document.getElementById('inv-laborDesc').focus();
      document.getElementById('inv-laborDesc').style.borderColor = 'var(--red)';
      return;
    }
    document.getElementById('inv-laborDesc').style.borderColor = '';

    const items = invCollectItems();
    const total = laborAmount + items.reduce((sum, i) => sum + i.amount, 0);
    const existing = editingInvoiceId ? invoices.find(x => x.id === editingInvoiceId) : null;

    const data = {
      id: existing ? existing.id : cryptoId(),
      num: existing ? existing.num : nextInvoiceNum(),
      workOrderId: linkedWorkOrder ? linkedWorkOrder.id : null,
      workOrderNum: linkedWorkOrder ? linkedWorkOrder.num : null,
      custName: document.getElementById('inv-custName').value.trim(),
      custEmail: document.getElementById('inv-custEmail').value.trim(),
      jobAddress: document.getElementById('inv-jobAddress').value.trim(),
      woDate: document.getElementById('inv-woDate').value,
      dueDate: document.getElementById('inv-dueDate').value,
      notes: document.getElementById('inv-notes').value.trim(),
      labor: { desc: laborDesc, hours: laborHours, rate: laborRate, amount: laborAmount },
      items,
      total,
      created: existing ? existing.created : Date.now(),
    };

    if (existing) {
      const idx = invoices.findIndex(x => x.id === existing.id);
      invoices[idx] = data;
    } else {
      invoices.push(data);
    }
    editingInvoiceId = data.id;
    saveInvoices();

    lastGeneratedInvoice = data;
    renderInvoiceReceipt(data);
    document.getElementById('invReceiptWrap').style.display = 'block';
    document.getElementById('invoicePanelLabel').textContent = 'INV-' + String(data.num).padStart(4, '0');
    render();
  }

  function flashInvCopy() {
    const el = document.getElementById('invCopyFlash');
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 2500);
  }

  document.getElementById('invAddItemBtn').addEventListener('click', () => makeInvoiceItemRow());
  document.getElementById('invGenerateBtn').addEventListener('click', invGenerate);

  document.getElementById('invCopyBtn').addEventListener('click', async () => {
    if (!lastGeneratedInvoice) { invGenerate(); if (!lastGeneratedInvoice) return; }
    const d = lastGeneratedInvoice;
    const lines = [];
    lines.push(['Invoice Number', 'INV-' + String(d.num).padStart(4, '0')].join('\t'));
    if (d.workOrderNum) lines.push(['Linked Work Order', d.workOrderNum].join('\t'));
    lines.push(['Invoice Date', invFmtDateDisplay(d.woDate)].join('\t'));
    lines.push(['Payment Due', invFmtDateDisplay(d.dueDate)].join('\t'));
    lines.push(['Bill To', d.custName].join('\t'));
    lines.push(['Email', d.custEmail].join('\t'));
    lines.push(['Job Location', d.jobAddress].join('\t'));
    lines.push('');
    lines.push(['Item', 'Type', 'Quantity', 'Price', 'Amount'].join('\t'));
    lines.push(['Labor', 'Labor', d.labor.hours, d.labor.rate.toFixed(2), d.labor.amount.toFixed(2)].join('\t'));
    d.items.forEach(item => {
      lines.push([item.desc, item.type, item.qty, item.cost.toFixed(2), item.amount.toFixed(2)].join('\t'));
    });
    lines.push('');
    lines.push(['', '', '', 'Total', d.total.toFixed(2)].join('\t'));
    if (d.notes) { lines.push(''); lines.push(['Notes/Terms', d.notes].join('\t')); }

    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      flashInvCopy();
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      flashInvCopy();
    }
  });

  document.getElementById('invPrintBtn').addEventListener('click', () => {
    if (!lastGeneratedInvoice) invGenerate();
    window.print();
  });

  function renderInvoiceList() {
    const list = document.getElementById('invoiceList');
    document.getElementById('invoiceTopCount').textContent = invoices.length + (invoices.length === 1 ? ' invoice' : ' invoices');

    if (invoices.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <div class="icon">🧾</div>
          <h3>No invoices yet</h3>
          <p>Click "New Invoice", or open a work order and bill the job.</p>
        </div>`;
      return;
    }

    const sorted = [...invoices].sort((a, b) => b.created - a.created);
    list.innerHTML = sorted.map(inv => `
      <div class="ticket" data-invoice-id="${inv.id}">
        <div class="ticket-num">INV-${String(inv.num).padStart(4, '0')}</div>
        <div class="ticket-main">
          <div class="ticket-customer">${escapeHtml(inv.custName || 'Unnamed customer')}</div>
          <div class="ticket-desc">${escapeHtml(inv.labor.desc || 'No description')}</div>
          <div class="ticket-address">${escapeHtml(inv.jobAddress || '')}${inv.workOrderNum ? ` · linked to ${escapeHtml(inv.workOrderNum)}` : ''}</div>
        </div>
        <div class="ticket-meta">
          <span class="badge status-done">${invFmtMoney(inv.total)}</span>
        </div>
        <div class="ticket-date">${formatDate(new Date(inv.created).toISOString().split('T')[0])}</div>
      </div>
    `).join('');
  }

  document.getElementById('invoiceList').addEventListener('click', e => {
    const card = e.target.closest('.ticket');
    if (!card) return;
    openInvoicePanel(card.dataset.invoiceId);
  });

  render();
