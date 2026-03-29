(function () {
  const CONFIG = window.PikeShotteVisitorCounterConfig || {};

  if (!CONFIG.summary?.enabled) {
    return;
  }

  const refreshIntervalMs = Math.max(15000, Number(CONFIG.refreshIntervalSeconds || 30) * 1000);
  let refreshTimer = 0;

  whenReady(() => {
    const badges = Array.from(document.querySelectorAll(".site-visitor-badge[data-live-src]"));
    if (!badges.length) {
      return;
    }

    badges.forEach((badge) => {
      if (!badge.dataset.liveSrc) {
        badge.dataset.liveSrc = badge.getAttribute("src") || "";
      }
    });

    refreshBadges(badges, true);
    refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshBadges(badges, false);
      }
    }, refreshIntervalMs);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refreshBadges(badges, false);
      }
    });

    window.addEventListener("focus", () => {
      refreshBadges(badges, false);
    });

    window.addEventListener("beforeunload", () => {
      if (refreshTimer) {
        window.clearInterval(refreshTimer);
      }
    }, { once: true });
  });

  function refreshBadges(badges, immediate) {
    const stamp = immediate ? Date.now() : Math.floor(Date.now() / refreshIntervalMs) * refreshIntervalMs;
    badges.forEach((badge) => {
      const baseUrl = badge.dataset.liveSrc;
      if (!baseUrl) {
        return;
      }

      const refreshedUrl = withRefreshStamp(baseUrl, stamp);
      if (badge.src !== refreshedUrl) {
        badge.src = refreshedUrl;
      }
    });
  }

  function withRefreshStamp(baseUrl, stamp) {
    try {
      const url = new URL(baseUrl, window.location.href);
      url.searchParams.set("live", String(stamp));
      return url.toString();
    } catch (_error) {
      const separator = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${separator}live=${stamp}`;
    }
  }

  function whenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }
})();
