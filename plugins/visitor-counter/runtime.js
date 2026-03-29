(function () {
  const CONFIG = window.PikeShotteVisitorCounterConfig || {};

  if (!CONFIG.summary?.enabled) {
    return;
  }

  const refreshIntervalMs = Math.max(15000, Number(CONFIG.refreshIntervalSeconds || 30) * 1000);
  const sessionWindowMs = Math.max(5, Number(CONFIG.sessionMinutes || 30)) * 60 * 1000;
  const counterPrefix = CONFIG.counterKeyPrefix || "site-counter";
  const storageKey = `${counterPrefix}-last-visit-at`;
  const pendingVisitKey = `${counterPrefix}-pending-visit`;
  const statsCacheKey = `${counterPrefix}-stats`;
  const totalKey = `${counterPrefix}-all`;
  const todayKey = `${counterPrefix}-today-${getDateKey(CONFIG.timeZone || "UTC")}`;
  const minimumRefreshGapMs = Math.min(refreshIntervalMs, 10000);
  let refreshTimer = 0;
  let refreshPromise = null;
  let lastRefreshAt = 0;

  whenReady(() => {
    const card = document.querySelector(".site-visitor-card");
    const refs = {
      total: document.querySelector("[data-visitor-total]"),
      today: document.querySelector("[data-visitor-today]")
    };

    if (!card || !refs.total || !refs.today) {
      return;
    }

    if (!shouldDisplaySummary()) {
      card.hidden = true;
      return;
    }

    const hasCachedStats = renderCachedStats(refs);
    card.hidden = false;

    initialize(refs).catch(() => {
      if (!hasCachedStats) {
        refs.total.textContent = "-";
        refs.today.textContent = "-";
      }
    });
  });

  async function initialize(refs) {
    if (hasPendingVisit() || shouldStartVisit()) {
      await recordVisit();
    }

    await refreshStats(refs, { force: true });

    const refreshVisibleStats = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (hasPendingVisit()) {
        recordVisit().catch(() => {});
      }

      refreshStats(refs).catch(() => {});
    };

    refreshTimer = window.setInterval(refreshVisibleStats, refreshIntervalMs);

    document.addEventListener("visibilitychange", () => {
      refreshVisibleStats();
    });

    window.addEventListener("focus", () => {
      refreshVisibleStats();
    });

    window.addEventListener("beforeunload", () => {
      if (refreshTimer) {
        window.clearInterval(refreshTimer);
      }
    }, { once: true });
  }

  function shouldStartVisit() {
    if (!CONFIG.enabled) {
      return false;
    }

    if (window.location.protocol === "file:") {
      return false;
    }

    if (Boolean(CONFIG.allowLocal) === false && isLocalHost(window.location.hostname)) {
      return false;
    }

    const lastVisitAt = Number(window.localStorage.getItem(storageKey) || 0);
    return !Number.isFinite(lastVisitAt) || Date.now() - lastVisitAt >= sessionWindowMs;
  }

  async function recordVisit() {
    let pendingVisit = readPendingVisit();

    if (!pendingVisit) {
      pendingVisit = {
        dayKey: todayKey,
        totalDone: false,
        todayDone: false,
        startedAt: Date.now()
      };
      writePendingVisit(pendingVisit);
    }

    if (!pendingVisit.totalDone) {
      await hitCounter(totalKey);
      pendingVisit.totalDone = true;
      writePendingVisit(pendingVisit);
    }

    if (!pendingVisit.todayDone) {
      await hitCounter(todayKey);
      pendingVisit.todayDone = true;
      writePendingVisit(pendingVisit);
    }

    if (pendingVisit.totalDone && pendingVisit.todayDone) {
      window.localStorage.setItem(storageKey, String(Date.now()));
      clearPendingVisit();
    }
  }

  async function refreshStats(refs, { force = false } = {}) {
    if (refreshPromise) {
      return refreshPromise;
    }

    if (!force && lastRefreshAt && Date.now() - lastRefreshAt < minimumRefreshGapMs) {
      return;
    }

    refreshPromise = (async () => {
      const [total, today] = await Promise.all([
        getCounterValue(totalKey),
        getCounterValue(todayKey)
      ]);

      const stats = {
        total: Math.max(total, today),
        today,
        updatedAt: Date.now()
      };

      applyStats(refs, stats);
      cacheStats(stats);
      lastRefreshAt = stats.updatedAt;
    })();

    try {
      await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  async function hitCounter(key) {
    const response = await fetch(`${getApiBaseUrl()}/hit/${encodeURIComponent(key)}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  async function getCounterValue(key) {
    const response = await fetch(`${getApiBaseUrl()}/get/${encodeURIComponent(key)}`, {
      method: "GET",
      cache: "no-store"
    });

    if (response.status === 404) {
      return 0;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const value = Number(payload?.value);
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  function getApiBaseUrl() {
    return String(CONFIG.apiBaseUrl || "https://countapi.mileshilliard.com/api/v1").replace(/\/$/, "");
  }

  function hasPendingVisit() {
    return Boolean(readPendingVisit());
  }

  function readPendingVisit() {
    try {
      const rawValue = window.localStorage.getItem(pendingVisitKey);

      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue);

      if (!parsedValue || parsedValue.dayKey !== todayKey) {
        clearPendingVisit();
        return null;
      }

      return {
        dayKey: todayKey,
        totalDone: Boolean(parsedValue.totalDone),
        todayDone: Boolean(parsedValue.todayDone),
        startedAt: Number(parsedValue.startedAt) || Date.now()
      };
    } catch (_error) {
      clearPendingVisit();
      return null;
    }
  }

  function writePendingVisit(pendingVisit) {
    window.localStorage.setItem(pendingVisitKey, JSON.stringify({
      dayKey: pendingVisit.dayKey,
      totalDone: Boolean(pendingVisit.totalDone),
      todayDone: Boolean(pendingVisit.todayDone),
      startedAt: Number(pendingVisit.startedAt) || Date.now()
    }));
  }

  function clearPendingVisit() {
    window.localStorage.removeItem(pendingVisitKey);
  }

  function getDateKey(timeZone) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });

    const parts = formatter.formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value || "0000";
    const month = parts.find((part) => part.type === "month")?.value || "00";
    const day = parts.find((part) => part.type === "day")?.value || "00";
    return `${year}-${month}-${day}`;
  }

  function isLocalHost(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ru-RU").format(value);
  }

  function shouldDisplaySummary() {
    if (window.matchMedia("(max-width: 860px)").matches) {
      return false;
    }

    if (navigator.connection?.saveData) {
      return false;
    }

    const effectiveType = navigator.connection?.effectiveType || "";
    return !effectiveType.includes("2g");
  }

  function renderCachedStats(refs) {
    const cached = loadCachedStats();
    if (!cached) {
      return false;
    }

    applyStats(refs, cached);
    lastRefreshAt = cached.updatedAt;
    return true;
  }

  function loadCachedStats() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(statsCacheKey) || "null");
      const total = Number(parsed?.total);
      const today = Number(parsed?.today);
      const updatedAt = Number(parsed?.updatedAt);

      if (!Number.isFinite(total) || !Number.isFinite(today) || !Number.isFinite(updatedAt)) {
        return null;
      }

      return {
        total: Math.max(Math.round(total), Math.round(today), 0),
        today: Math.max(0, Math.round(today)),
        updatedAt
      };
    } catch (_error) {
      return null;
    }
  }

  function cacheStats(stats) {
    try {
      window.localStorage.setItem(statsCacheKey, JSON.stringify(stats));
    } catch (_error) {
      return;
    }
  }

  function applyStats(refs, stats) {
    refs.total.textContent = formatNumber(Math.max(stats.total, stats.today));
    refs.today.textContent = formatNumber(stats.today);
  }

  function whenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }
})();
