(function (global, factory) {
  const viewerModule = factory();
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = viewerModule;
  }
  viewerModule.bootstrap(global);
})(typeof window !== "undefined" ? window : undefined, function () {
  const fallbackGlobal = typeof globalThis !== "undefined" ? globalThis : {};

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

  function createViewer({
    document: doc = fallbackGlobal.document || null,
    fetch: fetchFn = fallbackGlobal.fetch || null,
    console: consoleObj = fallbackGlobal.console || null,
  } = {}) {
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
        setStatus("No verse data available.", true);
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

    async function loadBook() {
      if (!displayEl || !headerEl) {
        return null;
      }

      setStatus("Loading the SBLGNT text…");

      try {
        if (!fetchFn) {
          throw new Error("Fetch API is not available");
        }

        const response = await fetchFn("data/mark.json", { cache: "no-cache" });
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
        setStatus("Unable to load the Gospel of Mark at this time.", true);
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

    return {
      init,
      loadBook,
      renderVerses,
      setStatus,
      elements: {
        statusEl,
        containerEl,
        displayEl,
        headerEl,
      },
    };
  }

  function bootstrap(globalTarget) {
    const viewerInstance = createViewer({
      document: globalTarget && globalTarget.document,
      fetch: globalTarget && globalTarget.fetch,
      console: globalTarget && globalTarget.console,
    });

    if (globalTarget) {
      globalTarget.SBLGNTViewer = viewerInstance;
    }

    viewerInstance.init();
    return viewerInstance;
  }

  return { createViewer, bootstrap };
});
