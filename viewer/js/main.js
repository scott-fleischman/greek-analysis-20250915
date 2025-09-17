(function (global, factory) {
  const viewerModule = factory();
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = viewerModule;
  }
  viewerModule.bootstrap(global);
})(typeof window !== "undefined" ? window : undefined, function () {
  const fallbackGlobal = typeof globalThis !== "undefined" ? globalThis : {};
  const DEFAULT_DATA_URL = "data/mark.json";
  const DEFAULT_MANIFEST_URL = "data/manifest.json";
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
    manifestUrl = DEFAULT_MANIFEST_URL,
    statusMessages = {},
  } = {}) {
    const statusConfig = {
      ...DEFAULT_STATUS_MESSAGES,
      ...normalizeStatusMessages(statusMessages),
    };

    const viewerState = {
      dataUrl: typeof dataUrl === "string" && dataUrl.trim() ? dataUrl : DEFAULT_DATA_URL,
      manifestUrl:
        typeof manifestUrl === "string" && manifestUrl.trim() ? manifestUrl : DEFAULT_MANIFEST_URL,
      messages: statusConfig,
      books: [],
      bookMap: new Map(),
      selectedBookId: null,
      manifestLoaded: false,
      sourcePath: "",
    };

    const statusEl = doc ? doc.getElementById("viewer-status") : null;
    const containerEl = doc ? doc.getElementById("text-container") : null;
    const displayEl = doc ? doc.getElementById("book-display") : null;
    const headerEl = doc ? doc.getElementById("book-header") : null;
    const selectorEl = doc ? doc.getElementById("book-selector") : null;
    const sourcePathEl = doc ? doc.getElementById("book-source-path") : null;
    const safeConsole = resolveConsole(consoleObj);

    if (selectorEl) {
      selectorEl.disabled = true;
    }

    function normalizeBookEntry(entry) {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const rawId =
        typeof entry.book_id === "string"
          ? entry.book_id
          : typeof entry.bookId === "string"
            ? entry.bookId
            : "";
      const bookId = rawId.trim();
      if (!bookId) {
        return null;
      }

      const rawDataUrl =
        typeof entry.data_url === "string"
          ? entry.data_url
          : typeof entry.dataUrl === "string"
            ? entry.dataUrl
            : "";
      const dataUrl = rawDataUrl.trim();
      if (!dataUrl) {
        return null;
      }

      const displayName =
        typeof entry.display_name === "string" && entry.display_name.trim()
          ? entry.display_name.trim()
          : typeof entry.displayName === "string" && entry.displayName.trim()
            ? entry.displayName.trim()
            : bookId;

      const header =
        typeof entry.header === "string" && entry.header.trim() ? entry.header : "";

      const rawSourcePath =
        typeof entry.source_path === "string"
          ? entry.source_path
          : typeof entry.sourcePath === "string"
            ? entry.sourcePath
            : "";
      const sourcePath = rawSourcePath.trim();

      return {
        bookId,
        dataUrl,
        displayName,
        header,
        sourcePath,
      };
    }

    function updateSelectorOptions(books, selectedBookId) {
      if (!selectorEl || !doc) {
        return;
      }

      selectorEl.innerHTML = "";

      for (const book of books) {
        const optionEl = doc.createElement("option");
        optionEl.value = book.bookId;
        optionEl.textContent = book.displayName;
        optionEl.dataset.dataUrl = book.dataUrl;
        selectorEl.appendChild(optionEl);
      }

      if (selectedBookId) {
        selectorEl.value = selectedBookId;
      }
    }

    function getBookById(bookId) {
      if (!bookId) {
        return null;
      }
      return viewerState.bookMap.get(bookId) || null;
    }

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
        const payloadSourcePath =
          typeof payload.source_path === "string" && payload.source_path.trim()
            ? payload.source_path.trim()
            : typeof payload.sourcePath === "string" && payload.sourcePath.trim()
              ? payload.sourcePath.trim()
              : "";

        displayEl.textContent = displayName;
        headerEl.textContent = header;
        if (doc) {
          doc.title = `${displayName} · SBLGNT Viewer`;
        }

        if (payloadSourcePath) {
          viewerState.sourcePath = payloadSourcePath;
        }

        if (sourcePathEl) {
          sourcePathEl.textContent = viewerState.sourcePath || "";
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

    async function selectBook(bookId, options = {}) {
      const book = getBookById(bookId);
      if (!book) {
        return null;
      }

      viewerState.selectedBookId = book.bookId;
      viewerState.dataUrl = book.dataUrl;
      viewerState.sourcePath = book.sourcePath || "";

      if (selectorEl && selectorEl.value !== book.bookId) {
        selectorEl.value = book.bookId;
      }

      if (displayEl) {
        displayEl.textContent = book.displayName;
      }

      if (headerEl) {
        headerEl.textContent = book.header || "";
      }

      if (doc) {
        doc.title = `${book.displayName} · SBLGNT Viewer`;
      }

      if (sourcePathEl) {
        sourcePathEl.textContent = viewerState.sourcePath || "";
      }

      if (options && options.skipLoad) {
        return null;
      }

      return loadBook({ dataUrl: book.dataUrl });
    }

    async function loadManifest(manifestOptions = {}) {
      if (!selectorEl) {
        return null;
      }

      const overrideUrl =
        manifestOptions && typeof manifestOptions === "object"
          ? manifestOptions.manifestUrl
          : undefined;

      const targetUrl =
        typeof overrideUrl === "string" && overrideUrl.trim()
          ? overrideUrl.trim()
          : viewerState.manifestUrl;

      if (selectorEl) {
        selectorEl.disabled = true;
      }

      try {
        if (!fetchFn) {
          throw new Error("Fetch API is not available for the manifest");
        }

        viewerState.manifestUrl = targetUrl;

        const response = await fetchFn(targetUrl, { cache: "no-cache" });
        if (!response || !response.ok) {
          const status = response ? response.status : "unknown";
          throw new Error(`Manifest request failed with status ${status}`);
        }

        const manifestData = await response.json();
        if (!manifestData || !Array.isArray(manifestData.books)) {
          throw new Error("Manifest payload is missing the books array");
        }

        const normalizedBooks = manifestData.books.map(normalizeBookEntry).filter(Boolean);

        if (normalizedBooks.length === 0) {
          throw new Error("Manifest does not contain any usable book entries");
        }

        viewerState.books = normalizedBooks;
        viewerState.bookMap = new Map(normalizedBooks.map((book) => [book.bookId, book]));
        viewerState.manifestLoaded = true;

        const matchingBook =
          normalizedBooks.find((book) => book.dataUrl === viewerState.dataUrl) || normalizedBooks[0];

        updateSelectorOptions(normalizedBooks, matchingBook.bookId);
        selectorEl.disabled = false;

        await selectBook(matchingBook.bookId);
        return manifestData;
      } catch (error) {
        safeConsole.error(error);
        if (selectorEl) {
          selectorEl.disabled = true;
        }
        return null;
      }
    }

    function init() {
      if (!doc || !containerEl || !displayEl || !headerEl) {
        return false;
      }

      if (selectorEl) {
        selectorEl.addEventListener("change", (event) => {
          const target = event && event.target ? event.target : selectorEl;
          const nextBookId = target && typeof target.value === "string" ? target.value : "";
          if (!nextBookId || !viewerState.bookMap.has(nextBookId)) {
            return;
          }
          void selectBook(nextBookId);
        });
      }

      const startViewer = async () => {
        if (selectorEl) {
          const manifestResult = await loadManifest();
          if (!manifestResult) {
            await loadBook();
          }
        } else {
          await loadBook();
        }
      };

      if (doc.readyState === "loading") {
        const onReady = () => {
          doc.removeEventListener("DOMContentLoaded", onReady);
          void startViewer();
        };
        doc.addEventListener("DOMContentLoaded", onReady);
      } else {
        void startViewer();
      }
      return true;
    }

    function configure(newConfig = {}) {
      if (!newConfig || typeof newConfig !== "object") {
        return {
          dataUrl: viewerState.dataUrl,
          manifestUrl: viewerState.manifestUrl,
          statusMessages: { ...viewerState.messages },
        };
      }

      if (typeof newConfig.dataUrl === "string" && newConfig.dataUrl.trim()) {
        viewerState.dataUrl = newConfig.dataUrl.trim();
      }

      if (typeof newConfig.manifestUrl === "string" && newConfig.manifestUrl.trim()) {
        viewerState.manifestUrl = newConfig.manifestUrl.trim();
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
        manifestUrl: viewerState.manifestUrl,
        statusMessages: { ...viewerState.messages },
      };
    }

    return {
      init,
      loadBook,
      loadManifest,
      selectBook,
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
      "manifestUrl",
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
      viewerOptions.dataUrl = resolvedDataUrl.trim();
    }

    const resolvedManifestUrl =
      explicitConfig.manifestUrl !== undefined
        ? explicitConfig.manifestUrl
        : globalConfig && typeof globalConfig.manifestUrl === "string"
          ? globalConfig.manifestUrl
          : undefined;

    if (typeof resolvedManifestUrl === "string" && resolvedManifestUrl.trim()) {
      viewerOptions.manifestUrl = resolvedManifestUrl.trim();
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
