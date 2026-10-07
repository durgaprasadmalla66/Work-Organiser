'use strict';

// --- Constants & Config ---
const KEY = 'cutdesk.workspace.v1';
const statuses = ['Brief', 'Editing', 'Review', 'Delivered'];
const currencies = ['INR', 'USD', 'EUR', 'GBP'];

// --- Utility Helpers ---
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const day = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const uid = () => globalThis.crypto?.randomUUID?.() || 'cd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

const offset = n => {
  let d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const icon = n => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${({
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  date: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5M17 3v5M3 11h18"/>',
  revision: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  project: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  money: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>'
})[n] || ''}</svg>`;

const defaults = () => ({
  version: 1,
  mode: 'live',
  settings: { name: '', email: '', currency: 'INR', paymentInstructions: '', invoicePrefix: 'CD' },
  projects: []
});

function sample() {
  let s = defaults();
  s.mode = 'demo';
  s.settings.name = 'Sample Studio';
  s.projects = [
    {
      id: 'demo-1',
      title: 'Product launch · 3 reels',
      client: 'Northline',
      email: '',
      type: 'Short-form video',
      due: offset(2),
      fee: 4500,
      revisionLimit: 2,
      extraRate: 500,
      status: 'Editing',
      brief: 'Three 30-second reels. Vertical 1080×1920. Captions and music included.',
      revisions: [{ id: 'r1', date: offset(-1), note: 'Tighten opening hook' }],
      payments: [{ id: 'p1', amount: 2250, date: offset(-3), note: '50% advance' }],
      created: offset(-4)
    },
    {
      id: 'demo-2',
      title: 'Gaming highlights · episode 08',
      client: 'PixelPlay',
      email: '',
      type: 'Long-form video',
      due: offset(-1),
      fee: 3000,
      revisionLimit: 2,
      extraRate: 350,
      status: 'Review',
      brief: '8–10 minute highlight edit with sound design.',
      revisions: [
        { id: 'r2', date: offset(-2), note: 'Add intro' },
        { id: 'r3', date: offset(-1), note: 'Update music' },
        { id: 'r4', date: day(), note: 'Change intro after approval' }
      ],
      payments: [{ id: 'p2', amount: 1500, date: offset(-5), note: 'Advance' }],
      created: offset(-6)
    },
    {
      id: 'demo-3',
      title: 'Thumbnail pack · October',
      client: 'Weekend Rides',
      email: '',
      type: 'Thumbnail design',
      due: offset(5),
      fee: 1500,
      revisionLimit: 1,
      extraRate: 200,
      status: 'Brief',
      brief: 'Five thumbnails, supplied photos and headlines.',
      revisions: [],
      payments: [],
      created: day()
    },
    {
      id: 'demo-4',
      title: 'Brand story · final cut',
      client: 'Vista Coffee',
      email: '',
      type: 'Long-form video',
      due: offset(-3),
      fee: 6000,
      revisionLimit: 2,
      extraRate: 600,
      status: 'Delivered',
      brief: '60-second brand story with two aspect ratios.',
      revisions: [{ id: 'r5', date: offset(-4), note: 'Final feedback' }],
      payments: [
        { id: 'p3', amount: 3000, date: offset(-8), note: 'Advance' },
        { id: 'p4', amount: 3000, date: offset(-3), note: 'Final payment' }
      ],
      created: offset(-9)
    }
  ];
  return s;
}

// --- Data Integrity & Domain Logic ---
const validDate = v => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const t = new Date(v + 'T12:00:00');
  return !Number.isNaN(t.getTime()) && t.getFullYear() === y && t.getMonth() + 1 === m && t.getDate() === d;
};

const finite = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9 && Math.abs(v * 100 - Math.round(v * 100)) < 0.001;

function validateState(s) {
  if (!s || s.version !== 1 || !['demo', 'live'].includes(s.mode) || !s.settings || !Array.isArray(s.projects) || s.projects.length > 5000) {
    throw Error('Not a valid CutDesk v1 backup.');
  }
  for (const k of ['name', 'email', 'paymentInstructions', 'invoicePrefix']) {
    if (typeof s.settings[k] !== 'string' || s.settings[k].length > 5000) throw Error('Invalid workspace settings.');
  }
  if (!currencies.includes(s.settings.currency)) throw Error('Unsupported currency.');
  const ids = new Set();
  for (const p of s.projects) {
    if (!p || typeof p.id !== 'string' || p.id.length > 100 || ids.has(p.id)) throw Error('Invalid or duplicate project ID.');
    ids.add(p.id);
    for (const k of ['title', 'client', 'email', 'type', 'brief']) {
      if (typeof p[k] !== 'string' || p[k].length > 10000) throw Error('Invalid project text.');
    }
    if (!p.title.trim() || !p.client.trim() || !validDate(p.due) || !validDate(p.created) || !finite(p.fee) || !finite(p.extraRate) || !Number.isInteger(p.revisionLimit) || p.revisionLimit < 0 || p.revisionLimit > 1000 || !statuses.includes(p.status)) {
      throw Error('Invalid project details.');
    }
    if (!Array.isArray(p.revisions) || p.revisions.length > 10000 || !Array.isArray(p.payments) || p.payments.length > 10000) {
      throw Error('Invalid project history.');
    }
    const historyIds = new Set();
    for (const e of [...p.revisions, ...p.payments]) {
      if (!e || typeof e.id !== 'string' || e.id.length > 100 || historyIds.has(e.id) || !validDate(e.date) || typeof e.note !== 'string' || e.note.length > 10000) {
        throw Error('Invalid history entry.');
      }
      historyIds.add(e.id);
    }
    for (const e of p.payments) {
      if (!finite(e.amount) || e.amount <= 0) throw Error('Invalid payment amount.');
    }
    if (paid(p) > total(p) + 0.001) throw Error('A project has payments above its total.');
  }
  return s;
}

const extra = p => Math.max(0, p.revisions.length - p.revisionLimit);
const total = p => Math.round((p.fee + extra(p) * p.extraRate) * 100) / 100;
const paid = p => Math.round(p.payments.reduce((a, b) => a + b.amount, 0) * 100) / 100;
const balance = p => Math.round((total(p) - paid(p)) * 100) / 100;

// --- State Initialization ---
let state;
let storageOK = true;

try {
  const raw = localStorage.getItem(KEY);
  state = raw ? validateState(JSON.parse(raw)) : sample();
} catch (e) {
  state = sample();
  storageOK = false;
}

let view = 'projects';
let query = '';
let filter = 'All';
let sort = 'due';
let currentId = null;

// --- Formatting & Feedback ---
function money(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: state.settings.currency,
    maximumFractionDigits: 2
  }).format(n);
}

function date(v) {
  return new Date(v + 'T12:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function toast(s) {
  const el = $('#toast');
  el.textContent = s;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.hidden = true;
  }, 4200);
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOK = true;
    $('#save-status').textContent = state.mode === 'demo' ? 'Demo workspace' : 'Saved on this device';
    return true;
  } catch (e) {
    storageOK = false;
    $('#save-status').textContent = 'Not saved · export backup';
    toast('Browser storage is unavailable or full. Export a backup to keep your changes.');
    return false;
  }
}

function commit(next) {
  validateState(next);
  state = next;
  save();
  render();
}

function mutateProject(id, action) {
  const next = structuredClone(state);
  const p = next.projects.find(p => p.id === id);
  if (!p) throw Error('Project not found.');
  action(p);
  commit(next);
  return p;
}

// --- View Renderers ---
function banner() {
  return state.mode === 'demo'
    ? `<div class="banner"><div><strong>Explore a sample workspace</strong><span>These are example projects and payments. Start empty when you're ready.</span></div><button class="btn" id="start-workspace">Start my workspace</button></div>`
    : '';
}

function stats() {
  const active = state.projects.filter(p => p.status !== 'Delivered').length;
  const received = state.projects.reduce((a, p) => a + paid(p), 0);
  const owed = state.projects.reduce((a, p) => a + balance(p), 0);
  const late = state.projects.filter(p => p.status !== 'Delivered' && p.due < day()).length;
  return `<div class="stats">
    <div class="stat"><div class="stat-top">Active projects${icon('project')}</div><div class="stat-value">${active}</div><small>Brief, editing & review</small></div>
    <div class="stat"><div class="stat-top">Payments received${icon('check')}</div><div class="stat-value">${money(received)}</div><small>All recorded payments</small></div>
    <div class="stat focus"><div class="stat-top">Outstanding balance${icon('money')}</div><div class="stat-value">${money(owed)}</div><small>Includes extra revision charges</small></div>
    <div class="stat"><div class="stat-top">Overdue projects${icon('clock')}</div><div class="stat-value">${late}</div><small>Past deadline, not delivered</small></div>
  </div>`;
}

function card(p) {
  const late = p.status !== 'Delivered' && p.due < day();
  return `<article class="project">
    <div class="project-top">
      <div class="client"><span class="client-badge">${esc(p.client.slice(0, 2).toUpperCase())}</span>${esc(p.client)}</div>
      <span class="badge ${p.status.toLowerCase()}">${p.status}</span>
    </div>
    <h3>${esc(p.title)}</h3>
    <span class="type">${esc(p.type)}</span>
    <div class="project-meta">
      <span class="${late ? 'overdue' : ''}">${icon('date')}${late ? 'Overdue · ' : ''}${date(p.due)}</span>
      <span class="${extra(p) > 0 ? 'overdue' : ''}">${icon('revision')}${p.revisions.length}/${p.revisionLimit} revisions${extra(p) > 0 ? ' · ' + extra(p) + ' extra' : ''}</span>
    </div>
    <div class="revision-bar ${extra(p) > 0 ? 'exceeded' : ''}">
      <span style="width:${Math.min(100, p.revisionLimit ? (100 * p.revisions.length) / p.revisionLimit : p.revisions.length ? 100 : 0)}%"></span>
    </div>
    <div class="project-money">
      <div>
        <strong>${money(total(p))}</strong>
        <small>${balance(p) === 0 ? 'Paid in full' : money(balance(p)) + ' remaining'}</small>
      </div>
      <button class="btn" data-open="${esc(p.id)}">Open project</button>
    </div>
  </article>`;
}

function filtered() {
  return state.projects
    .filter(p => (filter === 'All' || p.status === filter) && `${p.title} ${p.client} ${p.type}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === 'balance' ? balance(b) - balance(a) : sort === 'newest' ? b.created.localeCompare(a.created) : a.due.localeCompare(b.due));
}

function cards() {
  const list = filtered();
  return list.length
    ? list.map(card).join('')
    : `<div class="empty">
        <h2>${state.projects.length ? 'No matching projects' : 'Your next project starts here'}</h2>
        <p>${state.projects.length ? 'Try another search or status.' : 'Add a client, agree on revision limits, and track your first payment.'}</p>
        ${state.projects.length ? '' : '<button class="btn primary" id="empty-new">Add your first project</button>'}
      </div>`;
}

function renderProjects() {
  return `
    <div class="heading">
      <div>
        <h1>Your edit queue</h1>
        <p class="subtitle">A clear view of what’s due, what’s changing, and what’s owed.</p>
      </div>
      <button class="btn primary" id="new-project">${icon('plus')}New project</button>
    </div>
    ${banner()}
    ${stats()}
    <div class="section-title">
      <h2>Projects <span class="count">${state.projects.length}</span></h2>
      <button class="text-btn" id="export-csv">Export CSV</button>
    </div>
    <div class="toolbar">
      <div class="search">${icon('search')}<input id="search" aria-label="Search projects or clients" placeholder="Search projects or clients…" value="${esc(query)}"></div>
      <div class="filters">
        <select id="status-filter" aria-label="Filter by status">
          ${['All', ...statuses].map(s => `<option ${s === filter ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select id="sort" aria-label="Sort projects">
          <option value="due" ${sort === 'due' ? 'selected' : ''}>Deadline first</option>
          <option value="balance" ${sort === 'balance' ? 'selected' : ''}>Highest balance</option>
          <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest first</option>
        </select>
      </div>
    </div>
    <div class="project-grid" id="cards">${cards()}</div>`;
}

function renderPayments() {
  const entries = state.projects.flatMap(p => p.payments.map(e => ({ ...e, project: p }))).sort((a, b) => b.date.localeCompare(a.date));
  const owing = state.projects.filter(p => balance(p) > 0).sort((a, b) => balance(b) - balance(a));
  return `
    <div class="heading">
      <div>
        <h1>Payments</h1>
        <p class="subtitle">Record payments and follow up on outstanding balances.</p>
      </div>
    </div>
    ${banner()}
    ${stats()}
    <h2 style="margin-bottom:18px">Awaiting payment</h2>
    ${owing.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>PROJECT / CLIENT</th><th>TOTAL</th><th>RECEIVED</th><th>REMAINING</th><th></th></tr></thead>
          <tbody>
            ${owing.map(p => `<tr>
              <td><strong>${esc(p.title)}</strong><small>${esc(p.client)}</small></td>
              <td>${money(total(p))}</td>
              <td>${money(paid(p))}</td>
              <td><strong>${money(balance(p))}</strong></td>
              <td><button class="btn" data-open="${esc(p.id)}">Record payment</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="panel muted">No outstanding balances.</div>'}
    <h2 style="margin:28px 0 18px">Payment history</h2>
    ${entries.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>DATE</th><th>PROJECT</th><th>NOTE</th><th>AMOUNT</th></tr></thead>
          <tbody>
            ${entries.map(e => `<tr>
              <td>${date(e.date)}</td>
              <td>${esc(e.project.title)}<small>${esc(e.project.client)}</small></td>
              <td>${esc(e.note) || '—'}</td>
              <td><strong>${money(e.amount)}</strong></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="panel muted">Payments you record inside a project will appear here.</div>'}`;
}

function renderSettings() {
  const s = state.settings;
  return `
    <div class="heading">
      <div>
        <h1>Workspace settings</h1>
        <p class="subtitle">Your details for invoices, plus backups you control.</p>
      </div>
    </div>
    ${banner()}
    <div class="settings-grid">
      <section class="panel">
        <h2>Your business</h2>
        <p class="subtitle" style="margin-bottom:22px">Used on printable invoices and payment reminders.</p>
        <form id="settings-form">
          <div class="form-grid">
            <div class="field wide">
              <label for="business-name">Business / editor name</label>
              <input id="business-name" name="name" maxlength="150" value="${esc(s.name)}" placeholder="Your name or studio">
            </div>
            <div class="field wide">
              <label for="business-email">Email or contact details</label>
              <input id="business-email" name="email" maxlength="200" value="${esc(s.email)}" placeholder="you@example.com">
            </div>
            <div class="field">
              <label for="currency">Currency</label>
              <select id="currency" name="currency">
                ${currencies.map(c => `<option ${s.currency === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
              <small>Changes the label, not the amounts. No exchange conversion.</small>
            </div>
            <div class="field">
              <label for="prefix">Invoice prefix</label>
              <input id="prefix" name="invoicePrefix" value="${esc(s.invoicePrefix)}" maxlength="20">
            </div>
            <div class="field wide">
              <label for="payment-instructions">Payment instructions</label>
              <textarea id="payment-instructions" name="paymentInstructions" maxlength="3000" placeholder="Payment method or account details you want clients to see">${esc(s.paymentInstructions)}</textarea>
              <small>Appears on invoices. CutDesk does not process payments.</small>
            </div>
          </div>
          <button class="btn primary" style="margin-top:20px">Save details</button>
        </form>
      </section>
      <section class="panel">
        <h2>Backups & offline use</h2>
        <p class="muted">Data stays in this browser on this device. It does not sync across devices. Clearing browser data may delete your workspace.</p>
        <div class="actions">
          <button class="btn primary" id="backup-settings">Export backup</button>
          <button class="btn" id="restore">Restore backup</button>
          <input id="restore-file" type="file" accept=".json,application/json" hidden>
        </div>
        <div class="notice">
          <p>Export after important updates. To move devices, open CutDesk there and restore your JSON backup. Restoring replaces the current workspace.</p>
        </div>
        <div class="detail-section">
          <h3>Keep a copy of the app</h3>
          <p class="muted">Open index.html in a modern browser. Keep it in the same folder and browser to preserve local data. Some browsers restrict storage for local files; backup export still works.</p>
          <a class="btn" href="index.html" download="CutDesk.html">Download offline app</a>
        </div>
        <div class="detail-section">
          <h3>Workspace</h3>
          <p class="muted">${state.mode === 'demo' ? 'You’re exploring sample data.' : 'You’re using your own workspace.'}</p>
          <button class="btn" id="load-demo">${state.mode === 'demo' ? 'Restart sample workspace' : 'Replace with sample workspace'}</button>
          <p class="subtitle">You’ll be asked before any data is replaced.</p>
        </div>
      </section>
    </div>`;
}

function render() {
  const content = $('#content');
  content.innerHTML = view === 'projects' ? renderProjects() : view === 'payments' ? renderPayments() : renderSettings();
  document.querySelectorAll('[data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
    b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
  });
  $('#save-status').textContent = !storageOK ? 'Not saved · export backup' : state.mode === 'demo' ? 'Demo workspace' : 'Saved on this device';
  $('#owner-name').textContent = state.settings.name || 'Independent editor';
  $('#owner-initial').textContent = state.settings.name ? state.settings.name.slice(0, 2).toUpperCase() : 'ME';
}

// --- Modals & Overlays ---
function openModal(title, subtitle, html) {
  $('#modal-title').textContent = title;
  $('#modal-subtitle').textContent = subtitle;
  $('#modal-body').innerHTML = html;
  if (!$('#modal').open) $('#modal').showModal();
}

function close() {
  $('#modal').close();
  currentId = null;
}

function error(s) {
  const e = $('#form-error');
  if (e) e.textContent = s;
  else toast(s);
}

function projectForm(id) {
  const p = id
    ? state.projects.find(p => p.id === id)
    : {
        title: '',
        client: '',
        email: '',
        type: 'Short-form video',
        due: offset(7),
        fee: '',
        revisionLimit: 2,
        extraRate: 0,
        status: 'Brief',
        brief: ''
      };
  if (!p) return;
  currentId = id || null;
  openModal(
    id ? 'Edit project' : 'New project',
    state.mode === 'demo' ? 'Sample workspace · switch to your own workspace when ready' : 'Set the scope before you start the edit.',
    `<form id="project-form" data-id="${esc(id || '')}">
      <div class="form-grid">
        <div class="field wide">
          <label for="title">Project title *</label>
          <input id="title" name="title" required maxlength="180" value="${esc(p.title)}" placeholder="e.g. Product launch · 3 reels">
        </div>
        <div class="field">
          <label for="client">Client name *</label>
          <input id="client" name="client" required maxlength="150" value="${esc(p.client)}">
        </div>
        <div class="field">
          <label for="client-email">Client email</label>
          <input id="client-email" name="email" type="email" maxlength="200" value="${esc(p.email)}">
        </div>
        <div class="field">
          <label for="type">Deliverable</label>
          <select id="type" name="type">
            ${['Short-form video', 'Long-form video', 'Thumbnail design', 'Stream assets', 'Other'].map(t => `<option ${t === p.type ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="due">Deadline *</label>
          <input id="due" name="due" type="date" required value="${esc(p.due)}">
        </div>
        <div class="field">
          <label for="fee">Base project fee (${state.settings.currency}) *</label>
          <input id="fee" name="fee" type="number" min="0" max="1000000000" step="0.01" required value="${p.fee}">
        </div>
        <div class="field">
          <label for="status">Status</label>
          <select id="status" name="status">
            ${statuses.map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="revision-limit">Included revision rounds</label>
          <input id="revision-limit" name="revisionLimit" type="number" min="0" max="1000" step="1" required value="${p.revisionLimit}">
        </div>
        <div class="field">
          <label for="extra-rate">Fee per extra round (${state.settings.currency})</label>
          <input id="extra-rate" name="extraRate" type="number" min="0" max="1000000000" step="0.01" required value="${p.extraRate}">
          <small>Agree this rate with the client first.</small>
        </div>
        <div class="field wide">
          <label for="brief">Scope & notes</label>
          <textarea id="brief" name="brief" maxlength="5000" placeholder="Deliverables, aspect ratio, agreed scope…">${esc(p.brief)}</textarea>
        </div>
      </div>
      <p id="form-error" class="error" role="alert"></p>
      <div class="actions">
        <button class="btn primary">${id ? 'Save changes' : 'Create project'}</button>
        <button class="btn" type="button" data-close>Cancel</button>
      </div>
    </form>`
  );
}

function openProject(id) {
  const p = state.projects.find(p => p.id === id);
  if (!p) return;
  currentId = id;
  openModal(
    p.title,
    p.client + ' · ' + p.type,
    `<div class="detail-head">
      <span class="badge ${p.status.toLowerCase()}">${p.status}</span>
      <button class="btn" data-edit="${esc(id)}">Edit details</button>
    </div>
    <div class="detail-kpis">
      <div><small>Project total</small><strong>${money(total(p))}</strong></div>
      <div><small>Received</small><strong>${money(paid(p))}</strong></div>
      <div><small>Remaining</small><strong>${money(balance(p))}</strong></div>
    </div>
    <div class="field">
      <label for="quick-status">Project status</label>
      <select id="quick-status" data-id="${esc(id)}">
        ${statuses.map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <p class="subtitle">Deadline: ${date(p.due)}</p>
    ${p.brief ? `<p class="project-note">${esc(p.brief)}</p>` : ''}
    <div class="actions">
      <button class="btn" id="invoice-button">Print invoice / save PDF</button>
      <button class="btn" id="reminder-button" ${balance(p) <= 0 ? 'disabled' : ''}>Copy payment reminder</button>
    </div>
    <section class="detail-section">
      <h3>Revisions · ${p.revisions.length} of ${p.revisionLimit} included</h3>
      ${extra(p) > 0 ? `<div class="notice warning" style="margin:0 0 13px">${extra(p)} extra round${extra(p) > 1 ? 's' : ''} × ${money(p.extraRate)} =${money(extra(p) * p.extraRate)} added to the total.</div>` : ''}
      <form id="revision-form">
        <div class="field">
          <label for="revision-note">Feedback for this round</label>
          <input id="revision-note" name="note" maxlength="1000" placeholder="e.g. Replace music and shorten intro" required>
        </div>
        <button class="btn" style="margin-top:10px">Log revision${p.revisions.length >= p.revisionLimit && p.extraRate > 0 ? ' · +' + money(p.extraRate) : ''}</button>
      </form>
      ${p.revisions.length ? `<ul class="history">${[...p.revisions].reverse().map(e => `<li><span>${esc(e.note)}<br><small>${date(e.date)}</small></span><button class="text-btn" data-remove-revision="${esc(e.id)}">Remove</button></li>`).join('')}</ul>` : '<p class="subtitle">No revision rounds logged yet.</p>'}
    </section>
    <section class="detail-section">
      <h3>Payments received</h3>
      ${balance(p) > 0 ? `
        <form id="payment-form">
          <div class="form-grid">
            <div class="field">
              <label for="amount">Amount (${state.settings.currency})</label>
              <input id="amount" name="amount" type="number" min="0.01" max="${balance(p)}" step="0.01" required placeholder="${balance(p)}">
            </div>
            <div class="field">
              <label for="payment-date">Date received</label>
              <input id="payment-date" name="date" type="date" value="${day()}" required>
            </div>
            <div class="field wide">
              <label for="payment-note">Note (optional)</label>
              <input id="payment-note" name="note" maxlength="1000" placeholder="Advance, final payment, UPI reference…">
            </div>
          </div>
          <button class="btn primary" style="margin-top:12px">Record payment</button>
          <p class="subtitle">Record money already received. This does not charge the client.</p>
        </form>` : '<div class="notice" style="margin:0">Paid in full.</div>'}
      ${p.payments.length ? `<ul class="history">${[...p.payments].reverse().map(e => `<li><span><strong>${money(e.amount)}</strong> · ${esc(e.note) || 'Payment'}<br><small>${date(e.date)}</small></span><button class="text-btn" data-remove-payment="${esc(e.id)}">Remove</button></li>`).join('')}</ul>` : ''}
    </section>
    <p id="form-error" class="error" role="alert"></p>
    <section class="detail-section">
      <button class="btn danger" id="delete-project">Delete project</button>
    </section>`
  );
}

// --- File Exports & External APIs ---
function download(name, body, type) {
  const blob = new Blob([body], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

function backup() {
  download('CutDesk-backup-' + day() + '.json', JSON.stringify(state, null, 2), 'application/json');
  toast('Backup exported. Keep this file somewhere safe.');
}

function csv() {
  const safe = v => {
    let s = String(v ?? '');
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const rows = [
    ['Project', 'Client', 'Status', 'Deadline', 'Currency', 'Base fee', 'Revisions used', 'Included revisions', 'Extra revision fee', 'Total', 'Received', 'Remaining'],
    ...state.projects.map(p => [
      p.title,
      p.client,
      p.status,
      p.due,
      state.settings.currency,
      p.fee,
      p.revisions.length,
      p.revisionLimit,
      p.extraRate,
      total(p),
      paid(p),
      balance(p)
    ])
  ];
  download('CutDesk-projects-' + day() + '.csv', '\uFEFF' + rows.map(r => r.map(safe).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  toast('Project summary exported.');
}

async function copy(s) {
  try {
    await navigator.clipboard.writeText(s);
    toast('Reminder copied. Review it before sending.');
  } catch (e) {
    openModal(
      'Payment reminder',
      'Copy this message and send it yourself.',
      `<textarea id="copy-text" style="width:100%;min-height:200px" readonly>${esc(s)}</textarea>
      <div class="actions"><button class="btn" data-close>Close</button></div>`
    );
    $('#copy-text').select();
  }
}

function printInvoice(p) {
  const s = state.settings;
  const ref = (s.invoicePrefix || 'CD') + '-' + p.id.slice(0, 8).toUpperCase();
  $('#invoice').innerHTML = `
    <div class="invoice-top">
      <div>
        <h1>${esc(s.name || 'Independent editor')}</h1>
        <p>${esc(s.email)}</p>
      </div>
      <div>
        <h2>INVOICE</h2>
        <p>${esc(ref)}<br>Issued ${date(day())}</p>
      </div>
    </div>
    <hr style="border:0;border-top:1px solid #ddd;margin:24px 0">
    <p><strong>Bill to</strong><br>${esc(p.client)}${p.email ? '<br>' + esc(p.email) : ''}</p>
    <p><strong>${esc(p.title)}</strong><br>${esc(p.type)}</p>
    <table>
      <thead><tr><th>DESCRIPTION</th><th>AMOUNT (${s.currency})</th></tr></thead>
      <tbody>
        <tr><td>Project fee · ${p.revisionLimit} revision rounds included</td><td>${money(p.fee)}</td></tr>
        ${extra(p) > 0 ? `<tr><td>${extra(p)} extra revision rounds × ${money(p.extraRate)}</td><td>${money(extra(p) * p.extraRate)}</td></tr>` : ''}
      </tbody>
    </table>
    <div class="invoice-total">
      <p>Total: <strong>${money(total(p))}</strong><br>Payments received: ${money(paid(p))}<br><strong>Balance due: ${money(balance(p))}</strong></p>
    </div>
    ${p.payments.length ? `<p><strong>Recorded payments</strong><br>${p.payments.map(e => `${date(e.date)} · ${money(e.amount)}${e.note ? ' · ' + esc(e.note) : ''}`).join('<br>')}</p>` : ''}
    ${s.paymentInstructions ? `<p><strong>Payment instructions</strong><br>${esc(s.paymentInstructions)}</p>` : ''}
    <p style="font-size:12px;color:#555">Currency: ${s.currency}. No tax has been calculated. Confirm required billing and tax details before issuing.</p>`;
  
  const wasOpen = $('#modal').open;
  if (wasOpen) $('#modal').close();
  window.print();
  if (wasOpen && !$('#modal').open) $('#modal').showModal();
}

function confirmModal(title, message, action) {
  openModal(
    title,
    message,
    `<p class="muted">${esc(message)}</p>
    <div class="actions">
      <button class="btn danger" id="confirm-action">Confirm</button>
      <button class="btn" data-close>Cancel</button>
    </div>`
  );
  $('#confirm-action').onclick = () => {
    action();
    close();
  };
}

function newWorkspace() {
  confirmModal(
    'Start your workspace?',
    'This removes the sample projects and starts an empty workspace. Export a backup first if you want to keep your demo edits.',
    () => {
      commit(defaults());
      toast('Your workspace is ready. Add your first project.');
    }
  );
}

// --- Event Listeners ---
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;

  if (b.dataset.view) {
    view = b.dataset.view;
    render();
    return;
  }
  if (b.dataset.open) {
    openProject(b.dataset.open);
    return;
  }
  if (b.dataset.edit) {
    projectForm(b.dataset.edit);
    return;
  }
  if (b.hasAttribute('data-close')) {
    close();
    return;
  }

  if (b.dataset.removeRevision || b.dataset.removePayment) {
    const id = currentId;
    const key = b.dataset.removeRevision ? 'revisions' : 'payments';
    const entry = b.dataset.removeRevision || b.dataset.removePayment;
    const p = state.projects.find(p => p.id === id);
    if (!p) return;
    const next = structuredClone(state);
    const np = next.projects.find(p => p.id === id);
    np[key] = np[key].filter(x => x.id !== entry);
    try {
      validateState(next);
    } catch (er) {
      error('This would make received payments exceed the project total. Correct the payment history first.');
      return;
    }
    confirmModal(
      'Remove this ' + (key === 'revisions' ? 'revision' : 'payment') + '?',
      'The history entry will be removed and totals recalculated.',
      () => {
        commit(next);
        setTimeout(() => openProject(id), 0);
      }
    );
    return;
  }

  switch (b.id) {
    case 'new-project':
    case 'empty-new':
      projectForm();
      break;
    case 'close-modal':
      close();
      break;
    case 'backup-top':
    case 'backup-settings':
      backup();
      break;
    case 'start-workspace':
      newWorkspace();
      break;
    case 'export-csv':
      csv();
      break;
    case 'load-demo':
      confirmModal(
        'Replace with sample data?',
        'Export a backup first. This replaces your projects and settings with examples.',
        () => {
          commit(sample());
          toast('Sample workspace loaded.');
        }
      );
      break;
    case 'restore':
      $('#restore-file').click();
      break;
    case 'invoice-button':
      printInvoice(state.projects.find(p => p.id === currentId));
      break;
    case 'reminder-button': {
      const p = state.projects.find(p => p.id === currentId);
      copy(
        `Hi ${p.client}, a quick reminder about the ${money(balance(p))} remaining for “${p.title}”. The total is ${money(total(p))}, with ${money(paid(p))} received so far.${state.settings.paymentInstructions ? '\n\nPayment details: ' + state.settings.paymentInstructions : ''}\n\nThank you${state.settings.name ? ' — ' + state.settings.name : ''}!`
      );
      break;
    }
    case 'delete-project': {
      const id = currentId;
      confirmModal(
        'Delete this project?',
        'This deletes the project, its revisions and all payment entries. Export a backup first if needed.',
        () => {
          const next = structuredClone(state);
          next.projects = next.projects.filter(p => p.id !== id);
          commit(next);
          toast('Project deleted.');
        }
      );
      break;
    }
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'search') {
    query = e.target.value;
    $('#cards').innerHTML = cards();
  }
});

document.addEventListener('change', async e => {
  if (e.target.id === 'status-filter') {
    filter = e.target.value;
    render();
  }
  if (e.target.id === 'sort') {
    sort = e.target.value;
    render();
  }
  if (e.target.id === 'quick-status') {
    const id = e.target.dataset.id;
    mutateProject(id, p => (p.status = e.target.value));
    toast('Status updated.');
  }
  if (e.target.id === 'restore-file') {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw Error('Backup is too large (maximum 10 MB).');
      const next = validateState(JSON.parse(await file.text()));
      confirmModal(
        'Restore this backup?',
        `${next.projects.length} projects will replace this workspace. Export your current backup first if needed.`,
        () => {
          commit(next);
          toast('Backup restored.');
        }
      );
    } catch (er) {
      toast(er.message || 'Unable to read this backup.');
    }
  }
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  if (!f.matches('form')) return;
  const d = Object.fromEntries(new FormData(f));

  try {
    if (f.id === 'project-form') {
      const id = f.dataset.id;
      const next = structuredClone(state);
      let p = id ? next.projects.find(p => p.id === id) : { id: uid(), created: day(), revisions: [], payments: [] };
      if (!p) throw Error('Project not found.');
      Object.assign(p, {
        title: d.title.trim(),
        client: d.client.trim(),
        email: d.email.trim(),
        type: d.type,
        due: d.due,
        fee: Number(d.fee),
        revisionLimit: Number(d.revisionLimit),
        extraRate: Number(d.extraRate),
        status: d.status,
        brief: d.brief.trim()
      });
      if (!id) next.projects.push(p);
      commit(next);
      close();
      toast(id ? 'Project updated.' : 'Project created.');
    }

    if (f.id === 'revision-form') {
      const id = currentId;
      if (!d.note.trim()) throw Error('Describe this revision round.');
      mutateProject(id, p => p.revisions.push({ id: uid(), date: day(), note: d.note.trim() }));
      openProject(id);
      toast('Revision logged.');
    }

    if (f.id === 'payment-form') {
      const id = currentId;
      const amount = Number(d.amount);
      if (!finite(amount) || amount <= 0 || !validDate(d.date) || d.date > day()) {
        throw Error('Enter a valid received amount and a date no later than today.');
      }
      mutateProject(id, p => {
        if (amount > balance(p)) throw Error('Payment cannot exceed the remaining balance.');
        p.payments.push({ id: uid(), amount, date: d.date, note: d.note.trim() });
      });
      openProject(id);
      toast('Payment recorded.');
    }

    if (f.id === 'settings-form') {
      if (d.currency !== state.settings.currency && state.projects.length && !confirm('Change all currency labels? Amounts will stay the same; no conversion will be applied.')) {
        return;
      }
      const next = structuredClone(state);
      next.settings = {
        name: d.name.trim(),
        email: d.email.trim(),
        currency: d.currency,
        paymentInstructions: d.paymentInstructions.trim(),
        invoicePrefix: d.invoicePrefix.trim() || 'CD'
      };
      commit(next);
      toast('Business details saved.');
    }
  } catch (er) {
    error(er.message || 'Unable to save.');
  }
});

$('#modal').addEventListener('click', e => {
  if (e.target === $('#modal')) {
    const r = $('#modal').getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
  }
});

// --- Boot Strapping ---
$('#today').textContent = new Date().toLocaleDateString('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

if (location.protocol === 'file:') {
  document.querySelectorAll('a[download]').forEach(a => {
    a.href = location.href;
    a.textContent = 'Save a copy of this app';
  });
}

render();

if (!storageOK) {
  toast('Stored data could not be loaded. The app is showing sample data. Restore a backup; export before making changes.');
}

// --- Browser Agent Protocol Registration (Model Context) ---
const mc = document.modelContext;
const lifecycle = new AbortController();

if (mc?.registerTool) {
  for (const tool of [
    {
      name: 'list_editor_projects',
      title: 'List editor projects',
      description: 'Read the current local workspace projects and calculated balances.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== 'object' || Object.keys(input).length) throw Error('Expected an empty object.');
        return {
          mode: state.mode,
          currency: state.settings.currency,
          projects: state.projects.map(p => ({
            id: p.id,
            title: p.title,
            client: p.client,
            status: p.status,
            due: p.due,
            total: total(p),
            received: paid(p),
            remaining: balance(p)
          }))
        };
      }
    },
    {
      name: 'update_editor_project_status',
      title: 'Update project status',
      description: 'Save a project status in the local workspace and update the visible interface.',
      inputSchema: {
        type: 'object',
        properties: { projectId: { type: 'string' }, status: { type: 'string', enum: statuses } },
        required: ['projectId', 'status'],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Object.keys(input).some(k => !['projectId', 'status'].includes(k)) || typeof input.projectId !== 'string' || !statuses.includes(input.status)) {
          throw Error('Invalid project ID or status.');
        }
        const p = mutateProject(input.projectId, p => (p.status = input.status));
        if (currentId === p.id) openProject(p.id);
        return { id: p.id, status: p.status, saved: storageOK };
      }
    }
  ]) {
    try {
      Promise.resolve(mc.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
    } catch (e) {}
  }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}