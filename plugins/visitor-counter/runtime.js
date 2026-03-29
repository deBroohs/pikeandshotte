(function () {
  const CONFIG = window.PikeShotteVisitorCounterConfig || {};
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

  if (!CONFIG.summary?.enabled) {
    return;
  }

  whenReady(() => {
    initializeSummary().catch((error) => {
      debugLog(`Visitor counter failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  });

  async function initializeSummary() {
    const card = document.querySelector(".site-visitor-card");
    if (!card) {
      return;
    }

    const domain = getTrackedDomain();
    if (!domain) {
      card.hidden = true;
      return;
    }

    const stats = await loadStats(domain);
    if (!stats) {
      card.hidden = true;
      return;
    }

    renderSummary(card, stats);
    card.hidden = false;
  }

  async function loadStats(domain) {
    if (shouldRecordVisit(domain)) {
      try {
        const postedStats = normalizeStats(await postVisit(domain));
        if (postedStats) {
          return postedStats;
        }
      } catch (error) {
        debugLog(`POST /visit failed, falling back to GET: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    try {
      return normalizeStats(await getStats(domain));
    } catch (error) {
      debugLog(`GET /visit failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  function renderSummary(card, stats) {
    const totalNode = card.querySelector("[data-visitor-total]");
    const todayNode = card.querySelector("[data-visitor-today]");

    if (totalNode) {
      totalNode.textContent = formatNumber(stats.totalCount);
    }

    if (todayNode) {
      todayNode.textContent = formatNumber(stats.todayCount);
    }
    card.hidden = false;
  }

  async function postVisit(domain) {
    const response = await fetch(`${CONFIG.apiBaseUrl.replace(/\/$/, "")}/visit`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        domain: encodeURIComponent(domain),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        page_path: window.location.pathname,
        page_title: document.title,
        referrer: document.referrer,
        search_query: extractSearchQuery(document.referrer)
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  async function getStats(domain) {
    const url = new URL(`${CONFIG.apiBaseUrl.replace(/\/$/, "")}/visit`);
    url.searchParams.set("domain", domain);

    let response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      const encodedUrl = new URL(`${CONFIG.apiBaseUrl.replace(/\/$/, "")}/visit`);
      encodedUrl.searchParams.set("domain", encodeURIComponent(domain));
      response = await fetch(encodedUrl.toString(), {
        method: "GET",
        cache: "no-store"
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  function normalizeStats(payload) {
    const totalCount = Number(payload?.totalCount);
    const todayCount = Number(payload?.todayCount);

    if (!Number.isFinite(totalCount) || !Number.isFinite(todayCount)) {
      return null;
    }

    return {
      totalCount: Math.max(0, Math.round(totalCount)),
      todayCount: Math.max(0, Math.round(todayCount))
    };
  }

  function getTrackedDomain() {
    if (typeof CONFIG.domain === "string" && CONFIG.domain.trim()) {
      return CONFIG.domain.trim();
    }

    return window.location.hostname || "";
  }

  function shouldRecordVisit(domain) {
    if (!CONFIG.enabled) {
      return false;
    }

    if (window.location.protocol === "file:") {
      return false;
    }

    const hostname = window.location.hostname;
    if (!hostname) {
      return false;
    }

    if (hostname === domain) {
      return true;
    }

    return Boolean(CONFIG.allowLocal) && LOCAL_HOSTS.has(hostname);
  }

  function extractSearchQuery(referrer) {
    if (!referrer) {
      return "";
    }

    try {
      const url = new URL(referrer);
      if (url.hostname.includes("google.")) {
        return url.searchParams.get("q") || "";
      }
      if (url.hostname.includes("bing.")) {
        return url.searchParams.get("q") || "";
      }
      if (url.hostname.includes("yahoo.")) {
        return url.searchParams.get("p") || "";
      }
      if (url.hostname.includes("duckduckgo.")) {
        return url.searchParams.get("q") || "";
      }
    } catch (_error) {
      return "";
    }

    return "";
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ru-RU").format(value);
  }

  function debugLog(message) {
    if (!CONFIG.debug) {
      return;
    }

    console.info("[visitor-counter]", message);
  }

  function whenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }
})();
