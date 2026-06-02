/*
 * storage.js — Automatic persistence + file backup/restore.
 *
 * Data lives in the browser's localStorage (free, instant, never expires).
 * There is no "Save" button: save() is debounced and called on every change.
 * Backup/restore move the same JSON to/from a file on disk.
 */
(function (global) {
  'use strict';
  var KEY = 'retirementApp.v1';

  function defaultState() {
    return {
      settings: {
        personA: { name: '', birthMonth: 1, birthYear: 1960, ss: { 62: '', 65: '', 66: '', 67: '', 70: '' } },
        personB: { name: '', birthMonth: 1, birthYear: 1962, ss: { 62: '', 65: '', 66: '', 67: '', 70: '' } },
        vaDisability: { monthly: '' },
        assumptions: { returnPct: 6, inflationPct: 3, ssColaPct: 2.5, effectiveTaxPct: 12 },
        // Optional glide path: taper return before/at retirement. Off by default.
        returnThrottle: { preEnabled: false, preYears: 3, preRate: 6, atEnabled: false, atRate: 5 },
        // Withdrawal strategy is global so the same rule compares across scenarios.
        withdrawal: { type: 'spending', ratePct: 4, amount: '', taxable: true },
        currentSavings: ''
      },
      scenarios: [],
      selectedScenarioIds: [],
      editingId: null,
      activeTab: 'dashboard',
      dollarBasis: 'nominal',
      theme: ''
    };
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return defaultState();
      var data = JSON.parse(raw);
      var base = defaultState();
      // shallow-merge top level, deep-merge settings so new fields get defaults
      var merged = Object.assign(base, data);
      merged.settings = Object.assign(base.settings, data.settings || {});
      merged.settings.assumptions = Object.assign(defaultState().settings.assumptions, (data.settings || {}).assumptions || {});
      merged.settings.returnThrottle = Object.assign(defaultState().settings.returnThrottle, (data.settings || {}).returnThrottle || {});
      merged.settings.withdrawal = Object.assign(defaultState().settings.withdrawal, (data.settings || {}).withdrawal || {});
      (merged.scenarios || []).forEach(function (s) {
        migrateScenario(s);
        if (global.RetEngine && global.RetEngine.clampContributionPeriods) {
          s.contributionPeriods = global.RetEngine.clampContributionPeriods(s.contributionPeriods || []);
        }
      });
      return merged;
    } catch (e) {
      console.error('Failed to load state', e);
      return defaultState();
    }
  }

  // Convert the legacy contribution model (base amount + dated change rows) into
  // the contribution-period timeline. Runs once; afterward contributionPeriods
  // exists and the old fields are dropped.
  function migrateScenario(s) {
    if (!s || s.contributionPeriods) return;
    var periods = [];
    var base = s.monthlyContribution;
    var hasBase = base != null && base !== '';
    var changes = (s.contributionChanges || []).slice().filter(function (c) { return c.year != null && c.year !== ''; });
    changes.sort(function (a, b) { return (a.year * 12 + a.month) - (b.year * 12 + b.month); });
    if (hasBase || changes.length) {
      // First period: the base amount, starting "from the beginning" (blank start).
      if (hasBase) periods.push({ name: '', startMonth: '', startYear: '', endMonth: '', endYear: '', monthly: base });
      changes.forEach(function (c, i) {
        periods.push({ name: '', startMonth: c.month, startYear: c.year, endMonth: '', endYear: '', monthly: c.newMonthly });
      });
    }
    s.contributionPeriods = periods;
    delete s.monthlyContribution;
    delete s.contributionChanges;
    // Normalize any overlaps in stored data right away.
    if (global.RetEngine && global.RetEngine.clampContributionPeriods) {
      s.contributionPeriods = global.RetEngine.clampContributionPeriods(s.contributionPeriods);
    }
  }

  var saveTimer = null;
  function save(state, onSaved) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        global.localStorage.setItem(KEY, JSON.stringify(state));
        if (onSaved) onSaved(true);
      } catch (e) {
        console.error('Failed to save', e);
        if (onSaved) onSaved(false);
      }
    }, 250);
  }

  function exportFile(state) {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'retirement-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importFile(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      try { cb(null, JSON.parse(reader.result)); }
      catch (e) { cb(e); }
    };
    reader.onerror = function () { cb(reader.error); };
    reader.readAsText(file);
  }

  global.RetStorage = {
    KEY: KEY, defaultState: defaultState, load: load, save: save,
    exportFile: exportFile, importFile: importFile
  };
})(window);
