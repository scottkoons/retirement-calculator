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
        '<div class="field inline"><label>VA disability (tax-free, monthly)</label>' +
          moneyInput('settings', 'settings.vaDisability.monthly', va.monthly, '$/mo') +
          '<span class="lbl">COLA %</span>' + numInput('settings', 'settings.vaDisability.colaPct', va.colaPct, '%', 'pct') + '</div>' +
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
  function lumpRows(s) {
    if (!(s.lumpSums || []).length) return '<p class="muted small">None yet.</p>';
    return s.lumpSums.map(function (l, i) {
      return '<div class="row">' +
        monthSelect('scenario', 'lumpSums.' + i + '.month', l.month) +
        yearInput('scenario', 'lumpSums.' + i + '.year', l.year) +
        moneyInput('scenario', 'lumpSums.' + i + '.amount', l.amount, 'Amount (+/-)') +
        textInput('scenario', 'lumpSums.' + i + '.label', l.label, 'Label (optional)', 'grow') +
        '<button class="btn-x" data-action="remove-row" data-list="lumpSums" data-index="' + i + '">✕</button>' +
      '</div>';
    }).join('');
  }
  function contribRows(s) {
    if (!(s.contributionChanges || []).length) return '<p class="muted small">None yet.</p>';
    return s.contributionChanges.map(function (c, i) {
      return '<div class="row">' +
        '<span class="lbl">starting</span>' +
        monthSelect('scenario', 'contributionChanges.' + i + '.month', c.month) +
        yearInput('scenario', 'contributionChanges.' + i + '.year', c.year) +
        '<span class="lbl">new monthly</span>' +
        moneyInput('scenario', 'contributionChanges.' + i + '.newMonthly', c.newMonthly, '$/mo') +
        '<button class="btn-x" data-action="remove-row" data-list="contributionChanges" data-index="' + i + '">✕</button>' +
      '</div>';
    }).join('');
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
        '<div class="field"><label>Base monthly contribution</label>' + moneyInput('scenario', 'monthlyContribution', s.monthlyContribution, '$/mo') + '</div>' +
        '<div class="field"><label>Retirement spending (today\'s $/mo)</label>' + moneyInput('scenario', 'retirementSpending', s.retirementSpending, '$/mo') + '</div>' +
      '</div>' +

      '<div class="sub"><div class="sub-head"><h4>Lump sums</h4>' +
        '<button class="btn small" data-action="add-row" data-list="lumpSums">+ Add lump sum</button></div>' +
        '<div class="rows">' + lumpRows(s) + '</div>' +
        '<p class="muted small">Use a negative amount for a one-time withdrawal (e.g. buying a car).</p></div>' +

      '<div class="sub"><div class="sub-head"><h4>Contribution changes</h4>' +
        '<button class="btn small" data-action="add-row" data-list="contributionChanges">+ Add change</button></div>' +
        '<div class="rows">' + contribRows(s) + '</div></div>' +

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
    fmtMoney: fmtMoney,
    esc: esc
  };
})(window);
