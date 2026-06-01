/*
 * app.js — Wiring: state, tab routing, generic input binding, autosave, chart.
 */
(function (global) {
  'use strict';

  var S = global.RetStorage;
  var UI = global.UI;
  var state = S.load();
  state.now = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
  var chart = null;
  // Dashboard accent palette — bright lines that read on the dark grid.
  var CHART_COLORS = ['#2dd4bf', '#34d399', '#fbbf24', '#fb7185', '#22d3ee', '#a3e635', '#f472b6'];
  var CHART_INK = '#aab6c8', CHART_GRID = 'rgba(43, 53, 74, 0.6)', CHART_PANEL = '#0d1219';

  function genId() { return 'sc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }

  function setByPath(obj, path, value) {
    var parts = path.split('.');
    var o = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] == null) o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
  }

  function editingScenario() {
    return state.scenarios.filter(function (s) { return s.id === state.editingId; })[0];
  }

  function persist() {
    var clean = JSON.parse(JSON.stringify(state));
    delete clean.now;
    S.save(clean, flagSaved);
  }
  function flagSaved(ok) {
    var el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = ok ? 'Saved ✓' : 'Save failed';
    el.className = 'save-status' + (ok ? ' ok' : ' err');
    if (ok) { clearTimeout(flagSaved._t); flagSaved._t = setTimeout(function () { el.textContent = 'All changes saved'; }, 1200); }
  }

  /* ------------------------------ rendering ------------------------------ */
  function render() {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === state.activeTab);
    });
    var main = document.getElementById('main');
    if (state.activeTab === 'settings') main.innerHTML = UI.renderSettings(state);
    else if (state.activeTab === 'scenarios') main.innerHTML = UI.renderScenarios(state);
    else main.innerHTML = UI.renderDashboard(state);

    if (state.activeTab === 'dashboard') drawChart();
  }

  function refreshLive() {
    // Update derived views without rebuilding focused form inputs.
    if (state.activeTab === 'dashboard') {
      var card = document.querySelector('#main .card:nth-child(2)');
      // simplest: re-render dashboard (no text inputs that hold focus there)
      render();
    } else if (state.activeTab === 'scenarios') {
      var box = document.getElementById('editor-summary');
      var s = editingScenario();
      if (box && s) box.innerHTML = UI.renderMiniSummary(state, s);
    }
  }

  function drawChart() {
    var canvas = document.getElementById('balanceChart');
    if (!canvas) return;
    if (typeof Chart === 'undefined') {
      // Chart.js loads from a CDN; if it's unavailable (e.g. offline), say so
      // rather than leaving a blank box that looks broken.
      var wrap = canvas.parentNode;
      if (wrap) wrap.innerHTML = '<div class="chart-fallback">The chart needs an internet connection to load. ' +
        'Your numbers and comparisons above still work offline.</div>';
      return;
    }
    var selected = state.scenarios.filter(function (s) { return state.selectedScenarioIds.indexOf(s.id) >= 0; });
    if (chart) { chart.destroy(); chart = null; }
    if (!selected.length) return;

    // Align on a shared set of years using each scenario's age axis.
    var datasets = selected.map(function (s, i) {
      var r = global.RetEngine.projectScenario(s, state.settings, { now: state.now });
      var color = CHART_COLORS[i % CHART_COLORS.length];
      return {
        label: s.name,
        data: r.rows.map(function (row) { return { x: row.age, y: row.balance }; }),
        borderColor: color, backgroundColor: color, pointBackgroundColor: color,
        tension: 0.25, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2
      };
    });

    chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        color: CHART_INK,
        font: { family: "'JetBrains Mono', monospace" },
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'YOUR AGE', color: CHART_INK },
               ticks: { stepSize: 5, color: CHART_INK }, grid: { color: CHART_GRID, drawTicks: false },
               border: { color: CHART_GRID } },
          y: { title: { display: true, text: 'PORTFOLIO BALANCE', color: CHART_INK },
               ticks: { color: CHART_INK, callback: function (v) { return '$' + (v / 1000).toLocaleString() + 'k'; } },
               grid: { color: CHART_GRID, drawTicks: false }, border: { color: CHART_GRID } }
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: CHART_INK, usePointStyle: true, pointStyle: 'line', boxWidth: 24, padding: 16 } },
          tooltip: {
            backgroundColor: CHART_PANEL, borderColor: 'rgba(45,212,191,0.4)', borderWidth: 1,
            titleColor: '#e6edf6', bodyColor: '#aab6c8', padding: 10, cornerRadius: 6,
            callbacks: { label: function (c) { return c.dataset.label + ': ' + UI.fmtMoney(c.parsed.y) + ' (age ' + Math.round(c.parsed.x) + ')'; } }
          }
        }
      }
    });
  }

  /* ------------------------------ scenarios ------------------------------ */
  function newScenario() {
    return {
      id: genId(),
      name: 'Scenario ' + (state.scenarios.length + 1),
      notes: '',
      startingBalance: '',
      retireAge: 65,
      claimAgeA: 67, claimAgeB: 67,
      monthlyContribution: '',
      retirementSpending: '',
      contributionChanges: [],
      lumpSums: [],
      extraIncome: []
    };
  }

  function addScenario() {
    var s = newScenario();
    state.scenarios.push(s);
    state.editingId = s.id;
    if (state.selectedScenarioIds.indexOf(s.id) < 0) state.selectedScenarioIds.push(s.id);
    persist(); render();
  }
  function duplicateScenario(id) {
    var orig = state.scenarios.filter(function (s) { return s.id === id; })[0];
    if (!orig) return;
    var copy = JSON.parse(JSON.stringify(orig));
    copy.id = genId();
    copy.name = orig.name + ' (copy)';
    state.scenarios.push(copy);
    state.editingId = copy.id;
    state.selectedScenarioIds.push(copy.id);
    persist(); render();
  }
  function deleteScenario(id) {
    var s = state.scenarios.filter(function (x) { return x.id === id; })[0];
    if (!s || !confirm('Delete scenario "' + s.name + '"? This cannot be undone.')) return;
    state.scenarios = state.scenarios.filter(function (x) { return x.id !== id; });
    state.selectedScenarioIds = state.selectedScenarioIds.filter(function (x) { return x !== id; });
    if (state.editingId === id) state.editingId = null;
    persist(); render();
  }
  function renameScenario(id) {
    var s = state.scenarios.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    var name = prompt('Rename scenario:', s.name);
    if (name == null) return;
    s.name = name.trim() || s.name;
    persist(); render();
  }

  /* ------------------------------- events -------------------------------- */
  function onFieldChange(e) {
    var t = e.target;
    if (!t.dataset || !t.dataset.path) return;
    var value = t.type === 'checkbox' ? t.checked : t.value;
    if (t.dataset.scope === 'settings') {
      setByPath(state, t.dataset.path, value);
    } else {
      var s = editingScenario();
      if (!s) return;
      setByPath(s, t.dataset.path, value);
    }
    persist();
    refreshLive();
  }

  function onClick(e) {
    var btn = e.target.closest('[data-action], [data-tab]');
    if (!btn) return;

    if (btn.dataset.tab) {
      state.activeTab = btn.dataset.tab;
      persist(); render(); return;
    }

    var action = btn.dataset.action;
    var id = btn.dataset.id;
    switch (action) {
      case 'add-scenario': addScenario(); break;
      case 'edit-scenario': state.editingId = id; persist(); render(); break;
      case 'duplicate-scenario': duplicateScenario(id); break;
      case 'delete-scenario': deleteScenario(id); break;
      case 'rename-scenario': renameScenario(id); break;
      case 'close-editor': state.editingId = null; persist(); render(); break;
      case 'add-row': {
        var s = editingScenario();
        if (s) { s[btn.dataset.list] = s[btn.dataset.list] || []; s[btn.dataset.list].push(defaultRow(btn.dataset.list)); persist(); render(); }
        break;
      }
      case 'remove-row': {
        var sc = editingScenario();
        if (sc) { sc[btn.dataset.list].splice(+btn.dataset.index, 1); persist(); render(); }
        break;
      }
      case 'backup-download': S.exportFile(stripState()); break;
      case 'backup-restore': document.getElementById('restore-input').click(); break;
    }
  }

  function defaultRow(list) {
    var now = state.now;
    if (list === 'lumpSums') return { month: now.month, year: now.year + 1, amount: '', label: '' };
    if (list === 'contributionChanges') return { month: now.month, year: now.year + 1, newMonthly: '' };
    if (list === 'extraIncome') return { label: '', monthly: '', startMonth: now.month, startYear: now.year, endMonth: 12, endYear: '', taxable: false, colaPct: 0 };
    return {};
  }

  function onToggleSelect(e) {
    var t = e.target;
    if (!(t.dataset && t.dataset.action === 'toggle-select')) return;
    var id = t.dataset.id;
    if (t.checked) { if (state.selectedScenarioIds.indexOf(id) < 0) state.selectedScenarioIds.push(id); }
    else state.selectedScenarioIds = state.selectedScenarioIds.filter(function (x) { return x !== id; });
    persist(); render();
  }

  function stripState() { var c = JSON.parse(JSON.stringify(state)); delete c.now; return c; }

  function onRestore(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    S.importFile(file, function (err, data) {
      if (err) { alert('Could not read that file: ' + err.message); return; }
      if (!confirm('Restore from backup? This replaces all current data.')) return;
      var now = state.now;
      state = Object.assign(S.defaultState(), data);
      state.now = now;
      persist(); render();
    });
    e.target.value = '';
  }

  /* -------------------------------- init --------------------------------- */
  function init() {
    document.addEventListener('input', onFieldChange);
    document.addEventListener('change', function (e) {
      if (e.target.dataset && e.target.dataset.action === 'toggle-select') onToggleSelect(e);
      else if (e.target.id === 'restore-input') onRestore(e);
      else onFieldChange(e); // selects & checkboxes
    });
    document.addEventListener('click', onClick);
    render();
    flagSaved(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
