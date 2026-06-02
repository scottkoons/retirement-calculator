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
  // Short labels for the compact date pickers (reads as "Sep 2026").
  var MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
  function num(v) { var n = parseFloat(typeof v === 'string' ? v.replace(/,/g, '') : v); return isFinite(n) ? n : 0; }

  function textInput(scope, path, value, placeholder, cls) {
    return '<input type="text" class="' + (cls || '') + '" ' + attr(scope, path) +
      ' value="' + esc(value) + '" placeholder="' + esc(placeholder || '') + '">';
  }
  function moneyInput(scope, path, value, placeholder) {
    return '<input type="text" inputmode="numeric" class="money" ' + attr(scope, path) +
      ' value="' + esc(fmtThousands(value)) + '" placeholder="' + esc(placeholder || '') + '">';
  }
  // Format a raw value with thousands separators, whole dollars only.
  function fmtThousands(v) {
    if (v == null || v === '') return '';
    var s = String(v);
    var neg = /^\s*-/.test(s);
    var digits = s.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
    if (!digits) return neg ? '-' : '';
    return (neg ? '-' : '') + Number(digits).toLocaleString('en-US');
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
    var opts = MONTHS_ABBR.map(function (m, i) {
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
  // pathBase + 'Month'/'Year' by default (e.g. start -> startMonth/startYear).
  // Pass mField/yField to bind explicit paths (lump sums use month/year).
  function monthYear(pathBase, month, year, yearPlaceholder, mField, yField) {
    return '<span class="my">' +
      monthSelect('scenario', pathBase + (mField || 'Month'), month) +
      yearInput('scenario', pathBase + (yField || 'Year'), year, yearPlaceholder || 'YYYY') + '</span>';
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
  // Compact money with an M tier for the big headline figures: $3.40M, $258K, $0.
  function shortMoneyMM(n) {
    if (n == null || isNaN(n)) return '—';
    var a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
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
        '<span class="td td-grip locked" title="Contributions sort by date automatically">↕</span>' +
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
        '<span class="td td-grip"></span>' +
        '<span class="td td-name">Name</span>' +
        '<span class="td td-date">Start ▲</span>' +
        '<span class="td td-date">End</span>' +
        '<span class="td td-amt">Monthly $</span>' +
        '<span class="td td-num">Months</span>' +
        '<span class="td td-num">Total</span>' +
        '<span class="td td-x"></span>' +
      '</div>' + body +
    '</div>';
  }

  // Drag handle + a sortable header cell helper.
  function handle() { return '<span class="td td-grip" title="Drag to reorder">⠿</span>'; }
  function sortHead(list, key, label, cls, state) {
    var sb = state.sortBy && state.sortBy[list];
    var arrow = '';
    if (sb && sb.key === key) arrow = sb.dir === 'asc' ? ' ▲' : ' ▼';
    return '<span class="td ' + cls + ' sortable" data-action="sort" data-sort-list="' + list + '" data-sort-key="' + key + '">' + label + arrow + '</span>';
  }

  // Lump Sum Events — Grip · Name · Date · Age · Amount, draggable + sortable.
  function lumpTable(state, s) {
    var E = global.RetEngine;
    var lumps = s.lumpSums || [];
    if (!lumps.length) return '<p class="muted small">No lump-sum events yet. Add inheritances, business sales, or one-time withdrawals (use a negative amount).</p>';

    var total = 0;
    var body = lumps.map(function (l, i) {
      total += num(l.amount);
      var absM = (l.year != null && l.year !== '') ? E._helpers.toAbs(num(l.month) || 1, num(l.year)) : null;
      return '<div class="trow lump-row" draggable="true" data-list="lumpSums" data-index="' + i + '">' +
        handle() +
        '<span class="td td-name">' + textInput('scenario', 'lumpSums.' + i + '.label', l.label, 'Name (e.g. Sale of business)', 'grow') + '</span>' +
        '<span class="td td-date">' + monthYear('lumpSums.' + i + '.', l.month, l.year, 'YYYY', 'month', 'year') + '</span>' +
        '<span class="td td-num mono age">' + ageAt(state, absM) + '</span>' +
        '<span class="td td-amt">' + moneyInput('scenario', 'lumpSums.' + i + '.amount', l.amount, 'Amount (+/-)') + '</span>' +
        '<button class="btn-x" data-action="remove-row" data-list="lumpSums" data-index="' + i + '">✕</button>' +
      '</div>';
    }).join('');

    return '<div class="ttable lump-table">' +
      '<div class="trow thead">' +
        '<span class="td td-grip"></span>' +
        sortHead('lumpSums', 'label', 'Name', 'td-name', state) +
        sortHead('lumpSums', 'date', 'Date', 'td-date', state) +
        sortHead('lumpSums', 'age', 'Age', 'td-num', state) +
        sortHead('lumpSums', 'amount', 'Amount', 'td-amt', state) +
        '<span class="td td-x"></span>' +
      '</div>' + body +
      '<div class="trow tfoot">' +
        '<span class="td td-grip"></span>' +
        '<span class="td td-name">Total lump sums</span>' +
        '<span class="td td-date"></span><span class="td td-num"></span>' +
        '<span class="td td-amt mono">' + fmtMoney(total) + '</span>' +
        '<span class="td td-x"></span>' +
      '</div>' +
    '</div>';
  }

  // Extra Income — Grip · Source · Monthly · From · To · Taxable, draggable + sortable.
  function incomeTable(state, s) {
    var inc = s.extraIncome || [];
    if (!inc.length) return '<p class="muted small">No extra income yet. Add things like a pension, business income, or rental income.</p>';
    var body = inc.map(function (e, i) {
      return '<div class="trow income-row" draggable="true" data-list="extraIncome" data-index="' + i + '">' +
        handle() +
        '<span class="td td-name">' + textInput('scenario', 'extraIncome.' + i + '.label', e.label, 'Source (e.g. Pension)', 'grow') + '</span>' +
        '<span class="td td-amt">' + moneyInput('scenario', 'extraIncome.' + i + '.monthly', e.monthly, '$/mo') + '</span>' +
        '<span class="td td-date">' + monthYear('extraIncome.' + i + '.start', e.startMonth, e.startYear) + '</span>' +
        '<span class="td td-date">' + monthYear('extraIncome.' + i + '.end', e.endMonth, e.endYear, 'never') + '</span>' +
        '<span class="td td-tax"><label class="chk"><input type="checkbox" data-scope="scenario" data-path="extraIncome.' + i + '.taxable"' + (e.taxable ? ' checked' : '') + '> tax</label></span>' +
        '<button class="btn-x" data-action="remove-row" data-list="extraIncome" data-index="' + i + '">✕</button>' +
      '</div>';
    }).join('');
    return '<div class="ttable income-table">' +
      '<div class="trow thead">' +
        '<span class="td td-grip"></span>' +
        sortHead('extraIncome', 'label', 'Source', 'td-name', state) +
        sortHead('extraIncome', 'monthly', 'Monthly $', 'td-amt', state) +
        sortHead('extraIncome', 'start', 'From', 'td-date', state) +
        sortHead('extraIncome', 'end', 'To', 'td-date', state) +
        '<span class="td td-tax">Taxable</span>' +
        '<span class="td td-x"></span>' +
      '</div>' + body +
    '</div>';
  }

  // Return phases — investment return % by age range (a non-overlapping age
  // timeline, like contributions). Grip is locked: phases auto-sort by fromAge.
  function returnPhaseTable(state, s) {
    var phases = s.returnPhases || [];
    var baseReturn = (state.settings.assumptions || {}).returnPct;
    if (!phases.length) {
      return '<p class="muted small">Using a single return of <strong>' + esc(baseReturn != null ? baseReturn : 6) +
        '%</strong> for all ages (from Settings). Add phases to model shifting to safer investments as you age.</p>';
    }
    var body = phases.map(function (p, i) {
      var toVal = (p.toAge == null || p.toAge === '')
        ? numInput('scenario', 'returnPhases.' + i + '.toAge', p.toAge, '95+', 'num')
        : numInput('scenario', 'returnPhases.' + i + '.toAge', p.toAge, 'age', 'num');
      return '<div class="trow phase-row">' +
        '<span class="td td-grip locked" title="Phases sort by age automatically">↕</span>' +
        '<span class="td td-name">' + textInput('scenario', 'returnPhases.' + i + '.label', p.label, 'Label (e.g. Growth / Glide / Safe)', 'grow') + '</span>' +
        '<span class="td td-num2">' + numInput('scenario', 'returnPhases.' + i + '.fromAge', p.fromAge, 'age', 'num') + '</span>' +
        '<span class="td td-num2">' + toVal + '</span>' +
        '<span class="td td-amt">' + numInput('scenario', 'returnPhases.' + i + '.returnPct', p.returnPct, '%', 'pct') + '</span>' +
        '<button class="btn-x" data-action="remove-row" data-list="returnPhases" data-index="' + i + '">✕</button>' +
      '</div>';
    }).join('');
    return '<div class="ttable phase-table">' +
      '<div class="trow thead">' +
        '<span class="td td-grip"></span>' +
        '<span class="td td-name">Phase</span>' +
        '<span class="td td-num2">From age ▲</span>' +
        '<span class="td td-num2">To age</span>' +
        '<span class="td td-amt">Return %</span>' +
        '<span class="td td-x"></span>' +
      '</div>' + body +
    '</div>';
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

  // A titled section card with an optional "+ Add" button and accent color.
  function sectionCard(accent, title, addBtn, inner, note) {
    return '<div class="section-card accent-' + accent + '">' +
      '<div class="section-head"><h4>' + esc(title) + '</h4>' + (addBtn || '') + '</div>' +
      inner +
      (note ? '<p class="muted small section-note">' + note + '</p>' : '') +
    '</div>';
  }
  function addBtn(list, label) {
    return '<button class="btn small" data-action="add-row" data-list="' + list + '">' + esc(label) + '</button>';
  }

  // How the portfolio is drawn down in retirement. Default "spending" keeps the
  // existing behavior; the other types model rules like the 4% rule.
  function withdrawalSection(s) {
    var w = s.withdrawal || {};
    var type = w.type || 'spending';
    var types = [['spending', 'Cover my spending target'], ['none', 'No withdrawal'],
      ['interest', 'Interest only'], ['percent', 'Percentage of balance'], ['fixed', 'Fixed monthly amount']];
    var opts = types.map(function (t) {
      return '<option value="' + t[0] + '"' + (type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
    }).join('');
    var extra = '';
    if (type === 'percent') extra = '<div class="field"><label>Withdrawal rate (annual)</label>' +
      numInput('scenario', 'withdrawal.ratePct', w.ratePct == null ? 4 : w.ratePct, '%', 'pct') + '</div>';
    else if (type === 'fixed') extra = '<div class="field"><label>Monthly amount (today\'s $)</label>' +
      moneyInput('scenario', 'withdrawal.amount', w.amount, '$/mo') + '</div>';
    var taxField = (type === 'none') ? '' :
      '<div class="field"><label>Tax status</label><label class="chk pick"><input type="checkbox" ' +
        'data-scope="scenario" data-path="withdrawal.taxable"' + (w.taxable !== false ? ' checked' : '') +
        '> Withdrawals are taxable</label></div>';
    var hints = {
      spending: 'Withdraws just enough to cover your spending target after guaranteed income — the default.',
      none: 'Live only on guaranteed income (Social Security, VA, pensions); the portfolio is left to grow.',
      interest: 'Withdraw only each month\'s investment growth, preserving the principal.',
      percent: 'Withdraw a fixed percentage of the balance each year — the classic 4% rule.',
      fixed: 'Withdraw a fixed dollar amount each month (grown with inflation).'
    };
    return sectionCard('withdraw', 'Withdrawal Strategy', '',
      '<div class="grid3">' +
        '<div class="field"><label>Type</label><select data-scope="scenario" data-path="withdrawal.type">' + opts + '</select></div>' +
        extra + taxField +
      '</div>', hints[type]);
  }

  function renderScenarioEditor(state, inline) {
    var s = state.scenarios.filter(function (x) { return x.id === state.editingId; })[0];
    if (!s) return '';
    // Inline (accordion) mode: the row above already names the scenario and the
    // row click collapses it, so we drop the "Editing: … / Done" header.
    var head = inline ? '' :
      '<div class="editor-head"><h3>Editing: ' + esc(s.name) + '</h3>' +
        '<button class="btn small" data-action="close-editor">Done</button></div>';
    return '<div class="editor-wrap">' + head +

      sectionCard('basics', 'Basics', '',
        '<div class="grid3">' +
          '<div class="field"><label>Retirement age (you)</label>' + numInput('scenario', 'retireAge', s.retireAge, 'age', 'num') + '</div>' +
          '<div class="field"><label>Your SS claiming age</label>' + claimSelect('scenario', 'claimAgeA', s.claimAgeA) + '</div>' +
          '<div class="field"><label>Spouse SS claiming age</label>' + claimSelect('scenario', 'claimAgeB', s.claimAgeB) + '</div>' +
          '<div class="field"><label>Starting balance (blank = use settings)</label>' + moneyInput('scenario', 'startingBalance', s.startingBalance, '$') + '</div>' +
          '<div class="field"><label>Retirement spending (today\'s $/mo)</label>' + moneyInput('scenario', 'retirementSpending', s.retirementSpending, '$/mo') + '</div>' +
        '</div>', '') +

      sectionCard('contrib', 'Monthly Contributions', addBtn('contributionPeriods', '+ Add period'),
        contribTable(state, s),
        'Each row is a time period — they can\'t overlap, so setting a new Start automatically ends the period before it the month prior. Leave a gap for months you contribute nothing, or add a $0 row to label a lapse. Blank End = contribute until retirement.') +

      sectionCard('lump', 'Lump Sum Events', addBtn('lumpSums', '+ Add lump sum'),
        lumpTable(state, s),
        'One-time deposits (inheritance, business sale). Use a negative amount for a one-time withdrawal.') +

      sectionCard('income', 'Retirement Income Streams', addBtn('extraIncome', '+ Add income'),
        incomeTable(state, s),
        'Recurring income in retirement — pension, rental, business. Tick "tax" if it\'s taxable. Leave "To" blank for lifetime income.') +

      withdrawalSection(s) +

      sectionCard('return', 'Investment Return by Age', addBtn('returnPhases', '+ Add phase'),
        returnPhaseTable(state, s),
        'Model shifting to safer investments as you age — e.g. 7% from 50–65, 6% from 65–75, 5% after 75. Phases can\'t overlap; the previous phase ends where the next begins. Leave "To age" blank on the last phase to run to the end. With no phases, the single Settings return applies.') +

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
          var open = s.id === state.editingId;
          return '<li class="scen-item' + (open ? ' open' : '') + '">' +
            '<div class="scen-row" data-action="toggle-edit" data-id="' + s.id + '" role="button" tabindex="0" aria-expanded="' + open + '">' +
              '<span class="scen-caret" aria-hidden="true">' + (open ? '▾' : '▸') + '</span>' +
              '<span class="scen-name">' + esc(s.name) + '</span>' +
              '<span class="scen-actions">' +
                '<button class="btn small" data-action="duplicate-scenario" data-id="' + s.id + '">Duplicate</button>' +
                '<button class="btn small" data-action="rename-scenario" data-id="' + s.id + '">Rename</button>' +
                '<button class="btn small danger" data-action="delete-scenario" data-id="' + s.id + '">Delete</button>' +
              '</span>' +
            '</div>' +
            (open ? '<div class="scen-editor-inline">' + renderScenarioEditor(state, true) + '</div>' : '') +
          '</li>';
        }).join('') + '</ul>'
      : '<p class="muted">No scenarios yet — create your first one.</p>';

    return '<div class="tab-pane">' +
      '<div class="bar"><button class="btn primary" data-action="add-scenario">+ New scenario</button>' +
        '<span class="muted small">Tip: click a scenario to open it. Build one, then Duplicate to compare different claiming ages or retirement dates.</span></div>' +
      list +
    '</div>';
  }

  /* ----------------------------- Dashboard tab ---------------------------- */
  // The "primary" scenario drives the big headline stats: first selected, else
  // the first scenario that exists.
  function primaryScenario(state) {
    var f = state.scenarios.filter(function (s) { return s.id === state.focusedId; })[0];
    return f || state.scenarios[0] || null;
  }
  // Average investment return for a scenario: mean of its return phases if it
  // has any, otherwise the single Settings return.
  function avgReturn(state, s) {
    var base = (state.settings.assumptions || {}).returnPct;
    var phases = (s && s.returnPhases) || [];
    if (phases.length) {
      var vals = phases.map(function (p) { return parseFloat(p.returnPct); })
        .filter(function (n) { return isFinite(n); });
      if (vals.length) return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    }
    return base;
  }
  function oneDecimal(n) {
    if (n == null || n === '' || isNaN(n)) return '—';
    return (Math.round(parseFloat(n) * 10) / 10).toString();
  }

  // Shared source of the headline figures so the static render, the live slider
  // updates, and the income-breakdown card all agree. Runs the projection once.
  function dashboardStats(state) {
    var s = primaryScenario(state);
    var a = state.settings.assumptions || {};
    var age = s && s.retireAge !== '' && s.retireAge != null ? String(s.retireAge) : '—';
    var ret = oneDecimal(s ? avgReturn(state, s) : a.returnPct);
    // The Starting amount card edits the global current savings (Settings).
    var startSettingRaw = state.settings.currentSavings;
    var start = (startSettingRaw === '' || startSettingRaw == null) ? '—' : shortMoney(num(startSettingRaw));

    var proj = s ? global.RetEngine.projectScenario(s, state.settings, { now: state.now }) : null;
    var retAge = s ? (parseInt(s.retireAge, 10) || 65) : null;
    var retRow = proj ? proj.yearByYear.filter(function (r) { return r.age === retAge; })[0] : null;
    var bd = s ? global.RetEngine.incomeBreakdown(s, state.settings, { now: state.now, withdrawal: retRow ? retRow.withdrawalMonthly : null }) : null;
    var nestEgg = proj ? proj.summary.nestEggAtRetirement : null;

    return {
      primaryId: s ? s.id : null,
      name: s ? s.name : 'No scenario yet',
      hasScenario: !!s,
      // raw slider values (fall back to sensible mid-points when blank)
      ageVal: s && s.retireAge !== '' && s.retireAge != null ? num(s.retireAge) : 65,
      retVal: a.returnPct !== '' && a.returnPct != null ? num(a.returnPct) : 6,
      age: age, ret: ret, start: start,
      startSettingRaw: (startSettingRaw == null ? '' : startSettingRaw),
      // projected outcomes (react to the retirement-age slider)
      balance: bd ? shortMoneyMM(nestEgg) : '—',
      monthly: bd ? fmtMoney(bd.monthlyIncome) : '—',
      annual: bd ? shortMoneyMM(bd.annualIncome) : '—',
      breakdown: bd,
      yby: proj ? proj.yearByYear : null
    };
  }

  // Three big headline figures, mirroring the reference dashboard: target
  // retirement age, average return, and starting amount. Values are white —
  // no orange on the numbers (including the dollar sign). The first two carry
  // a slider so you can dial them in and watch the chart move.
  function statHeader(d) {
    function card(label, valHtml, slider) {
      return '<div class="stat-card">' +
        '<div class="stat-top"><span class="stat-label">' + label + '</span></div>' +
        '<div class="stat-value">' + valHtml + '</div>' +
        (slider || '') + '</div>';
    }
    function valNum(key, text, unit) {
      return '<span class="stat-num" data-stat-val="' + key + '">' + esc(text) + '</span>' +
        (unit ? '<span class="stat-unit">' + unit + '</span>' : '');
    }
    // Retirement-age slider targets the focused scenario; return slider edits
    // the shared Settings assumption. Starting amount is an editable field that
    // writes back to Settings (current savings).
    var ageSlider = d.hasScenario
      ? '<input type="range" class="stat-slider" min="50" max="75" step="1" value="' + d.ageVal +
        '" data-stat="retireAge" data-id="' + d.primaryId + '" aria-label="Target retirement age">'
      : '';
    var retSlider = '<input type="range" class="stat-slider" min="0" max="12" step="0.1" value="' + d.retVal +
      '" data-stat="returnPct" aria-label="Average return percent">';
    var startVal = '<span class="stat-cur">$</span>' +
      '<input type="number" class="stat-edit-input" data-stat="startBalance" min="0" step="1000" ' +
      'value="' + esc(d.startSettingRaw) + '" aria-label="Starting amount (current savings)">';

    return '<div class="stat-head">' +
      (d.hasScenario ? '' : '<div class="stat-context">Create a scenario to see your numbers.</div>') +
      '<div class="stat-row">' +
        card('Target retirement age', valNum('retireAge', d.age, 'years'), ageSlider) +
        card('Average return', valNum('returnPct', d.ret, '%'), retSlider) +
        card('Starting amount · editable', startVal) +
      '</div></div>';
  }

  // Second row — the projected OUTCOMES that move with the sliders: balance at
  // retirement, monthly income, annual income. Each card has its own accent.
  function resultRow(d) {
    var ageTxt = d.hasScenario ? d.age : '—';
    function rcard(color, dot, top, key, val, sub) {
      return '<div class="result-card" style="--rc:' + color + '">' +
        '<div class="stat-top"><span class="stat-label">' + dot + top + '</span></div>' +
        '<div class="stat-value"><span class="stat-num" data-stat-val="' + key + '">' + esc(val) + '</span></div>' +
        '<div class="rc-sub">' + sub + '</div></div>';
    }
    var dot = '<span class="rc-dot"></span>';
    var ageEcho = '<span data-stat-val="ageEcho">' + esc(ageTxt) + '</span>';
    return '<div class="result-row">' +
      rcard('#f59e0b', dot, 'At retirement (' + ageEcho + ')', 'balance', d.balance, 'Projected balance') +
      rcard('#10b981', dot, 'Monthly income', 'monthly', d.monthly, 'At age ' + ageEcho) +
      rcard('#ec4899', dot, 'Annual income', 'annual', d.annual, 'At age ' + ageEcho) +
    '</div>';
  }

  // Income Breakdown — where the monthly income comes from at retirement, with
  // a bar per source, Tax / Tax-free badges, and taxable vs tax-free totals.
  function incomeBreakdownCard(d) {
    if (!d.hasScenario || !d.breakdown) {
      return '<div class="card"><h3>Income breakdown</h3>' +
        '<p class="muted small" style="margin:0">Add a scenario with spending, Social Security, VA, or other income to see where your retirement income comes from.</p></div>';
    }
    var bd = d.breakdown;
    var SRC_COLORS = { withdrawal: '#8b5cf6', va: '#ec4899', ssA: '#10b981', ssB: '#fbbf24', extra: '#0891b2' };
    var max = bd.sources.reduce(function (m, s) { return Math.max(m, s.amount); }, 0) || 1;
    var rows = bd.sources.length
      ? bd.sources.map(function (s) {
          var color = SRC_COLORS[s.key] || '#0891b2';
          var pct = Math.max(2, Math.round((s.amount / max) * 100));
          var badge = s.taxable
            ? '<span class="tax-badge tax">Tax</span>'
            : '<span class="tax-badge free">Tax-free</span>';
          return '<div class="ib-row">' +
            '<div class="ib-head">' +
              '<span class="ib-name"><span class="ib-dot" style="background:' + color + '"></span>' + esc(s.label) + ' ' + badge + '</span>' +
              '<span class="ib-amt mono">' + fmtMoney(s.amount) + '</span>' +
            '</div>' +
            '<div class="ib-track"><span class="ib-fill" style="width:' + pct + '%;background:' + color + '"></span></div>' +
          '</div>';
        }).join('')
      : '<p class="muted small" style="margin:0">No income at this age yet — adjust spending, claiming ages, or income streams.</p>';

    return '<div class="card income-card">' +
      '<h3>Income breakdown <span class="ib-sub">at age ' + esc(String(bd.age)) + ' · ' + esc(d.name) + '</span></h3>' +
      '<div class="ib-list">' + rows + '</div>' +
      '<div class="ib-totals">' +
        '<div class="ib-total taxable"><span class="ib-total-lbl">Taxable / mo</span><span class="ib-total-val mono">' + fmtMoney(bd.taxableMonthly) + '</span></div>' +
        '<div class="ib-total free"><span class="ib-total-lbl">Tax-free / mo</span><span class="ib-total-val mono">' + fmtMoney(bd.taxfreeMonthly) + '</span></div>' +
      '</div>' +
    '</div>';
  }

  // "Control panel" of scenario chips across the top — click to add/remove a
  // scenario from the comparison. Replaces the old checkbox picker and the
  // header search bar.
  // Top strip of scenario pills. Click a pill to FOCUS that scenario (its
  // numbers fill the dashboard); the focused one is highlighted. Pills are
  // draggable to reorder and each carries a duplicate button.
  function scenarioBar(state) {
    if (!state.scenarios.length) {
      return '<div class="scenario-bar empty">' +
        '<span class="muted small">No scenarios yet.</span>' +
        '<button class="scn-chip add" data-action="add-scenario">+ New scenario</button></div>';
    }
    var focused = primaryScenario(state);
    var chips = state.scenarios.map(function (s, i) {
      var on = focused && s.id === focused.id ? ' on' : '';
      return '<div class="scn-chip' + on + '" draggable="true" data-index="' + i + '" data-id="' + s.id + '" title="Drag to reorder">' +
        '<button class="scn-pick" data-action="focus-scenario" data-id="' + s.id + '" title="Show this scenario">' +
          '<span class="pill-dot" style="background:' + (s.color || '#888') + '"></span>' +
          '<span class="pill-name">' + esc(s.name) + '</span></button>' +
        '<button class="scn-copy" data-action="duplicate-scenario" data-id="' + s.id + '" title="Duplicate this scenario" aria-label="Duplicate ' + esc(s.name) + '">⧉</button>' +
      '</div>';
    }).join('');
    chips += '<button class="scn-chip add" data-action="add-scenario" title="New scenario">+ New</button>';
    return '<div class="scenario-bar">' + chips + '</div>';
  }

  // Balance chart card with zoom controls + expand-to-fullscreen.
  function chartCard(state) {
    var expanded = !!state.chartExpanded;
    return '<div class="card chart-card' + (expanded ? ' expanded' : '') + '">' +
      '<div class="chart-head">' +
        '<div class="chart-title"><h3>Balance over time</h3>' + chartBasisNote(state) + '</div>' +
        '<div class="chart-tools">' +
          '<button class="btn small ghost" data-action="reset-zoom">Reset zoom</button>' +
          '<button class="btn small ghost" data-action="expand-chart">' + (expanded ? '✕ Close' : '⤢ Expand') + '</button>' +
        '</div>' +
      '</div>' +
      '<p class="muted small zoom-hint">Drag across to zoom · scroll to zoom · Ctrl-drag to pan · hover a ◆ for event details</p>' +
      '<div class="chart-wrap"><canvas id="balanceChart"></canvas></div>' +
    '</div>';
  }

  // Collapsible year-by-year table: balance, contribution, withdrawal, and the
  // monthly / annual income you live on at each age.
  function yearByYearCard(state, d) {
    if (!d.hasScenario || !d.yby || !d.yby.length) return '';
    var collapsed = !!state.yByYCollapsed;
    var all = !!state.yByYAll;
    var retireAgeNum = parseInt(d.age, 10);
    var base = d.yby[0].age;
    var rowsArr = d.yby.filter(function (r) { return all || r.retired; });
    var body = rowsArr.map(function (r) {
      var isRetire = r.age === retireAgeNum;
      return '<tr class="' + (isRetire ? 'retire-row' : '') + '">' +
        '<td class="yby-l">' + (r.age - base) + '</td>' +
        '<td class="yby-l yby-age">' + r.age + (isRetire ? ' <span class="yby-tag">retire</span>' : '') + '</td>' +
        '<td class="mono">' + shortMoneyMM(r.balance) + '</td>' +
        '<td class="mono dim">' + (r.contributionMonthly > 0 ? fmtMoney(r.contributionMonthly) : '—') + '</td>' +
        '<td class="mono dim">' + (r.withdrawalMonthly > 0 ? fmtMoney(r.withdrawalMonthly) : '—') + '</td>' +
        '<td class="mono yby-inc">' + (r.monthlyIncome > 0 ? fmtMoney(r.monthlyIncome) : '—') + '</td>' +
        '<td class="mono yby-inc">' + (r.annualIncome > 0 ? shortMoneyMM(r.annualIncome) : '—') + '</td>' +
      '</tr>';
    }).join('');

    return '<div class="card yby-card">' +
      '<div class="yby-head">' +
        '<button class="yby-toggle" data-action="toggle-yby">' +
          '<span class="yby-chevron">' + (collapsed ? '▸' : '▾') + '</span> Year by year — ' + esc(d.name) +
        '</button>' +
        (collapsed ? '' :
          '<div class="seg-toggle">' +
            '<button class="seg-btn' + (!all ? ' active' : '') + '" data-action="set-yby-mode" data-mode="retire">Retirement only</button>' +
            '<button class="seg-btn' + (all ? ' active' : '') + '" data-action="set-yby-mode" data-mode="all">All years</button>' +
          '</div>') +
      '</div>' +
      (collapsed ? '' :
        '<div class="table-scroll yby-scroll"><table class="yby-table"><thead><tr>' +
          '<th class="yby-l">Year</th><th class="yby-l">Age</th><th>Balance</th><th>Contribution</th>' +
          '<th>Withdrawal</th><th>Monthly income</th><th>Annual income</th>' +
        '</tr></thead><tbody>' + body + '</tbody></table>' +
        '<p class="muted small" style="margin:.6rem .2rem 0">Actual future dollars. Income = guaranteed sources + the withdrawal needed to meet spending.</p></div>') +
    '</div>';
  }

  function renderDashboard(state) {
    var d = dashboardStats(state);
    var all = state.scenarios;
    var table = all.length ? buildCompareTable(state, all)
      : '<p class="muted">Create scenarios to compare them here.</p>';

    // no-anim when expanded so the tab-pane has no transform (a transform would
    // make the fullscreen chart's position:fixed size to this column, not the viewport).
    return '<div class="tab-pane' + (state.chartExpanded ? ' no-anim' : '') + '">' +
      '<div class="dash-top">' +
        scenarioBar(state) +
        '<div class="dash-top-actions">' +
          dollarBasisToggle(state) +
          '<button class="btn small ghost" data-action="print-plan" title="Print or save as PDF">⎙ Print / PDF</button>' +
        '</div>' +
      '</div>' +
      '<div class="dash-grid">' +
        '<div class="dash-cards">' + statHeader(d) + resultRow(d) + '</div>' +
        incomeBreakdownCard(d) +
      '</div>' +
      chartCard(state) +
      yearByYearCard(state, d) +
      '<div class="card">' + table + '</div>' +
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
    dashboardStats: dashboardStats,
    renderMiniSummary: renderMiniSummary,
    refreshComputedCells: refreshComputedCells,
    fmtMoney: fmtMoney,
    fmtThousands: fmtThousands,
    esc: esc
  };
})(window);
