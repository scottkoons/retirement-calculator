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
  // Dashboard accent palette — distinct lines that read on either theme.
  var CHART_COLORS = ['#14b8a6', '#f59e0b', '#6366f1', '#ec4899', '#0891b2', '#84cc16', '#ef4444'];
  // Stable per-scenario accent colors (chart lines + chips). Orange leads so a
  // single-scenario chart matches the dashboard's accent.
  var SCENARIO_COLORS = ['#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#3b82f6', '#84cc16', '#ef4444', '#06b6d4'];
  function ensureScenarioColors() {
    (state.scenarios || []).forEach(function (s, i) {
      if (!s.color) s.color = SCENARIO_COLORS[i % SCENARIO_COLORS.length];
    });
  }
  // Chart text/grid/panel pull from the active theme's CSS variables.
  function themeVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }

  function genId() { return 'sc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }

  // "#rrggbb" -> "rgba(r,g,b,a)" for chart gradients.
  function hexToRgba(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

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
    ensureScenarioColors();
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
      var s = editingScenario();
      if (!s) return;
      var box = document.getElementById('editor-summary');
      if (box) box.innerHTML = UI.renderMiniSummary(state, s);
      // Refresh computed cells (Total, lump-sum total) without rebuilding inputs.
      UI.refreshComputedCells(state, s);
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

    // Soft top-down gradient under each line, fading to transparent — the
    // "shaded area" look. Lighter when comparing several so they don't muddy.
    var topAlpha = selected.length > 1 ? 0.16 : 0.4;
    function areaFill(color) {
      return function (ctx) {
        var c = ctx.chart, area = c.chartArea;
        if (!area) return hexToRgba(color, topAlpha * 0.5);
        var g = c.ctx.createLinearGradient(0, area.top, 0, area.bottom);
        g.addColorStop(0, hexToRgba(color, topAlpha));
        g.addColorStop(1, hexToRgba(color, 0));
        return g;
      };
    }

    // Align on a shared set of years using each scenario's age axis.
    var real = state.dollarBasis === 'real';
    var yKey = real ? 'balanceReal' : 'balance';
    var datasets = selected.map(function (s, i) {
      var r = global.RetEngine.projectScenario(s, state.settings, { now: state.now });
      var color = s.color || CHART_COLORS[i % CHART_COLORS.length];
      return {
        label: s.name,
        data: r.rows.map(function (row) { return { x: row.age, y: row[yKey] }; }),
        borderColor: color, pointBackgroundColor: color,
        backgroundColor: areaFill(color), fill: 'origin',
        tension: 0.35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2.5
      };
    });

    var INK = themeVar('--muted', '#aab6c8');
    var GRID = themeVar('--line', '#20293a');
    var PANEL = themeVar('--panel', '#0d1219');
    var TITLE = themeVar('--ink', '#e6edf6');
    chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        color: INK,
        font: { family: "'JetBrains Mono', monospace" },
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'YOUR AGE', color: INK },
               ticks: { stepSize: 5, color: INK }, grid: { color: GRID, drawTicks: false },
               border: { color: GRID } },
          y: { title: { display: true, text: real ? "PORTFOLIO BALANCE (TODAY'S $)" : 'PORTFOLIO BALANCE', color: INK },
               ticks: { color: INK, callback: function (v) { return '$' + (v / 1000).toLocaleString() + 'k'; } },
               grid: { color: GRID, drawTicks: false }, border: { color: GRID } }
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: INK, usePointStyle: true, pointStyle: 'line', boxWidth: 24, padding: 16 } },
          tooltip: {
            backgroundColor: PANEL, borderColor: themeVar('--cyan', '#2dd4bf'), borderWidth: 1,
            titleColor: TITLE, bodyColor: INK, padding: 10, cornerRadius: 6,
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
      color: SCENARIO_COLORS[state.scenarios.length % SCENARIO_COLORS.length],
      notes: '',
      startingBalance: '',
      retireAge: 65,
      claimAgeA: 67, claimAgeB: 67,
      retirementSpending: '',
      contributionPeriods: [],
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
  // Dashboard headline sliders (retirement age / average return). While
  // dragging we update the big number + redraw the chart in place; on release
  // ('change') we re-render so the comparison table picks up the new values.
  function onStatSlider(e) {
    var t = e.target;
    var val = t.value;
    if (t.dataset.stat === 'returnPct') {
      setByPath(state, 'settings.assumptions.returnPct', val);
    } else if (t.dataset.stat === 'retireAge') {
      var sc = state.scenarios.filter(function (x) { return x.id === t.dataset.id; })[0];
      if (sc) sc.retireAge = val;
    }
    persist();
    if (e.type === 'change') { render(); return; }
    updateStatNumbers();
    if (state.activeTab === 'dashboard') drawChart();
  }

  // Refresh just the three big numbers from current state (no DOM rebuild, so
  // the slider keeps the drag).
  function updateStatNumbers() {
    var d = UI.dashboardStats(state);
    var map = {
      retireAge: d.age, returnPct: d.ret, start: d.start,
      balance: d.balance, monthly: d.monthly, annual: d.annual, ageEcho: d.age
    };
    document.querySelectorAll('[data-stat-val]').forEach(function (el) {
      var k = el.dataset.statVal;
      if (map[k] != null) el.textContent = map[k];
    });
  }

  function onFieldChange(e) {
    var t = e.target;
    if (t.dataset && t.dataset.stat) { onStatSlider(e); return; }
    if (!t.dataset || !t.dataset.path) return;
    var value = t.type === 'checkbox' ? t.checked : t.value;

    // Money fields: live thousands-separators, whole dollars only. Store the raw
    // integer in state, but show the formatted string and keep the caret sane.
    if (t.classList && t.classList.contains('money')) {
      var raw = t.value;
      var neg = /^\s*-/.test(raw);
      var digits = raw.replace(/[^\d]/g, '');
      var rawNum = digits ? (neg ? '-' : '') + String(Number(digits)) : '';
      var formatted = UI.fmtThousands(rawNum);
      // reposition caret: keep the count of digits to the left of the cursor
      var pos = t.selectionStart || 0;
      var digitsLeft = (raw.slice(0, pos).match(/\d/g) || []).length;
      t.value = formatted;
      if (e.type === 'input') {
        var newPos = 0, seen = 0;
        for (; newPos < formatted.length && seen < digitsLeft; newPos++) {
          if (/\d/.test(formatted[newPos])) seen++;
        }
        try { t.setSelectionRange(newPos, newPos); } catch (x) {}
      }
      value = rawNum; // store unformatted integer
    }

    if (t.dataset.scope === 'settings') {
      setByPath(state, t.dataset.path, value);
    } else {
      var s = editingScenario();
      if (!s) return;
      setByPath(s, t.dataset.path, value);

      // When a contribution period's Start/End is committed, reshape the timeline
      // so periods never overlap. Only re-render if the clamp actually changed
      // something (reorder or a clamped end) — otherwise nothing should move.
      if (e.type === 'change' && /^contributionPeriods\.\d+\.(start|end)(Month|Year)$/.test(t.dataset.path)) {
        var before = JSON.stringify(s.contributionPeriods);
        s.contributionPeriods = global.RetEngine.clampContributionPeriods(s.contributionPeriods);
        persist();
        if (JSON.stringify(s.contributionPeriods) !== before) rerenderEditor();
        else refreshLive();
        return;
      }
      // Same no-overlap reshape for return phases when From/To age is committed.
      if (e.type === 'change' && /^returnPhases\.\d+\.(from|to)Age$/.test(t.dataset.path)) {
        var beforeP = JSON.stringify(s.returnPhases);
        s.returnPhases = global.RetEngine.clampReturnPhases(s.returnPhases);
        persist();
        if (JSON.stringify(s.returnPhases) !== beforeP) rerenderEditor();
        else refreshLive();
        return;
      }
    }
    persist();
    refreshLive();
  }

  // Rebuild only the Scenarios pane in place — no full re-render, no fade — so
  // committing a date doesn't blink the whole screen. Restores focus to the
  // field the user was on if possible.
  function rerenderEditor() {
    if (state.activeTab !== 'scenarios') { render(); return; }
    var active = document.activeElement;
    var path = active && active.dataset ? active.dataset.path : null;
    var main = document.getElementById('main');
    main.innerHTML = UI.renderScenarios(state);
    var pane = main.querySelector('.tab-pane');
    if (pane) pane.classList.add('no-anim');
    if (path) {
      var again = main.querySelector('[data-path="' + path.replace(/"/g, '\\"') + '"]');
      if (again) { try { again.focus({ preventScroll: true }); } catch (x) { try { again.focus(); } catch (y) {} } }
    }
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
      case 'pill-edit': state.activeTab = 'scenarios'; state.editingId = id; persist(); render(); break;
      case 'chip-select': {
        // Toggle a scenario in/out of the dashboard comparison.
        var ix = state.selectedScenarioIds.indexOf(id);
        if (ix >= 0) state.selectedScenarioIds.splice(ix, 1);
        else state.selectedScenarioIds.push(id);
        persist(); render();
        break;
      }
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
      case 'set-basis': state.dollarBasis = btn.dataset.basis; persist(); render(); break;
      case 'sort': sortList(btn.dataset.sortList, btn.dataset.sortKey); break;
      case 'toggle-theme': toggleTheme(); break;
      case 'backup-download': S.exportFile(stripState()); break;
      case 'backup-restore': document.getElementById('restore-input').click(); break;
    }
  }

  function applyTheme() {
    var t = state.theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    var ico = document.querySelector('.theme-ico');
    // show the icon for the theme you'd switch TO
    if (ico) ico.textContent = t === 'light' ? '🌙' : '☀';
    if (chart && state.activeTab === 'dashboard') { drawChart(); }
  }
  function toggleTheme() {
    state.theme = (state.theme === 'light') ? 'dark' : 'light';
    persist(); applyTheme();
  }

  function defaultRow(list) {
    var now = state.now;
    if (list === 'lumpSums') return { month: now.month, year: now.year + 1, amount: '', label: '' };
    if (list === 'contributionPeriods') return contribDefault();
    if (list === 'extraIncome') return { label: '', monthly: '', startMonth: now.month, startYear: now.year, endMonth: 12, endYear: '', taxable: false, colaPct: 0 };
    if (list === 'returnPhases') return returnPhaseDefault();
    return {};
  }

  // A new return phase starts where the latest phase ends (or at the person's
  // current age), with a blank "to age" so it runs to the end until another follows.
  function returnPhaseDefault() {
    var s = editingScenario();
    var base = (state.settings.assumptions || {}).returnPct;
    var pa = state.settings.personA || {};
    var nowAbs = global.RetEngine._helpers.toAbs(state.now.month, state.now.year);
    var curAge = pa.birthYear ? Math.floor((nowAbs - (pa.birthYear * 12 + ((pa.birthMonth || 1) - 1))) / 12) : 50;
    var fromAge = curAge;
    if (s && (s.returnPhases || []).length) {
      var maxTo = -Infinity;
      s.returnPhases.forEach(function (p) {
        var t = (p.toAge == null || p.toAge === '') ? (p.fromAge != null ? +p.fromAge + 10 : -Infinity) : +p.toAge;
        if (t > maxTo) maxTo = t;
      });
      if (isFinite(maxTo)) fromAge = maxTo;
    }
    return { label: '', fromAge: fromAge, toAge: '', returnPct: base != null ? base : 6 };
  }

  // A new contribution period starts the month after the latest existing period
  // (or now), with a blank end so it runs to retirement until another follows it.
  function contribDefault() {
    var now = state.now;
    var s = editingScenario();
    var startM = now.month, startY = now.year;
    if (s && (s.contributionPeriods || []).length) {
      var maxStart = -Infinity;
      s.contributionPeriods.forEach(function (p) {
        if (p.startYear == null || p.startYear === '') return;
        var a = (+p.startYear) * 12 + ((+p.startMonth || 1) - 1);
        if (a > maxStart) maxStart = a;
      });
      if (isFinite(maxStart)) { var n = maxStart + 12; startM = (n % 12) + 1; startY = Math.floor(n / 12); }
    }
    return { name: '', startMonth: startM, startYear: startY, endMonth: '', endYear: '', monthly: '' };
  }

  function onToggleSelect(e) {
    var t = e.target;
    if (!(t.dataset && t.dataset.action === 'toggle-select')) return;
    var id = t.dataset.id;
    if (t.checked) { if (state.selectedScenarioIds.indexOf(id) < 0) state.selectedScenarioIds.push(id); }
    else state.selectedScenarioIds = state.selectedScenarioIds.filter(function (x) { return x !== id; });
    persist(); render();
  }

  /* --------------------------- sort & drag rows --------------------------- */
  // Sort comparators per (list,key). Dates compare by absolute month.
  function sortKeyVal(list, item, key) {
    if (key === 'date') return absOf(item.month, item.year);
    if (key === 'start') return absOf(item.startMonth, item.startYear);
    if (key === 'end') return item.endYear == null || item.endYear === '' ? Infinity : absOf(item.endMonth || 12, item.endYear);
    if (key === 'age') return absOf(item.month, item.year);
    if (key === 'amount') return parseFloat(item.amount) || 0;
    if (key === 'monthly') return parseFloat(item.monthly) || 0;
    if (key === 'label') return (item.label || '').toLowerCase();
    return 0;
  }
  function absOf(m, y) {
    if (y == null || y === '') return Infinity;
    return (+y) * 12 + ((+m || 1) - 1);
  }
  function sortList(list, key) {
    var s = editingScenario();
    if (!s || !s[list]) return;
    state.sortBy = state.sortBy || {};
    var cur = state.sortBy[list];
    var dir = (cur && cur.key === key && cur.dir === 'asc') ? 'desc' : 'asc';
    state.sortBy[list] = { key: key, dir: dir };
    s[list].sort(function (a, b) {
      var av = sortKeyVal(list, a, key), bv = sortKeyVal(list, b, key);
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    persist(); render();
  }

  // HTML5 drag-and-drop reordering for Lump Sums and Extra Income rows.
  var dragCtx = null;
  function onDragStart(e) {
    var row = e.target.closest('.trow[draggable="true"]');
    if (!row) return;
    dragCtx = { list: row.dataset.list, from: +row.dataset.index };
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(dragCtx.from)); } catch (x) {}
  }
  function onDragOver(e) {
    if (!dragCtx) return;
    var row = e.target.closest('.trow[draggable="true"]');
    if (!row || row.dataset.list !== dragCtx.list) return;
    e.preventDefault();
    document.querySelectorAll('.trow.drop-target').forEach(function (r) { r.classList.remove('drop-target'); });
    row.classList.add('drop-target');
  }
  function onDrop(e) {
    if (!dragCtx) return;
    var row = e.target.closest('.trow[draggable="true"]');
    if (!row || row.dataset.list !== dragCtx.list) { cleanupDrag(); return; }
    e.preventDefault();
    var to = +row.dataset.index;
    moveRow(dragCtx.list, dragCtx.from, to);
    cleanupDrag();
  }
  function cleanupDrag() {
    document.querySelectorAll('.dragging, .drop-target').forEach(function (r) { r.classList.remove('dragging', 'drop-target'); });
    dragCtx = null;
  }
  function moveRow(list, from, to) {
    var s = editingScenario();
    if (!s || !s[list] || from === to) return;
    var arr = s[list];
    var item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
    // Manual reorder clears any active column sort for that list.
    if (state.sortBy && state.sortBy[list]) delete state.sortBy[list];
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
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    document.addEventListener('dragend', cleanupDrag);
    if (!state.theme) {
      state.theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    applyTheme();
    render();
    flagSaved(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
