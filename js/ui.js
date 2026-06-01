/*
 * ui.js — HTML builders for the three tabs (no event wiring; that's app.js).
 *
 * Every input carries data-scope ("settings" | "scenario") and data-path so
 * app.js can bind it generically. Forms are NOT re-rendered on each keystroke
 * (that would lose focus); only structural changes rebuild a section.
 */
(function (global) {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var CLAIM_AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70];
  var SS_AGES = [62, 65, 66, 67, 70];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '—';
    var neg = n < 0;
    return (neg ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  }
  function attr(scope, path) { return 'data-scope="' + scope + '" data-path="' + path + '"'; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  function textInput(scope, path, value, placeholder, cls) {
    return '<input type="text" class="' + (cls || '') + '" ' + attr(scope, path) +
      ' value="' + esc(value) + '" placeholder="' + esc(placeholder || '') + '">';
  }
  function moneyInput(scope, path, value, placeholder) {
    return '<input type="number" inputmode="decimal" step="any" class="money" ' + attr(scope, path) +
      ' value="' + esc(value) + '" placeholder="' + esc(placeholder || '') + '">';
  }
  function numInput(scope, path, value, placeholder, cls) {
    return '<input type="number" step="any" class="' + (cls || 'num') + '" ' + attr(scope, path) +
      ' value="' + esc(value) + '" placeholder="' + esc(placeholder || '') + '">';
  }
  function yearInput(scope, path, value, placeholder) {
    return '<input type="number" class="yr" ' + attr(scope, path) +
      ' value="' + esc(value) + '" placeholder="' + esc(placeholder || 'YYYY') + '">';
  }
  function monthSelect(scope, path, value) {
    var opts = MONTHS.map(function (m, i) {
      return '<option value="' + (i + 1) + '"' + ((+value) === (i + 1) ? ' selected' : '') + '>' + m + '</option>';
    }).join('');
    return '<select class="mo" ' + attr(scope, path) + '>' + opts + '</select>';
  }
  function claimSelect(scope, path, value) {
    var opts = CLAIM_AGES.map(function (a) {
      return '<option value="' + a + '"' + ((+value) === a ? ' selected' : '') + '>' + a + '</option>';
    }).join('');
    return '<select ' + attr(scope, path) + '>' + opts + '</select>';
  }

  /* ----------------------------- Settings tab ----------------------------- */
  function personFields(key, p) {
    var ssCells = SS_AGES.map(function (age) {
      return '<div class="ss-cell"><label>Age ' + age + '</label>' +
        moneyInput('settings', 'settings.' + key + '.ss.' + age, (p.ss || {})[age], '$/mo') + '</div>';
    }).join('');
    return '<div class="card">' +
      '<h3>' + (key === 'personA' ? 'You' : 'Spouse') + '</h3>' +
      '<div class="field"><label>Name</label>' + textInput('settings', 'settings.' + key + '.name', p.name, 'Name') + '</div>' +
      '<div class="field inline"><label>Birth month / year</label>' +
        monthSelect('settings', 'settings.' + key + '.birthMonth', p.birthMonth) +
        yearInput('settings', 'settings.' + key + '.birthYear', p.birthYear) + '</div>' +
      '<div class="field"><label>Social Security estimate by claiming age (monthly)</label>' +
        '<div class="ss-grid">' + ssCells + '</div></div>' +
      '</div>';
  }

  function renderSettings(state) {
    var s = state.settings;
    var va = s.vaDisability || {};
    var a = s.assumptions || {};
    return '<div class="tab-pane">' +
      '<p class="intro">Your profile and assumptions. These feed every scenario. Everything saves automatically.</p>' +
      '<div class="grid2">' + personFields('personA', s.personA || {}) + personFields('personB', s.personB || {}) + '</div>' +
      '<div class="card"><h3>Other income &amp; savings</h3>' +
        '<div class="field inline"><label>VA disability (today\'s $, tax-free, monthly)</label>' +
          moneyInput('settings', 'settings.vaDisability.monthly', va.monthly, '$/mo') +
          '<span class="lbl">rises with SS COLA</span></div>' +
        '<div class="field inline"><label>Current total savings / investments</label>' +
          moneyInput('settings', 'settings.currentSavings', s.currentSavings, '$') + '</div>' +
      '</div>' +
      '<div class="card"><h3>Assumptions</h3><div class="grid4">' +
        '<div class="field"><label>Investment return %</label>' + numInput('settings', 'settings.assumptions.returnPct', a.returnPct, '%', 'pct') + '</div>' +
        '<div class="field"><label>Inflation %</label>' + numInput('settings', 'settings.assumptions.inflationPct', a.inflationPct, '%', 'pct') + '</div>' +
        '<div class="field"><label>Social Security COLA %</label>' + numInput('settings', 'settings.assumptions.ssColaPct', a.ssColaPct, '%', 'pct') + '</div>' +
        '<div class="field"><label>Effective tax rate %</label>' + numInput('settings', 'settings.assumptions.effectiveTaxPct', a.effectiveTaxPct, '%', 'pct') + '</div>' +
      '</div><p class="muted small">Tax applies to Social Security and any income you mark taxable. VA disability is always tax-free.</p></div>' +
    '</div>';
  }

  /* ----------------------------- Scenarios tab ---------------------------- */
  // Compact MM/YYYY pair (month dropdown + year). The day is always the 1st.
  function monthYear(pathBase, month, year, yearPlaceholder) {
    return '<span class="my">' + monthSelect('scenario', pathBase + 'Month', month) +
      yearInput('scenario', pathBase + 'Year', year, yearPlaceholder || 'YYYY') + '</span>';
  }
  function ageAt(state, absMonth) {
    var pa = state.settings.personA || {};
    if (!pa.birthYear) return '—';
    var birth = absMonth == null ? null : (pa.birthYear * 12 + ((pa.birthMonth || 1) - 1));
    if (birth == null || !isFinite(absMonth)) return '—';
    return (Math.round(((absMonth - birth) / 12) * 10) / 10).toFixed(1);
  }
  function shortMoney(n) {
    if (n == null || isNaN(n) || n === 0) return '$0';
    var a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (a >= 1000) return sign + '$' + Math.round(a / 1000) + 'K';
    return sign + '$' + Math.round(a);
  }

  // Monthly Contributions — a non-overlapping timeline. Columns mirror the
  // reference: Name · Start · End · Monthly $ · Months · Total.
  function contribTable(state, s) {
    var E = global.RetEngine;
    var now = state.now, nowAbs = E._helpers.toAbs(now.month, now.year);
    var pa = state.settings.personA || {};
    var retireAbs = (pa.birthYear ? pa.birthYear * 12 + ((pa.birthMonth || 1) - 1) : nowAbs) +
      (num(s.retireAge) || 65) * 12;
    var periods = s.contributionPeriods || [];
    if (!periods.length) return '<p class="muted small">No contribution periods yet. Add one to start saving toward retirement.</p>';

    var body = periods.map(function (p, i) {
      var st = E.contributionStats(p, nowAbs, retireAbs);
      var endCell = (p.endYear == null || p.endYear === '')
        ? monthYear('contributionPeriods.' + i + '.end', p.endMonth, p.endYear, 'retire') +
          '<span class="end-hint">blank = until retirement</span>'
        : monthYear('contributionPeriods.' + i + '.end', p.endMonth, p.endYear, 'retire');
      return '<div class="trow contrib-row">' +
        '<span class="td td-name">' + textInput('scenario', 'contributionPeriods.' + i + '.name', p.name, 'Name (e.g. After raise)', 'grow') + '</span>' +
        '<span class="td td-date">' + monthYear('contributionPeriods.' + i + '.start', p.startMonth, p.startYear) + '</span>' +
        '<span class="td td-date">' + endCell + '</span>' +
        '<span class="td td-amt">' + moneyInput('scenario', 'contributionPeriods.' + i + '.monthly', p.monthly, '$/mo') + '</span>' +
        '<span class="td td-num mono">' + st.months + '</span>' +
        '<span class="td td-num mono">' + shortMoney(st.total) + '</span>' +
        '<button class="btn-x" data-action="remove-row" data-list="contributionPeriods" data-index="' + i + '">✕</button>' +
      '</div>';
    }).join('');

    return '<div class="ttable contrib-table">' +
      '<div class="trow thead">' +
        '<span class="td td-name">Name</span>' +
        '<span class="td td-date">Start</span>' +
        '<span class="td td-date">End</span>' +
        '<span class="td td-amt">Monthly $</span>' +
        '<span class="td td-num">Months</span>' +
        '<span class="td td-num">Total</span>' +
        '<span class="td td-x"></span>' +
      '</div>' + body +
    '</div>';
  }

  // Lump Sum Events — Name · Date · Age · Amount, with a total row.
  function lumpTable(state, s) {
    var E = global.RetEngine;
    var lumps = s.lumpSums || [];
    if (!lumps.length) return '<p class="muted small">No lump-sum events yet. Add inheritances, business sales, or one-time withdrawals (use a negative amount).</p>';

    var total = 0;
    var body = lumps.map(function (l, i) {
      total += num(l.amount);
      var absM = (l.year != null && l.year !== '') ? E._helpers.toAbs(num(l.month) || 1, num(l.year)) : null;
      return '<div class="trow lump-row">' +
        '<span class="td td-name">' + textInput('scenario', 'lumpSums.' + i + '.label', l.label, 'Name (e.g. Sale of business)', 'grow') + '</span>' +
        '<span class="td td-date">' + monthYear('lumpSums.' + i + '.', l.month, l.year) + '</span>' +
        '<span class="td td-num mono age">' + ageAt(state, absM) + '</span>' +
        '<span class="td td-amt">' + moneyInput('scenario', 'lumpSums.' + i + '.amount', l.amount, 'Amount (+/-)') + '</span>' +
        '<button class="btn-x" data-action="remove-row" data-list="lumpSums" data-index="' + i + '">✕</button>' +
      '</div>';
    }).join('');

    return '<div class="ttable lump-table">' +
      '<div class="trow thead">' +
        '<span class="td td-name">Name</span>' +
        '<span class="td td-date">Date</span>' +
        '<span class="td td-num">Age</span>' +
        '<span class="td td-amt">Amount</span>' +
        '<span class="td td-x"></span>' +
      '</div>' + body +
      '<div class="trow tfoot">' +
        '<span class="td td-name">Total lump sums</span>' +
        '<span class="td td-date"></span><span class="td td-num"></span>' +
        '<span class="td td-amt mono">' + fmtMoney(total) + '</span>' +
        '<span class="td td-x"></span>' +
      '</div>' +
    '</div>';
  }

  function incomeRows(s) {
    if (!(s.extraIncome || []).length) return '<p class="muted small">None yet.</p>';
    return s.extraIncome.map(function (e, i) {
      return '<div class="row wrap">' +
        textInput('scenario', 'extraIncome.' + i + '.label', e.label, 'Source (e.g. Business)', 'grow') +
        moneyInput('scenario', 'extraIncome.' + i + '.monthly', e.monthly, '$/mo') +
        '<span class="lbl">from</span>' +
        monthSelect('scenario', 'extraIncome.' + i + '.startMonth', e.startMonth) +
        yearInput('scenario', 'extraIncome.' + i + '.startYear', e.startYear) +
        '<span class="lbl">to</span>' +
        monthSelect('scenario', 'extraIncome.' + i + '.endMonth', e.endMonth) +
        yearInput('scenario', 'extraIncome.' + i + '.endYear', e.endYear, 'never') +
        '<label class="chk"><input type="checkbox" data-scope="scenario" data-path="extraIncome.' + i + '.taxable"' + (e.taxable ? ' checked' : '') + '> taxable</label>' +
        '<button class="btn-x" data-action="remove-row" data-list="extraIncome" data-index="' + i + '">✕</button>' +
      '</div>';
    }).join('');
  }

  // Update only the computed (non-input) cells in the contribution + lump tables
  // so typing an amount reflects in Months/Total without rebuilding inputs.
  function refreshComputedCells(state, s) {
    var E = global.RetEngine;
    var now = state.now, nowAbs = E._helpers.toAbs(now.month, now.year);
    var pa = state.settings.personA || {};
    var retireAbs = (pa.birthYear ? pa.birthYear * 12 + ((pa.birthMonth || 1) - 1) : nowAbs) +
      (num(s.retireAge) || 65) * 12;
    document.querySelectorAll('.contrib-table .contrib-row').forEach(function (row, i) {
      var p = (s.contributionPeriods || [])[i]; if (!p) return;
      var st = E.contributionStats(p, nowAbs, retireAbs);
      var nums = row.querySelectorAll('.td-num');
      if (nums[0]) nums[0].textContent = st.months;
      if (nums[1]) nums[1].textContent = shortMoney(st.total);
    });
    var total = 0;
    (s.lumpSums || []).forEach(function (l) { total += num(l.amount); });
    var foot = document.querySelector('.lump-table .tfoot .td-amt');
    if (foot) foot.textContent = fmtMoney(total);
  }

  function renderScenarioEditor(state) {
    var s = state.scenarios.filter(function (x) { return x.id === state.editingId; })[0];
    if (!s) return '';
    return '<div class="card editor">' +
      '<div class="editor-head"><h3>Editing: ' + esc(s.name) + '</h3>' +
        '<button class="btn small" data-action="close-editor">Done</button></div>' +
      '<div class="grid3">' +
        '<div class="field"><label>Retirement age (you)</label>' + numInput('scenario', 'retireAge', s.retireAge, 'age', 'num') + '</div>' +
        '<div class="field"><label>Your SS claiming age</label>' + claimSelect('scenario', 'claimAgeA', s.claimAgeA) + '</div>' +
        '<div class="field"><label>Spouse SS claiming age</label>' + claimSelect('scenario', 'claimAgeB', s.claimAgeB) + '</div>' +
        '<div class="field"><label>Starting balance (blank = use settings)</label>' + moneyInput('scenario', 'startingBalance', s.startingBalance, '$') + '</div>' +
        '<div class="field"><label>Retirement spending (today\'s $/mo)</label>' + moneyInput('scenario', 'retirementSpending', s.retirementSpending, '$/mo') + '</div>' +
      '</div>' +

      '<div class="sub"><div class="sub-head"><h4>Monthly contributions</h4>' +
        '<button class="btn small" data-action="add-row" data-list="contributionPeriods">+ Add period</button></div>' +
        contribTable(state, s) +
        '<p class="muted small">Each row is a time period — they can\'t overlap, so setting a new Start automatically ends the period before it the month prior. Leave a gap for months you contribute nothing, or add a $0 row to label a lapse. Blank End = contribute until retirement.</p></div>' +

      '<div class="sub"><div class="sub-head"><h4>Lump-sum events</h4>' +
        '<button class="btn small" data-action="add-row" data-list="lumpSums">+ Add lump sum</button></div>' +
        lumpTable(state, s) +
        '<p class="muted small">One-time deposits (inheritance, business sale). Use a negative amount for a one-time withdrawal.</p></div>' +

      '<div class="sub"><div class="sub-head"><h4>Extra income</h4>' +
        '<button class="btn small" data-action="add-row" data-list="extraIncome">+ Add income</button></div>' +
        '<div class="rows">' + incomeRows(s) + '</div></div>' +

      '<div id="editor-summary" class="summary-box">' + renderMiniSummary(state, s) + '</div>' +
    '</div>';
  }

  function renderMiniSummary(state, s) {
    var r = global.RetEngine.projectScenario(s, state.settings, { now: state.now });
    var sm = r.summary;
    return '<div class="metrics-inline">' +
      metric('Nest egg at age ' + sm.retireAge, fmtMoney(sm.nestEggAtRetirement), sm.nestEggAtRetirementReal) +
      metric('Monthly income at retirement', fmtMoney(sm.retirementMonthlyIncome), sm.retirementMonthlyIncomeReal) +
      metric('Balance at age 90', fmtMoney(sm.balanceAt90), sm.balanceAt90Real) +
      metric('Money runs out', sm.depletionAge ? 'age ' + sm.depletionAge : 'never ✓') +
    '</div>';
  }
  // metric(label, nominalText, [realNumber]) — when a real value is given, show a
  // today's-dollars buying-power subline beneath the actual (nominal) figure.
  function metric(label, val, real) {
    var sub = (real != null && !isNaN(real))
      ? '<div class="m-real">≈ ' + esc(fmtMoney(real)) + ' in today\'s $</div>' : '';
    return '<div class="metric"><div class="m-val">' + esc(val) + '</div>' + sub +
      '<div class="m-label">' + esc(label) + '</div></div>';
  }

  function renderScenarios(state) {
    var list = state.scenarios.length
      ? '<ul class="scen-list">' + state.scenarios.map(function (s) {
          var active = s.id === state.editingId ? ' active' : '';
          return '<li class="' + active.trim() + '"><span class="scen-name">' + esc(s.name) + '</span>' +
            '<span class="scen-actions">' +
              '<button class="btn small" data-action="edit-scenario" data-id="' + s.id + '">Edit</button>' +
              '<button class="btn small" data-action="duplicate-scenario" data-id="' + s.id + '">Duplicate</button>' +
              '<button class="btn small" data-action="rename-scenario" data-id="' + s.id + '">Rename</button>' +
              '<button class="btn small danger" data-action="delete-scenario" data-id="' + s.id + '">Delete</button>' +
            '</span></li>';
        }).join('') + '</ul>'
      : '<p class="muted">No scenarios yet — create your first one.</p>';

    return '<div class="tab-pane">' +
      '<div class="bar"><button class="btn primary" data-action="add-scenario">+ New scenario</button>' +
        '<span class="muted small">Tip: build one, then Duplicate it to compare different claiming ages or retirement dates.</span></div>' +
      list +
      renderScenarioEditor(state) +
    '</div>';
  }

  /* ----------------------------- Dashboard tab ---------------------------- */
  function renderDashboard(state) {
    var picker = state.scenarios.length
      ? state.scenarios.map(function (s) {
          var ch = state.selectedScenarioIds.indexOf(s.id) >= 0 ? ' checked' : '';
          return '<label class="chk pick"><input type="checkbox" data-action="toggle-select" data-id="' + s.id + '"' + ch + '> ' + esc(s.name) + '</label>';
        }).join('')
      : '<p class="muted">No scenarios yet. Create some in the <strong>Scenarios</strong> tab, then pick them here to compare.</p>';

    var selected = state.scenarios.filter(function (s) { return state.selectedScenarioIds.indexOf(s.id) >= 0; });
    var table = selected.length ? buildCompareTable(state, selected)
      : '<p class="muted">Select one or more scenarios above to compare them.</p>';

    return '<div class="tab-pane">' +
      '<div class="bar"><p class="intro" style="margin:0">Pick scenarios to compare side by side.</p>' +
        dollarBasisToggle(state) + '</div>' +
      '<div class="card"><div class="picker">' + picker + '</div></div>' +
      '<div class="card">' + table + '</div>' +
      '<div class="card"><h3>Projected balance over time</h3>' + chartBasisNote(state) +
        '<div class="chart-wrap"><canvas id="balanceChart"></canvas></div></div>' +
    '</div>';
  }

  // Toggle: actual future dollars vs. today's-dollars buying power.
  function dollarBasisToggle(state) {
    var real = state.dollarBasis === 'real';
    return '<div class="basis-toggle" role="group" aria-label="Dollar basis">' +
      '<button class="basis-btn' + (!real ? ' active' : '') + '" data-action="set-basis" data-basis="nominal" ' +
        'title="The actual dollar amounts in each future year">Actual $</button>' +
      '<button class="basis-btn' + (real ? ' active' : '') + '" data-action="set-basis" data-basis="real" ' +
        'title="Adjusted for inflation — what the money is worth in today\'s buying power">Today\'s $</button>' +
    '</div>';
  }
  function chartBasisNote(state) {
    var real = state.dollarBasis === 'real';
    return '<p class="muted small basis-note">Showing <strong>' +
      (real ? "today's dollars" : 'actual future dollars') + '</strong>' +
      (real ? ' — adjusted for inflation to reflect real buying power.' : ' — the raw amounts in each year.') +
      ' Use the toggle above to switch.</p>';
  }

  function buildCompareTable(state, selected) {
    var real = state.dollarBasis === 'real';
    var k = real ? 'Real' : '';
    var projs = selected.map(function (s) {
      return { name: s.name, p: global.RetEngine.projectScenario(s, state.settings, { now: state.now }) };
    });
    var head = '<th>Metric</th>' + projs.map(function (x) { return '<th>' + esc(x.name) + '</th>'; }).join('');
    function row(label, fn) {
      return '<tr><td class="metric-name">' + label + '</td>' +
        projs.map(function (x) { return '<td>' + fn(x.p.summary) + '</td>'; }).join('') + '</tr>';
    }
    var basisLabel = real ? "today's $" : 'actual $';
    return '<h3>Comparison <span class="h3-tag">' + basisLabel + '</span></h3>' +
      '<div class="table-scroll"><table class="compare"><thead><tr>' + head + '</tr></thead><tbody>' +
      row('Retirement age', function (m) { return m.retireAge; }) +
      row('Nest egg at retirement', function (m) { return fmtMoney(m['nestEggAtRetirement' + k]); }) +
      row('Monthly income at retirement', function (m) { return fmtMoney(m['retirementMonthlyIncome' + k]); }) +
      row('Balance at age 90', function (m) { return fmtMoney(m['balanceAt90' + k]); }) +
      row('Money runs out', function (m) { return m.depletionAge ? 'age ' + m.depletionAge : 'never ✓'; }) +
    '</tbody></table></div>';
  }

  global.UI = {
    MONTHS: MONTHS,
    renderSettings: renderSettings,
    renderScenarios: renderScenarios,
    renderDashboard: renderDashboard,
    renderMiniSummary: renderMiniSummary,
    refreshComputedCells: refreshComputedCells,
    fmtMoney: fmtMoney,
    esc: esc
  };
})(window);
