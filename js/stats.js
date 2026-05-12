const STATS_KEY = "motus.stats";
const WON_KEY = "motus.wonWords";

const DEFAULT_STATS = {
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
};

function _readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function _writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

function getStats() {
  const s = _readJSON(STATS_KEY, null);
  if (!s) return JSON.parse(JSON.stringify(DEFAULT_STATS));
  return {
    played: s.played || 0,
    won: s.won || 0,
    currentStreak: s.currentStreak || 0,
    maxStreak: s.maxStreak || 0,
    distribution: Object.assign({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, s.distribution || {})
  };
}

function getWonWords(length) {
  const all = _readJSON(WON_KEY, {});
  const arr = all[String(length)];
  return Array.isArray(arr) ? arr.slice() : [];
}

function _addWonWord(word, length) {
  const all = _readJSON(WON_KEY, {});
  const key = String(length);
  const arr = Array.isArray(all[key]) ? all[key] : [];
  if (!arr.includes(word)) arr.push(word);
  all[key] = arr;
  _writeJSON(WON_KEY, all);
}

function resetWonWords(length) {
  const all = _readJSON(WON_KEY, {});
  if (length === undefined) {
    _writeJSON(WON_KEY, {});
  } else {
    all[String(length)] = [];
    _writeJSON(WON_KEY, all);
  }
}

function recordResult(won, attempts, word, length) {
  const s = getStats();
  s.played += 1;
  if (won) {
    s.won += 1;
    s.currentStreak += 1;
    if (s.currentStreak > s.maxStreak) s.maxStreak = s.currentStreak;
    if (attempts >= 1 && attempts <= 6) s.distribution[attempts] = (s.distribution[attempts] || 0) + 1;
    if (word && length) _addWonWord(word, length);
  } else {
    s.currentStreak = 0;
  }
  _writeJSON(STATS_KEY, s);
  return s;
}

function getWonCounts() {
  const all = _readJSON(WON_KEY, {});
  const out = {};
  for (const k of ["5","6","7","8","9"]) {
    out[k] = Array.isArray(all[k]) ? all[k].length : 0;
  }
  return out;
}

window.MotusStats = {
  getStats,
  getWonWords,
  resetWonWords,
  recordResult,
  getWonCounts
};
