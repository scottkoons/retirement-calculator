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
        vaDisability: { monthly: '', colaPct: 2.5 },
        assumptions: { returnPct: 6, inflationPct: 3, ssColaPct: 2.5, effectiveTaxPct: 12 },
        currentSavings: ''
      },
      scenarios: [],
      selectedScenarioIds: [],
      editingId: null,
      activeTab: 'dashboard',
      dollarBasis: 'nominal'
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
      return merged;
    } catch (e) {
      console.error('Failed to load state', e);
      return defaultState();
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
