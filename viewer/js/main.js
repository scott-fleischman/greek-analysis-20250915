(function (global, factory) {
  const viewerModule = factory();
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = viewerModule;
  }
  viewerModule.bootstrap(global);
})(typeof window !== "undefined" ? window : undefined, function () {
  const fallbackGlobal = typeof globalThis !== "undefined" ? globalThis : {};
  const DEFAULT_DATA_URL = "data/mark.json";
  const DEFAULT_STATUS_MESSAGES = {
    loading: "Loading the SBLGNT text…",
    error: "Unable to load the Gospel of Mark at this time.",
    empty: "No verse data available.",
  };

  function resolveConsole(consoleObj) {
    if (consoleObj && typeof consoleObj.error === "function") {
      return consoleObj;
    }
    return {
      error() {
        /* noop */
      },
    };
  }

  function normalizeStatusMessages(messages) {
    if (!messages || typeof messages !== "object") {
      return {};
    }

    const normalized = {};
    for (const [key, value] of Object.entries(messages)) {
      if (typeof value === "string") {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  function createViewer({
    document: doc = fallbackGlobal.document || null,
    fetch: fetchFn = fallbackGlobal.fetch || null,
    console: consoleObj = fallbackGlobal.console || null,
    dataUrl = DEFAULT_DATA_URL,
    statusMessages = {},
  } = {}) {
    const statusConfig = {
      ...DEFAULT_STATUS_MESSAGES,
      ...normalizeStatusMessages(statusMessages),
    };

    const viewerState = {
      dataUrl: typeof dataUrl === "string" && dataUrl.trim() ? dataUrl : DEFAULT_DATA_URL,
      messages: statusConfig,
    };

    const statusEl = doc ? doc.getElementById("viewer-status") : null;
    const containerEl = doc ? doc.getElementById("text-container") : null;
    const displayEl = doc ? doc.getElementById("book-display") : null;
    const headerEl = doc ? doc.getElementById("book-header") : null;
    const safeConsole = resolveConsole(consoleObj);

    function setStatus(message, isError = false) {
      if (!statusEl) {
        return;
      }

      if (message) {
        statusEl.textContent = message;
        statusEl.style.display = "block";
        statusEl.style.borderLeftColor = isError ? "#a23b3b" : "";
      } else {
        statusEl.textContent = "";
        statusEl.style.display = "none";
        statusEl.style.borderLeftColor = "";
      }
    }

    function renderVerses(verses) {
      if (!Array.isArray(verses) || verses.length === 0) {
        setStatus(viewerState.messages.empty, true);
        if (containerEl) {
          containerEl.innerHTML = "";
        }
        return;
      }

      if (!containerEl || !doc) {
        return;
      }

      containerEl.innerHTML = "";

      const fragment = doc.createDocumentFragment();
      for (const verse of verses) {
        const verseEl = doc.createElement("article");
        verseEl.className = "verse";
        verseEl.dataset.reference = verse.reference;

        const referenceEl = doc.createElement("span");
        referenceEl.className = "verse-ref";
        referenceEl.textContent = verse.reference;

        const textEl = doc.createElement("span");
        textEl.className = "verse-text";
        textEl.textContent = verse.text;

        verseEl.append(referenceEl, textEl);
        fragment.appendChild(verseEl);
      }

      containerEl.appendChild(fragment);
    }

    async function loadBook(loadOptions = {}) {
      if (!displayEl || !headerEl) {
        return null;
      }

      const overrideUrl =
        loadOptions && typeof loadOptions === "object" ? loadOptions.dataUrl : undefined;
      const targetUrl =
        typeof overrideUrl === "string" && overrideUrl.trim()
          ? overrideUrl
          : viewerState.dataUrl;

      setStatus(viewerState.messages.loading);

      try {
        if (!fetchFn) {
          throw new Error("Fetch API is not available");
        }

        const response = await fetchFn(targetUrl, { cache: "no-cache" });
        if (!response || !response.ok) {
          const status = response ? response.status : "unknown";
          throw new Error(`Request failed with status ${status}`);
        }

        const payload = await response.json();
        const displayName = payload.display_name || "Gospel of Mark";
        const header = payload.header || "";

        displayEl.textContent = displayName;
        headerEl.textContent = header;
        if (doc) {
          doc.title = `${displayName} · SBLGNT Viewer`;
        }

        renderVerses(payload.verses);
        setStatus("");
        return payload;
      } catch (error) {
        safeConsole.error(error);
        setStatus(viewerState.messages.error, true);
        return null;
      }
    }

    function init() {
      if (!doc || !containerEl || !displayEl || !headerEl) {
        return false;
      }

      if (doc.readyState === "loading") {
        const onReady = () => {
          doc.removeEventListener("DOMContentLoaded", onReady);
          void loadBook();
        };
        doc.addEventListener("DOMContentLoaded", onReady);
      } else {
        void loadBook();
      }
      return true;
    }

    function configure(newConfig = {}) {
      if (!newConfig || typeof newConfig !== "object") {
        return {
          dataUrl: viewerState.dataUrl,
          statusMessages: { ...viewerState.messages },
        };
      }

      if (typeof newConfig.dataUrl === "string" && newConfig.dataUrl.trim()) {
        viewerState.dataUrl = newConfig.dataUrl;
      }

      const normalizedMessages = normalizeStatusMessages(newConfig.statusMessages);
      if (Object.keys(normalizedMessages).length > 0) {
        viewerState.messages = {
          ...viewerState.messages,
          ...normalizedMessages,
        };
      }

      return {
        dataUrl: viewerState.dataUrl,
        statusMessages: { ...viewerState.messages },
      };
    }

    return {
      init,
      loadBook,
      renderVerses,
      setStatus,
      configure,
      elements: {
        statusEl,
        containerEl,
        displayEl,
        headerEl,
      },
    };
  }

  function isBootstrapConfig(value) {
    if (!value || typeof value !== "object") {
      return false;
    }
    const configKeys = [
      "globalTarget",
      "dataUrl",
      "globalPropertyName",
      "autoInit",
      "statusMessages",
    ];
    return configKeys.some((key) => Object.prototype.hasOwnProperty.call(value, key));
  }

  function bootstrap(globalOrConfig, maybeOptions) {
    let explicitConfig = {};
    let globalTarget = globalOrConfig;

    if (isBootstrapConfig(globalOrConfig)) {
      explicitConfig = { ...globalOrConfig };
      globalTarget = explicitConfig.globalTarget;
    }

    if (isBootstrapConfig(maybeOptions)) {
      explicitConfig = { ...explicitConfig, ...maybeOptions };
      if (maybeOptions.globalTarget) {
        globalTarget = maybeOptions.globalTarget;
      }
    }

    if (!globalTarget && fallbackGlobal.window) {
      globalTarget = fallbackGlobal.window;
    }

    const globalConfig =
      globalTarget &&
      typeof globalTarget === "object" &&
      (globalTarget.SBLGNTViewerConfig || globalTarget.__SBLGNT_VIEWER_CONFIG__);

    const resolvedStatusMessages = {
      ...(globalConfig && typeof globalConfig.statusMessages === "object"
        ? normalizeStatusMessages(globalConfig.statusMessages)
        : {}),
      ...(explicitConfig.statusMessages && typeof explicitConfig.statusMessages === "object"
        ? normalizeStatusMessages(explicitConfig.statusMessages)
        : {}),
    };

    const viewerOptions = {};
    const resolvedDataUrl =
      explicitConfig.dataUrl !== undefined
        ? explicitConfig.dataUrl
        : globalConfig && typeof globalConfig.dataUrl === "string"
          ? globalConfig.dataUrl
          : undefined;

    if (typeof resolvedDataUrl === "string" && resolvedDataUrl.trim()) {
      viewerOptions.dataUrl = resolvedDataUrl;
    }

    if (Object.keys(resolvedStatusMessages).length > 0) {
      viewerOptions.statusMessages = resolvedStatusMessages;
    }

    const viewerInstance = createViewer({
      document: globalTarget && globalTarget.document,
      fetch: globalTarget && globalTarget.fetch,
      console: globalTarget && globalTarget.console,
      ...viewerOptions,
    });

    const propertyName =
      explicitConfig.globalPropertyName !== undefined
        ? explicitConfig.globalPropertyName
        : globalConfig && Object.prototype.hasOwnProperty.call(globalConfig, "globalPropertyName")
          ? globalConfig.globalPropertyName
          : "SBLGNTViewer";

    if (globalTarget && typeof propertyName === "string" && propertyName.length > 0) {
      globalTarget[propertyName] = viewerInstance;
    }

    const autoInitPreference =
      explicitConfig.autoInit !== undefined
        ? explicitConfig.autoInit
        : globalConfig && Object.prototype.hasOwnProperty.call(globalConfig, "autoInit")
          ? globalConfig.autoInit
          : undefined;

    const shouldInit = autoInitPreference !== false;

    if (shouldInit) {
      viewerInstance.init();
    }

    return viewerInstance;
  }

  return { createViewer, bootstrap };
});
