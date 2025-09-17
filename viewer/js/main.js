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

  function createEmptyNavigationIndex() {
    return {
      chapters: [],
      chapterLookup: {},
      referenceLookup: {},
    };
  }

  function cloneNavigationIndex(index) {
    if (!index || typeof index !== "object") {
      return createEmptyNavigationIndex();
    }

    const clonedChapters = Array.isArray(index.chapters)
      ? index.chapters.map((chapter) => ({
          chapter: chapter.chapter,
          startIndex: chapter.startIndex,
          endIndex: chapter.endIndex,
          startReference: chapter.startReference,
          endReference: chapter.endReference,
          verses: Array.isArray(chapter.verses)
            ? chapter.verses.map((verse) => ({
                verse: verse.verse,
                index: verse.index,
                reference: verse.reference,
              }))
            : [],
        }))
      : [];

    const clonedChapterLookup = {};
    if (index.chapterLookup && typeof index.chapterLookup === "object") {
      for (const [key, value] of Object.entries(index.chapterLookup)) {
        clonedChapterLookup[key] = {
          chapter: value.chapter,
          startIndex: value.startIndex,
          endIndex: value.endIndex,
          startReference: value.startReference,
          endReference: value.endReference,
        };
      }
    }

    const clonedReferenceLookup = {};
    if (index.referenceLookup && typeof index.referenceLookup === "object") {
      for (const [reference, value] of Object.entries(index.referenceLookup)) {
        clonedReferenceLookup[reference] = {
          index: value.index,
          chapter: value.chapter,
          verse: value.verse,
        };
      }
    }

    return {
      chapters: clonedChapters,
      chapterLookup: clonedChapterLookup,
      referenceLookup: clonedReferenceLookup,
    };
  }

  function buildNavigationIndex(verses) {
    if (!Array.isArray(verses) || verses.length === 0) {
      return createEmptyNavigationIndex();
    }

    const navigationIndex = createEmptyNavigationIndex();
    let currentChapterEntry = null;
    let currentChapterNumber = null;

    for (let index = 0; index < verses.length; index += 1) {
      const verse = verses[index];
      const reference =
        verse && typeof verse.reference === "string" ? verse.reference.trim() : "";

      if (!reference) {
        continue;
      }

      const match = reference.match(/^(?<book>.+?)\s+(?<chapter>\d+):(?<verse>\d+)$/);
      const chapterNumber = match && match.groups ? Number.parseInt(match.groups.chapter, 10) : NaN;
      const verseNumber = match && match.groups ? Number.parseInt(match.groups.verse, 10) : NaN;

      if (Number.isNaN(chapterNumber) || Number.isNaN(verseNumber)) {
        continue;
      }

      if (currentChapterNumber !== chapterNumber) {
        currentChapterNumber = chapterNumber;
        currentChapterEntry = {
          chapter: chapterNumber,
          startIndex: index,
          endIndex: index,
          startReference: reference,
          endReference: reference,
          verses: [],
        };

        navigationIndex.chapters.push(currentChapterEntry);
        navigationIndex.chapterLookup[String(chapterNumber)] = {
          chapter: chapterNumber,
          startIndex: index,
          endIndex: index,
          startReference: reference,
          endReference: reference,
        };
      }

      if (!currentChapterEntry) {
        continue;
      }

      currentChapterEntry.endIndex = index;
      currentChapterEntry.endReference = reference;

      const verseEntry = {
        verse: verseNumber,
        index,
        reference,
      };

      currentChapterEntry.verses.push(verseEntry);
      navigationIndex.chapterLookup[String(currentChapterEntry.chapter)].endIndex = index;
      navigationIndex.chapterLookup[String(currentChapterEntry.chapter)].endReference = reference;

      navigationIndex.referenceLookup[reference] = {
        index,
        chapter: chapterNumber,
        verse: verseNumber,
      };
    }

    return navigationIndex;
  }

  function parsePositiveInteger(value) {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return null;
  }

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
      containerState: "idle",
      navigationIndex: createEmptyNavigationIndex(),
      activeReference: "",
      activeBookId: null,
      activeBookDisplayName: "",
      referenceControlsEnabled: false,
    };

    const statusEl = doc ? doc.getElementById("viewer-status") : null;
    const containerEl = doc ? doc.getElementById("text-container") : null;
    const displayEl = doc ? doc.getElementById("book-display") : null;
    const headerEl = doc ? doc.getElementById("book-header") : null;
    const selectorEl = doc ? doc.getElementById("book-selector") : null;
    const sourcePathEl = doc ? doc.getElementById("book-source-path") : null;
    const referenceJumpForm = doc ? doc.getElementById("reference-jump-form") : null;
    const referenceChapterInput = doc ? doc.getElementById("reference-jump-chapter") : null;
    const referenceVerseInput = doc ? doc.getElementById("reference-jump-verse") : null;
    const referenceJumpSubmit = doc ? doc.getElementById("reference-jump-submit") : null;
    const referenceJumpHintEl = doc ? doc.getElementById("reference-jump-hint") : null;
    const safeConsole = resolveConsole(consoleObj);

    function updateReferenceHint(isEnabled) {
      if (!referenceJumpHintEl) {
        return;
      }

      referenceJumpHintEl.textContent = isEnabled
        ? "Enter a chapter and verse number to move directly to that passage."
        : "Jump controls will be enabled after the text loads.";
    }

    function setReferenceControlsEnabled(nextEnabled) {
      const resolved = !!nextEnabled;
      viewerState.referenceControlsEnabled = resolved;

      if (referenceJumpForm) {
        referenceJumpForm.dataset.state = resolved ? "ready" : "disabled";
        referenceJumpForm.setAttribute("aria-disabled", resolved ? "false" : "true");
      }

      if (referenceChapterInput) {
        referenceChapterInput.disabled = !resolved;
      }

      if (referenceVerseInput) {
        referenceVerseInput.disabled = !resolved;
      }

      if (referenceJumpSubmit) {
        referenceJumpSubmit.disabled = !resolved;
      }

      updateReferenceHint(resolved);
    }

    function resetReferenceInputs() {
      if (referenceChapterInput) {
        referenceChapterInput.value = "";
      }
      if (referenceVerseInput) {
        referenceVerseInput.value = "";
      }
    }

    function getChapterEntry(chapterNumber) {
      if (
        !viewerState.navigationIndex ||
        !Array.isArray(viewerState.navigationIndex.chapters) ||
        viewerState.navigationIndex.chapters.length === 0
      ) {
        return null;
      }

      return (
        viewerState.navigationIndex.chapters.find(
          (chapter) => chapter && chapter.chapter === chapterNumber,
        ) || null
      );
    }

    function highlightVerse(reference) {
      if (!containerEl || !reference) {
        return false;
      }

      const verseElements = Array.from(containerEl.children || []);
      let targetElement = null;

      for (const element of verseElements) {
        if (element && element.dataset && element.dataset.reference === reference) {
          targetElement = element;
          break;
        }
      }

      if (!targetElement) {
        return false;
      }

      for (const element of verseElements) {
        if (!element || !element.dataset) {
          continue;
        }

        if (element === targetElement) {
          element.dataset.active = "true";
          if (typeof element.scrollIntoView === "function") {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        } else {
          delete element.dataset.active;
        }
      }

      viewerState.activeReference = reference;
      return true;
    }

    function syncContainerMessageAttributes() {
      if (!containerEl) {
        return;
      }

      containerEl.dataset.loadingText = viewerState.messages.loading;
      containerEl.dataset.emptyText = viewerState.messages.empty;
      containerEl.dataset.errorText = viewerState.messages.error;
    }

    function updateContainerState(nextState) {
      if (!containerEl) {
        return;
      }

      const resolvedState =
        typeof nextState === "string" && nextState.trim() ? nextState.trim() : "idle";

      viewerState.containerState = resolvedState;
      containerEl.dataset.state = resolvedState;

      if (typeof containerEl.setAttribute === "function") {
        const isLoading = resolvedState === "loading";
        containerEl.setAttribute("aria-busy", isLoading ? "true" : "false");
      }
    }

    syncContainerMessageAttributes();
    updateContainerState(viewerState.containerState);
    resetReferenceInputs();
    setReferenceControlsEnabled(false);

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

    setStatus("");

    function renderVerses(verses) {
      viewerState.navigationIndex = buildNavigationIndex(verses);
      viewerState.activeReference = "";

      const hasContainer = !!containerEl && !!doc;
      const hasVerses = Array.isArray(verses) && verses.length > 0;

      resetReferenceInputs();
      setReferenceControlsEnabled(hasVerses && hasContainer);

      if (!hasVerses) {
        if (hasContainer) {
          containerEl.innerHTML = "";
          updateContainerState("empty");
        }
        setStatus(viewerState.messages.empty, true);
        return;
      }

      if (!hasContainer) {
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
      updateContainerState("ready");
    }

    function getNavigationIndex() {
      return cloneNavigationIndex(viewerState.navigationIndex);
    }

    function jumpToReference(target = {}) {
      const input = target && typeof target === "object" ? target : {};

      let rawChapter = null;
      if (Object.prototype.hasOwnProperty.call(input, "chapter")) {
        rawChapter = input.chapter;
      } else if (Object.prototype.hasOwnProperty.call(input, "chapterNumber")) {
        rawChapter = input.chapterNumber;
      }
      const chapterNumber = parsePositiveInteger(rawChapter);

      if (!chapterNumber) {
        setStatus("Enter a valid chapter number to jump to a passage.", true);
        return false;
      }

      if (
        !viewerState.navigationIndex ||
        !Array.isArray(viewerState.navigationIndex.chapters) ||
        viewerState.navigationIndex.chapters.length === 0
      ) {
        setStatus("No text is currently available for navigation.", true);
        return false;
      }

      const chapterEntry = getChapterEntry(chapterNumber);
      if (!chapterEntry) {
        setStatus(`Chapter ${chapterNumber} is not available in this text.`, true);
        return false;
      }

      let rawVerse = null;
      if (Object.prototype.hasOwnProperty.call(input, "verse")) {
        rawVerse = input.verse;
      } else if (Object.prototype.hasOwnProperty.call(input, "verseNumber")) {
        rawVerse = input.verseNumber;
      }
      let resolvedVerseNumber = null;

      if (rawVerse !== null && rawVerse !== undefined && String(rawVerse).trim() !== "") {
        resolvedVerseNumber = parsePositiveInteger(rawVerse);
        if (!resolvedVerseNumber) {
          setStatus(`Enter a valid verse number for chapter ${chapterNumber}.`, true);
          return false;
        }
      }

      let targetVerseEntry = null;
      if (resolvedVerseNumber === null) {
        targetVerseEntry =
          Array.isArray(chapterEntry.verses) && chapterEntry.verses.length > 0
            ? chapterEntry.verses[0]
            : null;
      } else {
        targetVerseEntry = Array.isArray(chapterEntry.verses)
          ? chapterEntry.verses.find((entry) => entry && entry.verse === resolvedVerseNumber) || null
          : null;
      }

      if (!targetVerseEntry) {
        const verseSegment =
          resolvedVerseNumber === null ? "" : `, verse ${resolvedVerseNumber}`;
        setStatus(`Chapter ${chapterNumber}${verseSegment} is not available in this text.`, true);
        return false;
      }

      if (!targetVerseEntry.reference) {
        return false;
      }

      const highlighted = highlightVerse(targetVerseEntry.reference);
      if (!highlighted) {
        return false;
      }

      if (referenceChapterInput) {
        referenceChapterInput.value = String(chapterEntry.chapter);
      }
      if (referenceVerseInput) {
        referenceVerseInput.value = String(targetVerseEntry.verse);
      }

      setStatus("");
      return true;
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

      updateContainerState("loading");
      if (containerEl) {
        containerEl.innerHTML = "";
      }
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

        const payloadBookId =
          typeof payload.book_id === "string" && payload.book_id.trim()
            ? payload.book_id.trim()
            : typeof payload.bookId === "string" && payload.bookId.trim()
              ? payload.bookId.trim()
              : viewerState.selectedBookId;

        viewerState.activeBookId = payloadBookId || viewerState.selectedBookId || null;
        viewerState.activeBookDisplayName = displayName;

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

        const hasVerses = Array.isArray(payload.verses) && payload.verses.length > 0;
        renderVerses(payload.verses);
        if (hasVerses) {
          setStatus("");
        }
        return payload;
      } catch (error) {
        safeConsole.error(error);
        setStatus(viewerState.messages.error, true);
        updateContainerState("error");
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
      viewerState.activeBookId = book.bookId;
      viewerState.activeBookDisplayName = book.displayName;
      viewerState.activeReference = "";
      viewerState.navigationIndex = createEmptyNavigationIndex();
      resetReferenceInputs();
      setReferenceControlsEnabled(false);

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

      if (referenceJumpForm) {
        referenceJumpForm.addEventListener("submit", (event) => {
          if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
          }

          if (!viewerState.referenceControlsEnabled) {
            return;
          }

          const chapterValue = referenceChapterInput ? referenceChapterInput.value : undefined;
          const verseValue = referenceVerseInput ? referenceVerseInput.value : undefined;
          const success = jumpToReference({ chapter: chapterValue, verse: verseValue });

          if (!success && referenceChapterInput && typeof referenceChapterInput.focus === "function") {
            referenceChapterInput.focus();
          }
        });
      }

      const startViewer = async () => {
        updateContainerState("loading");
        setStatus(viewerState.messages.loading);
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
        syncContainerMessageAttributes();
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
      jumpToReference,
      getNavigationIndex,
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
