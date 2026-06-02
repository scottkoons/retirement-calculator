/*
 * engine.js — Pure retirement projection math (no DOM).
 *
 * The heart of the app. Given one scenario plus global settings, it steps month
 * by month from "now" until Person A turns 95 and returns:
 *   - rows[]: yearly snapshots for charting/tables
 *   - summary: nest egg at retirement, first-year retirement income, balance at 90,
 *              and the age (if any) the money runs out.
 *
 * Everything is nominal (future) dollars. Amounts the user enters in "today's
 * dollars" (Social Security, VA, retirement spending, extra income) are inflated
 * forward so they stay consistent with a nominal investment return.
 */
(function (global) {
  'use strict';

  // Time is an absolute month index = year*12 + (month-1). month is 1..12.
  function toAbs(month, year) { return year * 12 + (month - 1); }
  function fromAbs(abs) { return { year: Math.floor(abs / 12), month: (abs % 12) + 1 }; }

  function monthlyRate(annualPct) {
    return Math.pow(1 + (annualPct || 0) / 100, 1 / 12) - 1;
  }

  // Grow a today's-dollar amount to a future month using an annual percentage.
  function inflate(amount, annualPct, monthsFromNow) {
    return amount * Math.pow(1 + (annualPct || 0) / 100, monthsFromNow / 12);
  }

  // Discount a future (nominal) amount back to today's-dollar buying power.
  function deflate(amount, annualPct, monthsFromNow) {
    return amount * Math.pow(1 + (annualPct || 0) / 100, -monthsFromNow / 12);
  }

  function num(v, dflt) {
    var n = parseFloat(typeof v === 'string' ? v.replace(/,/g, '') : v);
    return isFinite(n) ? n : (dflt || 0);
  }

  function has(v) { return v != null && v !== ''; }

  // ---- Contribution periods (a non-overlapping timeline) -------------------
  // A period has start (month/year), optional end (month/year; blank = runs to
  // retirement), a monthly amount, and a name. A blank start means "from the
  // beginning of the projection".
  function periodStartAbs(p) { return has(p.startYear) ? toAbs(num(p.startMonth, 1), num(p.startYear)) : -Infinity; }
  function periodEndAbs(p) { return has(p.endYear) ? toAbs(num(p.endMonth, 12), num(p.endYear)) : Infinity; }

  // Monthly contribution active in a given month. Periods don't overlap (the UI
  // enforces it), so at most one is active; a month in a gap returns 0.
  function contributionPeriodAt(absMonth, periods) {
    var total = 0;
    (periods || []).forEach(function (p) {
      if (absMonth >= periodStartAbs(p) && absMonth <= periodEndAbs(p)) total += num(p.monthly);
    });
    return total;
  }

  // Legacy model: a base amount plus dated "change" rows.
  function contributionAt(absMonth, base, changes) {
    var amount = base;
    var effective = -Infinity;
    (changes || []).forEach(function (c) {
      if (!has(c.year)) return;
      var a = toAbs(num(c.month, 1), num(c.year));
      if (a <= absMonth && a > effective) { effective = a; amount = num(c.newMonthly); }
    });
    return amount;
  }

  // Unified accessor: prefer the period timeline, fall back to the legacy model.
  function contributionFor(absMonth, scenario) {
    if (scenario.contributionPeriods && scenario.contributionPeriods.length) {
      return contributionPeriodAt(absMonth, scenario.contributionPeriods);
    }
    return contributionAt(absMonth, num(scenario.monthlyContribution), scenario.contributionChanges);
  }

  // Reshape a period list so none overlap: sort by start, and if a period's end
  // reaches into the next period's start, clamp it to the month before. Ends that
  // are already earlier (intentional gaps) are left untouched. Mutates + returns.
  function clampContributionPeriods(periods) {
    var list = (periods || []).slice();
    list.sort(function (a, b) {
      var sa = periodStartAbs(a), sb = periodStartAbs(b);
      return sa === sb ? 0 : (sa < sb ? -1 : 1);
    });
    for (var i = 0; i < list.length - 1; i++) {
      var nextStart = periodStartAbs(list[i + 1]);
      if (!isFinite(nextStart)) continue;
      if (periodEndAbs(list[i]) >= nextStart) {
        var c = fromAbs(nextStart - 1);
        list[i].endMonth = c.month; list[i].endYear = c.year;
      }
    }
    return list;
  }

  // Months contributed and (simple, no-growth) total for a period, clamped to the
  // window [now, retirement). For display in the editor table.
  function contributionStats(p, nowAbs, retireAbs) {
    var s = Math.max(periodStartAbs(p), nowAbs);
    var e = Math.min(periodEndAbs(p), retireAbs - 1);
    var months = Math.max(0, Math.round(e - s) + 1);
    if (!isFinite(months)) months = 0;
    return { months: months, total: months * num(p.monthly) };
  }

  // Sum of lump sums dated exactly this absolute month (+ deposit / - withdrawal).
  function lumpAt(absMonth, lumps) {
    var total = 0;
    (lumps || []).forEach(function (l) {
      if (!has(l.year)) return;
      if (toAbs(num(l.month, 1), num(l.year)) === absMonth) total += num(l.amount);
    });
    return total;
  }

  // Social Security monthly benefit for a person in a given month (today's $ grown by COLA).
  function ssIncome(person, claimAge, absMonth, nowAbs, ssColaPct) {
    if (!person || !has(person.birthYear)) return 0;
    var birthAbs = toAbs(num(person.birthMonth, 1), num(person.birthYear));
    var startAbs = birthAbs + claimAge * 12;
    if (absMonth < startAbs) return 0;
    var base = num((person.ss || {})[claimAge]);
    if (!base) return 0;
    return inflate(base, ssColaPct, absMonth - nowAbs);
  }

  // Return % in effect at a given age, from a list of phases. Each phase has
  // fromAge (inclusive) and an optional toAge (exclusive); the matching phase's
  // returnPct wins, otherwise the scenario's base return is used. Phases are a
  // non-overlapping timeline by age, mirroring contribution periods.
  function returnRateAt(ageYears, phases, baseReturnPct) {
    var list = phases || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!has(p.returnPct)) continue;
      var from = has(p.fromAge) ? num(p.fromAge) : -Infinity;
      var to = has(p.toAge) ? num(p.toAge) : Infinity;
      if (ageYears >= from && ageYears < to) return num(p.returnPct);
    }
    return baseReturnPct;
  }

  // Reshape return phases so they don't overlap by age: sort by fromAge, and clamp
  // each phase's toAge down to the next phase's fromAge. Mirrors contribution clamp.
  function clampReturnPhases(phases) {
    var list = (phases || []).slice();
    list.sort(function (a, b) {
      var fa = has(a.fromAge) ? num(a.fromAge) : -Infinity;
      var fb = has(b.fromAge) ? num(b.fromAge) : -Infinity;
      return fa === fb ? 0 : (fa < fb ? -1 : 1);
    });
    for (var i = 0; i < list.length - 1; i++) {
      var nextFrom = has(list[i + 1].fromAge) ? num(list[i + 1].fromAge) : Infinity;
      if (!isFinite(nextFrom)) continue;
      var to = has(list[i].toAge) ? num(list[i].toAge) : Infinity;
      if (to > nextFrom) list[i].toAge = nextFrom;
    }
    return list;
  }

  function projectScenario(scenario, settings, opts) {
    opts = opts || {};
    settings = settings || {};
    var now = opts.now || { month: 5, year: 2026 };
    var nowAbs = toAbs(now.month, now.year);

    var a = settings.assumptions || {};
    var ov = scenario.assumptionsOverride || {};
    var returnPct = has(ov.returnPct) ? num(ov.returnPct) : num(a.returnPct, 6);
    var inflationPct = has(ov.inflationPct) ? num(ov.inflationPct) : num(a.inflationPct, 3);
    var ssColaPct = num(a.ssColaPct, inflationPct);
    var taxPct = num(a.effectiveTaxPct, 0);
    var phases = scenario.returnPhases || [];
    var usePhases = phases.length > 0;
    var mRate = monthlyRate(returnPct); // fallback / no-phase rate

    var personA = settings.personA || {};
    var personB = settings.personB || {};
    var birthAbsA = toAbs(num(personA.birthMonth, 1), num(personA.birthYear, now.year));

    var retireAge = num(scenario.retireAge, 65);
    var retireAbs = birthAbsA + retireAge * 12;

    var startingBalance = has(scenario.startingBalance)
      ? num(scenario.startingBalance) : num(settings.currentSavings);

    var endAbs = birthAbsA + 95 * 12; // project through age 95
    if (endAbs <= nowAbs) endAbs = nowAbs + 12; // guard against bad birthdates

    var va = settings.vaDisability || {};
    var rows = [];
    var balance = startingBalance;
    var depletionAge = null;
    var nestEggAtRetirement = null;
    var retirementIncomeFirst = null;
    var yearly = [];   // one snapshot per birthday (clean integer ages)

    for (var absM = nowAbs; absM <= endAbs; absM++) {
      var ageA = (absM - birthAbsA) / 12;
      var retired = absM >= retireAbs;

      // 1. investment growth — rate may vary by age via return phases, then an
      // optional glide-path throttle near/at retirement (overrides in its window).
      var annualR = usePhases ? returnRateAt(ageA, phases, returnPct) : returnPct;
      var th = settings.returnThrottle;
      if (th) {
        if (th.atEnabled && ageA >= retireAge) annualR = num(th.atRate, annualR);
        else if (th.preEnabled && ageA >= (retireAge - num(th.preYears, 0)) && ageA < retireAge) annualR = num(th.preRate, annualR);
      }
      var rate = monthlyRate(annualR);
      var preGrowth = balance;
      balance *= (1 + rate);
      var growthThisMonth = balance - preGrowth;
      balance += lumpAt(absM, scenario.lumpSums); // 2. lump sums (any phase)

      var incomeGross = 0, incomeTaxable = 0, spending = 0, contribThisMonth = 0;
      var wdThisMonth = 0, miThisMonth = 0;

      if (!retired) {
        contribThisMonth = contributionFor(absM, scenario);
        balance += contribThisMonth;
      } else {
        var ssA = ssIncome(personA, num(scenario.claimAgeA, retireAge), absM, nowAbs, ssColaPct);
        var ssB = ssIncome(personB, num(scenario.claimAgeB, retireAge), absM, nowAbs, ssColaPct);
        incomeGross += ssA + ssB;
        incomeTaxable += ssA + ssB; // SS counted taxable (simplified)

        // Global income sources (VA, pension, rental…): today's $ grown by each
        // source's own COLA, active from its start age (blank = from retirement).
        (settings.incomeSources || []).forEach(function (src) {
          var startAbs = has(src.startAge) ? birthAbsA + num(src.startAge) * 12 : retireAbs;
          if (absM >= startAbs) {
            var amt = inflate(num(src.monthly), num(src.colaPct, 0), absM - nowAbs);
            if (amt) { incomeGross += amt; if (src.taxable) incomeTaxable += amt; }
          }
        });

        var taxGuar = incomeTaxable * taxPct / 100;
        // Withdrawal strategy is global (same rule across scenarios).
        var wcfg = settings.withdrawal || {};
        var wType = wcfg.type || 'spending';
        var mFromNow = absM - nowAbs;
        if (wType === 'spending') {
          // Default model: fund a spending target. Guaranteed income flows in,
          // spending flows out; any surplus is reinvested.
          spending = inflate(num(scenario.retirementSpending), inflationPct, mFromNow);
          balance += (incomeGross - taxGuar - spending);
          wdThisMonth = Math.max(0, spending - (incomeGross - taxGuar));
          miThisMonth = Math.max(spending, incomeGross);
        } else {
          // Rule-based withdrawal: the portfolio is drawn by the rule; guaranteed
          // income is spent outside it. Income you live on = guaranteed + withdrawal.
          var wr = wcfg;
          var wd = 0;
          if (wType === 'interest') wd = Math.max(0, growthThisMonth);
          else if (wType === 'percent') wd = Math.max(0, balance) * (num(wr.ratePct, 4) / 100) / 12;
          else if (wType === 'fixed') wd = inflate(num(wr.amount), inflationPct, mFromNow);
          // 'none' → wd stays 0
          wd = Math.min(wd, Math.max(0, balance));
          var taxWd = wr.taxable ? wd * taxPct / 100 : 0;
          balance += (-wd - taxWd);
          wdThisMonth = wd;
          miThisMonth = incomeGross + wd;
          spending = miThisMonth;
        }
        if (retirementIncomeFirst === null) retirementIncomeFirst = miThisMonth;
      }

      if (absM === retireAbs) nestEggAtRetirement = balance;
      if (balance <= 0 && depletionAge === null) {
        depletionAge = Math.floor(ageA);
        balance = 0;
      }

      var fa = fromAbs(absM);
      if (fa.month === 1 || absM === nowAbs || absM === endAbs) {
        // Deflate nominal figures back to today's-dollar buying power.
        var realFactor = Math.pow(1 + inflationPct / 100, -(absM - nowAbs) / 12);
        rows.push({
          absMonth: absM, year: fa.year, age: Math.round(ageA * 10) / 10,
          balance: Math.round(balance),
          balanceReal: Math.round(balance * realFactor),
          incomeMonthly: Math.round(incomeGross),
          incomeMonthlyReal: Math.round(incomeGross * realFactor),
          spendingMonthly: Math.round(spending),
          spendingMonthlyReal: Math.round(spending * realFactor)
        });
      }

      // Birthday snapshot → integer age. Powers the chart's clean x-axis and the
      // year-by-year table. Monthly income = guaranteed + withdrawal-to-spending.
      if ((absM - birthAbsA) % 12 === 0) {
        var rf = Math.pow(1 + inflationPct / 100, -(absM - nowAbs) / 12);
        var wd = wdThisMonth, mi = miThisMonth;
        yearly.push({
          age: Math.round(ageA), year: fa.year, retired: retired,
          balance: Math.round(balance), balanceReal: Math.round(balance * rf),
          contributionMonthly: Math.round(contribThisMonth),
          withdrawalMonthly: Math.round(wd),
          monthlyIncome: Math.round(mi), monthlyIncomeReal: Math.round(mi * rf),
          annualIncome: Math.round(mi * 12), annualIncomeReal: Math.round(mi * 12 * rf)
        });
      }
    }

    var balAt90 = null, balAt90Real = null;
    var abs90 = birthAbsA + 90 * 12;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].absMonth >= abs90) { balAt90 = rows[i].balance; balAt90Real = rows[i].balanceReal; break; }
    }

    // Deflation factors at the moments each summary figure is measured.
    var retireFactor = Math.pow(1 + inflationPct / 100, -Math.max(0, retireAbs - nowAbs) / 12);
    var endFactor = Math.pow(1 + inflationPct / 100, -(endAbs - nowAbs) / 12);
    var nestEgg = nestEggAtRetirement != null ? nestEggAtRetirement : balance;
    var income = retirementIncomeFirst || 0;

    return {
      rows: rows,
      yearByYear: yearly,
      summary: {
        retireAge: retireAge,
        nestEggAtRetirement: Math.round(nestEgg),
        nestEggAtRetirementReal: Math.round(nestEgg * retireFactor),
        retirementMonthlyIncome: Math.round(income),
        retirementMonthlyIncomeReal: Math.round(income * retireFactor),
        balanceAt90: balAt90 != null ? balAt90 : Math.round(balance),
        balanceAt90Real: balAt90Real != null ? balAt90Real : Math.round(balance * endFactor),
        depletionAge: depletionAge,
        finalBalance: Math.round(balance),
        finalBalanceReal: Math.round(balance * endFactor)
      }
    };
  }

  // Monthly income breakdown at the retirement month (or now, if already past
  // retirement): every guaranteed source plus the portfolio withdrawal needed
  // to meet the spending target. All figures are nominal (future) dollars at
  // that month. "Monthly income" = guaranteed income + withdrawal-to-spending,
  // i.e. max(spending, guaranteed). Withdrawals count as taxable for the
  // taxable/tax-free split; VA is tax-free; SS is taxable.
  function incomeBreakdown(scenario, settings, opts) {
    opts = opts || {};
    settings = settings || {};
    var now = opts.now || { month: 5, year: 2026 };
    var nowAbs = toAbs(now.month, now.year);
    var a = settings.assumptions || {};
    var inflationPct = num(a.inflationPct, 3);
    var ssColaPct = num(a.ssColaPct, inflationPct);

    var personA = settings.personA || {};
    var personB = settings.personB || {};
    var birthAbsA = toAbs(num(personA.birthMonth, 1), num(personA.birthYear, now.year));
    var retireAge = num(scenario.retireAge, 65);
    var atAbs = birthAbsA + retireAge * 12;
    if (atAbs < nowAbs) atAbs = nowAbs;       // already retired → measure at now
    var months = atAbs - nowAbs;

    var sources = [], guaranteed = 0;

    // Global income sources (VA, pension, rental…), projected to retirement.
    (settings.incomeSources || []).forEach(function (src, i) {
      var startAbs = has(src.startAge) ? birthAbsA + num(src.startAge) * 12 : atAbs;
      if (atAbs >= startAbs) {
        var amt = inflate(num(src.monthly), num(src.colaPct, 0), months);
        if (amt > 0) { sources.push({ key: 'src', srcIndex: i, label: src.label || 'Income', amount: amt, taxable: !!src.taxable, removable: true }); guaranteed += amt; }
      }
    });
    var ssA = ssIncome(personA, num(scenario.claimAgeA, retireAge), atAbs, nowAbs, ssColaPct);
    var ssB = ssIncome(personB, num(scenario.claimAgeB, retireAge), atAbs, nowAbs, ssColaPct);
    if (ssA > 0) { sources.push({ key: 'ssA', label: 'Social Security' + (personA.name ? ' (' + personA.name + ')' : ' (You)'), amount: ssA, taxable: true }); guaranteed += ssA; }
    if (ssB > 0) { sources.push({ key: 'ssB', label: 'Social Security' + (personB.name ? ' (' + personB.name + ')' : ' (Spouse)'), amount: ssB, taxable: true }); guaranteed += ssB; }

    // Withdrawal: use the projection's value when given (reflects the chosen
    // strategy); otherwise fall back to the spending-gap default.
    var wTaxable = !settings.withdrawal || settings.withdrawal.taxable !== false;
    var withdrawal;
    if (opts.withdrawal != null) {
      withdrawal = Math.max(0, num(opts.withdrawal));
    } else {
      var spending = inflate(num(scenario.retirementSpending), inflationPct, months);
      withdrawal = Math.max(0, spending - guaranteed);
    }
    if (withdrawal > 0) sources.push({ key: 'withdrawal', label: 'Investment withdrawal', amount: withdrawal, taxable: wTaxable });

    sources.sort(function (x, y) { return y.amount - x.amount; });
    var monthlyIncome = guaranteed + withdrawal;
    var taxable = 0, taxfree = 0;
    sources.forEach(function (s) { if (s.taxable) taxable += s.amount; else taxfree += s.amount; });

    return {
      age: retireAge,
      sources: sources.map(function (s) { return { key: s.key, srcIndex: s.srcIndex, removable: !!s.removable, label: s.label, amount: Math.round(s.amount), taxable: s.taxable }; }),
      monthlyIncome: Math.round(monthlyIncome),
      annualIncome: Math.round(monthlyIncome * 12),
      taxableMonthly: Math.round(taxable),
      taxfreeMonthly: Math.round(taxfree)
    };
  }

  var api = {
    projectScenario: projectScenario,
    incomeBreakdown: incomeBreakdown,
    clampContributionPeriods: clampContributionPeriods,
    contributionStats: contributionStats,
    clampReturnPhases: clampReturnPhases,
    returnRateAt: returnRateAt,
    periodStartAbs: periodStartAbs, periodEndAbs: periodEndAbs,
    _helpers: { toAbs: toAbs, fromAbs: fromAbs, monthlyRate: monthlyRate, inflate: inflate, deflate: deflate, contributionAt: contributionAt, contributionFor: contributionFor, lumpAt: lumpAt }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RetEngine = api;
})(typeof window !== 'undefined' ? window : this);
