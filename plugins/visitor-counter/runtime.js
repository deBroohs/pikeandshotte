(function () {
  const CONFIG = window.PikeShotteVisitorCounterConfig || {};
  const DEFAULT_SCRIPT_URL = "https://gc.zgo.at/count.js";
  const SUMMARY_RANGES = [
    { key: "total", label: "Всего", params: {} },
    { key: "month", label: "За месяц", params: { start: "month" } },
    { key: "week", label: "За неделю", params: { start: "week" } }
  ];

  if (!CONFIG.enabled && !CONFIG.summary?.enabled) {
    return;
  }

  if (shouldSkipTracking(CONFIG)) {
    debugLog(CONFIG, "Visitor counter skipped for local or file-based session.");
    return;
  }

  if (CONFIG.provider !== "goatcounter") {
    debugLog(CONFIG, `Unsupported visitor counter provider: ${String(CONFIG.provider || "")}`);
    return;
  }

  if (!CONFIG.endpoint) {
    debugLog(CONFIG, "Visitor counter endpoint is empty.");
    return;
  }

  if (CONFIG.enabled) {
    loadTrackingScript(CONFIG);
  }

  if (CONFIG.summary?.enabled) {
    whenReady(() => {
      mountSummaryWidget(CONFIG).catch((error) => {
        debugLog(CONFIG, `Visitor summary failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    });
  }

  function shouldSkipTracking(config) {
    if (config.allowLocal) {
      return false;
    }

    const hostname = window.location.hostname;
    return window.location.protocol === "file:" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";
  }

  function debugLog(config, message) {
    if (!config.debug) {
      return;
    }

    console.info("[visitor-counter]", message);
  }

  function loadTrackingScript(config) {
    if (document.querySelector('script[data-visitor-counter="goatcounter"]')) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.visitorCounter = "goatcounter";
    script.dataset.goatcounter = config.endpoint;

    if (config.allowLocal) {
      script.dataset.goatcounterSettings = JSON.stringify({ allow_local: true });
    }

    script.src = typeof config.scriptUrl === "string" && config.scriptUrl.trim()
      ? config.scriptUrl.trim()
      : DEFAULT_SCRIPT_URL;

    script.addEventListener("load", () => {
      debugLog(config, "Visitor counter loaded.");
    });

    script.addEventListener("error", () => {
      debugLog(config, "Visitor counter failed to load.");
    });

    (document.head || document.documentElement).appendChild(script);
  }

  function whenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }

  async function mountSummaryWidget(config) {
    const host = document.querySelector(".app-header");
    if (!host || host.querySelector(".visitor-counter-summary")) {
      return;
    }

    injectSummaryStyles();

    const widget = createSummaryWidget(config.summary?.title || "Статистика сайта");
    host.appendChild(widget);

    const stats = await loadSummaryStats(config);
    if (!stats.some((item) => item.count)) {
      widget.remove();
      debugLog(config, "Visitor summary has no public data yet.");
      return;
    }

    for (const stat of stats) {
      const valueNode = widget.querySelector(`[data-summary-key="${stat.key}"]`);
      if (valueNode) {
        valueNode.textContent = stat.count || "—";
      }
    }

    widget.hidden = false;
  }

  async function loadSummaryStats(config) {
    const results = await Promise.allSettled(
      SUMMARY_RANGES.map((range) => fetchSummaryCount(config, "TOTAL", range.params))
    );

    return SUMMARY_RANGES.map((range, index) => ({
      key: range.key,
      count: results[index].status === "fulfilled" ? results[index].value : "",
      error: results[index].status === "rejected" ? results[index].reason : null
    }));
  }

  async function fetchSummaryCount(config, path, params) {
    const url = buildCounterUrl(config.endpoint, path, params);
    const response = await fetch(url.toString(), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    return typeof payload.count === "string" && payload.count.trim()
      ? payload.count.trim()
      : "";
  }

  function buildCounterUrl(endpoint, path, params) {
    const url = new URL(`./counter/${encodeURIComponent(path)}.json`, endpoint);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url;
  }

  function createSummaryWidget(title) {
    const widget = document.createElement("aside");
    widget.className = "visitor-counter-summary";
    widget.hidden = true;
    widget.setAttribute("aria-live", "polite");
    widget.setAttribute("aria-label", title);

    const header = document.createElement("div");
    header.className = "visitor-counter-summary__header";

    const heading = document.createElement("p");
    heading.className = "visitor-counter-summary__title";
    heading.textContent = title;

    const badge = document.createElement("span");
    badge.className = "visitor-counter-summary__badge";
    badge.textContent = "GoatCounter";

    header.append(heading, badge);

    const grid = document.createElement("div");
    grid.className = "visitor-counter-summary__grid";

    SUMMARY_RANGES.forEach((range) => {
      const item = document.createElement("div");
      item.className = "visitor-counter-summary__item";

      const label = document.createElement("span");
      label.className = "visitor-counter-summary__label";
      label.textContent = range.label;

      const value = document.createElement("strong");
      value.className = "visitor-counter-summary__value";
      value.dataset.summaryKey = range.key;
      value.textContent = "…";

      item.append(label, value);
      grid.appendChild(item);
    });

    const note = document.createElement("p");
    note.className = "visitor-counter-summary__note";
    note.textContent = "GoatCounter показывает визиты сайта.";

    widget.append(header, grid, note);
    return widget;
  }

  function injectSummaryStyles() {
    if (document.getElementById("visitor-counter-summary-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "visitor-counter-summary-styles";
    style.textContent = `
      .visitor-counter-summary {
        position: absolute;
        top: 82px;
        right: 28px;
        z-index: 2;
        width: min(292px, calc(100% - 56px));
        padding: 14px 16px 15px;
        border-radius: 20px;
        border: 1px solid rgba(84, 39, 20, 0.18);
        background:
          linear-gradient(160deg, rgba(255, 251, 244, 0.92), rgba(245, 236, 218, 0.9));
        box-shadow: 0 16px 34px rgba(49, 31, 18, 0.12);
        backdrop-filter: blur(8px);
        color: #2f261d;
        pointer-events: none;
      }

      .visitor-counter-summary__header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .visitor-counter-summary__title,
      .visitor-counter-summary__note {
        margin: 0;
      }

      .visitor-counter-summary__title {
        color: #5a2a17;
        font: 800 0.74rem/1.2 var(--ui-font, "Trebuchet MS", sans-serif);
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .visitor-counter-summary__badge {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(84, 39, 20, 0.08);
        color: #5a2a17;
        font: 700 0.72rem/1 var(--ui-font, "Trebuchet MS", sans-serif);
        white-space: nowrap;
      }

      .visitor-counter-summary__grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .visitor-counter-summary__item {
        display: grid;
        gap: 6px;
        padding: 10px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.58);
        border: 1px solid rgba(84, 39, 20, 0.08);
      }

      .visitor-counter-summary__label {
        color: #6d6457;
        font: 700 0.68rem/1.15 var(--ui-font, "Trebuchet MS", sans-serif);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .visitor-counter-summary__value {
        color: #241b13;
        font-family: var(--display-font, Georgia, "Times New Roman", serif);
        font-size: 1.08rem;
        line-height: 1;
      }

      .visitor-counter-summary__note {
        margin-top: 10px;
        color: #5f564b;
        font: 600 0.76rem/1.35 var(--ui-font, "Trebuchet MS", sans-serif);
      }

      @media (max-width: 1180px) {
        .visitor-counter-summary {
          top: 88px;
          right: 24px;
          width: min(272px, calc(100% - 48px));
        }
      }

      @media (max-width: 760px) {
        .visitor-counter-summary {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }
})();
