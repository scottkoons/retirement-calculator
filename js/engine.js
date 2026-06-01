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
    var n = parseFloat(v);
    return isFinite(n) ? n : (dflt || 0);
  }

  function has(v) { return v != null && v !== ''; }

  // Active monthly contribution for a month given a base and scheduled changes.
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
    var mRate = monthlyRate(returnPct);

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

    for (var absM = nowAbs; absM <= endAbs; absM++) {
      var ageA = (absM - birthAbsA) / 12;
      var retired = absM >= retireAbs;

      balance *= (1 + mRate);                    // 1. investment growth
      balance += lumpAt(absM, scenario.lumpSums); // 2. lump sums (any phase)

      var incomeGross = 0, incomeTaxable = 0, spending = 0;

      if (!retired) {
        balance += contributionAt(absM, num(scenario.monthlyContribution), scenario.contributionChanges);
      } else {
        var ssA = ssIncome(personA, num(scenario.claimAgeA, retireAge), absM, nowAbs, ssColaPct);
        var ssB = ssIncome(personB, num(scenario.claimAgeB, retireAge), absM, nowAbs, ssColaPct);
        // VA disability rises by the same legally-mandated COLA as Social Security.
        var vaInc = has(va.monthly) ? inflate(num(va.monthly), ssColaPct, absM - nowAbs) : 0;
        incomeGross += ssA + ssB + vaInc;
        incomeTaxable += ssA + ssB; // SS counted taxable (simplified); VA is tax-free

        (scenario.extraIncome || []).forEach(function (e) {
          if (!has(e.startYear)) return;
          var sAbs = toAbs(num(e.startMonth, now.month), num(e.startYear));
          var eAbs = has(e.endYear) ? toAbs(num(e.endMonth, 12), num(e.endYear)) : Infinity;
          if (absM >= sAbs && absM <= eAbs) {
            var amt = inflate(num(e.monthly), num(e.colaPct, 0), absM - nowAbs);
            incomeGross += amt;
            if (e.taxable) incomeTaxable += amt;
          }
        });

        spending = inflate(num(scenario.retirementSpending), inflationPct, absM - nowAbs);
        var tax = incomeTaxable * taxPct / 100;
        balance += (incomeGross - tax - spending);
        if (retirementIncomeFirst === null) retirementIncomeFirst = incomeGross;
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

  var api = {
    projectScenario: projectScenario,
    _helpers: { toAbs: toAbs, fromAbs: fromAbs, monthlyRate: monthlyRate, inflate: inflate, deflate: deflate, contributionAt: contributionAt, lumpAt: lumpAt }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RetEngine = api;
})(typeof window !== 'undefined' ? window : this);
