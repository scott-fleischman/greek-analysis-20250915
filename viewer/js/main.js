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
      orderedReferences: [],
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

    const clonedOrderedReferences = Array.isArray(index.orderedReferences)
      ? index.orderedReferences.map((entry) =>
          entry && typeof entry === "object"
            ? {
                index: entry.index,
                reference: entry.reference,
                chapter: entry.chapter,
                verse: entry.verse,
              }
            : entry,
        )
      : [];

    return {
      chapters: clonedChapters,
      chapterLookup: clonedChapterLookup,
      referenceLookup: clonedReferenceLookup,
      orderedReferences: clonedOrderedReferences,
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

      navigationIndex.orderedReferences.push({
        index,
        reference,
        chapter: chapterNumber,
        verse: verseNumber,
      });
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
      clauseDataUrl: "",
      clausePayload: null,
      clauseLookup: new Map(),
      clauseDetails: new Map(),
      clausesAvailable: false,
      clauseOverlayEnabled: true,
      containerState: "idle",
      navigationIndex: createEmptyNavigationIndex(),
      currentVerses: [],
      activeReference: "",
      activeClauseId: "",
      activeBookId: null,
      activeBookDisplayName: "",
      referenceControlsEnabled: false,
      clausePanelCollapsed: false,
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
    const referencePreviousButton = doc ? doc.getElementById("reference-jump-previous") : null;
    const referenceNextButton = doc ? doc.getElementById("reference-jump-next") : null;
    const clauseControlsEl = doc ? doc.getElementById("clause-controls") : null;
    const clauseToggleEl = doc ? doc.getElementById("clause-overlay-toggle") : null;
    const clauseStatusEl = doc ? doc.getElementById("clause-overlay-status") : null;
    const clauseDetailsEl = doc ? doc.getElementById("clause-details") : null;
    const clauseSummaryPrimaryEl = doc ? doc.getElementById("clause-summary-primary") : null;
    const clauseSummaryFunctionEl = doc ? doc.getElementById("clause-summary-function") : null;
    const clauseCollapseButton = doc ? doc.getElementById("clause-panel-collapse") : null;
    const safeConsole = resolveConsole(consoleObj);

    function updateReferenceHint(isEnabled) {
      if (!referenceJumpHintEl) {
        return;
      }

      referenceJumpHintEl.textContent = isEnabled
        ? "Enter a chapter and verse number to move directly to that passage."
        : "Jump controls will be enabled after the text loads.";
    }

    function setElementDisabledState(element, shouldDisable) {
      if (!element) {
        return;
      }

      const resolvedDisabled = !!shouldDisable;

      if ("disabled" in element) {
        element.disabled = resolvedDisabled;
      }

      const hasAttributeControls =
        typeof element.setAttribute === "function" && typeof element.removeAttribute === "function";

      if (hasAttributeControls) {
        if (resolvedDisabled) {
          element.setAttribute("disabled", "");
        } else {
          element.removeAttribute("disabled");
        }
      }
    }

    function setReferenceControlsEnabled(nextEnabled) {
      const resolved = !!nextEnabled;
      viewerState.referenceControlsEnabled = resolved;

      if (referenceJumpForm) {
        referenceJumpForm.dataset.state = resolved ? "ready" : "disabled";
        referenceJumpForm.setAttribute("aria-disabled", resolved ? "false" : "true");
      }

      const shouldDisable = !resolved;

      setElementDisabledState(referenceChapterInput, shouldDisable);
      setElementDisabledState(referenceVerseInput, shouldDisable);
      setElementDisabledState(referenceJumpSubmit, shouldDisable);
      setElementDisabledState(referencePreviousButton, shouldDisable);
      setElementDisabledState(referenceNextButton, shouldDisable);

      if (referencePreviousButton) {
        referencePreviousButton.setAttribute("aria-disabled", shouldDisable ? "true" : "false");
      }
      if (referenceNextButton) {
        referenceNextButton.setAttribute("aria-disabled", shouldDisable ? "true" : "false");
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

    setElementDisabledState(selectorEl, true);

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

      const rawClauseDataUrl =
        typeof entry.clause_data_url === "string"
          ? entry.clause_data_url
          : typeof entry.clauseDataUrl === "string"
            ? entry.clauseDataUrl
            : "";
      const clauseDataUrl = rawClauseDataUrl.trim();

      return {
        bookId,
        dataUrl,
        displayName,
        header,
        sourcePath,
        clauseDataUrl,
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
    setClausePanelCollapsed(false);
    clearClauseState();

    function setClausePanelCollapsed(nextCollapsed) {
      const collapsed = !!nextCollapsed;
      viewerState.clausePanelCollapsed = collapsed;

      if (clauseControlsEl) {
        clauseControlsEl.dataset.collapsed = collapsed ? "true" : "false";
        if (collapsed) {
          clauseControlsEl.classList.add("clause-panel--collapsed");
        } else {
          clauseControlsEl.classList.remove("clause-panel--collapsed");
        }
      }

      if (clauseCollapseButton) {
        clauseCollapseButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
        clauseCollapseButton.textContent = collapsed
          ? "Expand clause header"
          : "Collapse clause header";
      }
    }

    function toggleClausePanelCollapsed() {
      setClausePanelCollapsed(!viewerState.clausePanelCollapsed);
    }

    function clearClauseState() {
      viewerState.clausePayload = null;
      viewerState.clauseLookup = new Map();
      viewerState.clauseDetails = new Map();
      viewerState.clausesAvailable = false;
      viewerState.activeClauseId = "";
      if (viewerState.clausePanelCollapsed) {
        setClausePanelCollapsed(false);
      }
      syncClauseControlsVisibility();
      renderClauseDetails("");
      updateClauseStatusMessage();
      applyActiveClauseStyling();
    }

    function syncClauseControlsVisibility() {
      if (!clauseControlsEl) {
        return;
      }

      const shouldShow = !!viewerState.clausesAvailable;
      clauseControlsEl.hidden = !shouldShow;
      clauseControlsEl.dataset.state = shouldShow ? "ready" : "hidden";

      if (clauseToggleEl) {
        clauseToggleEl.disabled = !shouldShow;
        clauseToggleEl.checked = viewerState.clauseOverlayEnabled;
        clauseToggleEl.setAttribute("aria-pressed", viewerState.clauseOverlayEnabled ? "true" : "false");
      }
    }

    function updateClauseStatusMessage() {
      if (!clauseStatusEl) {
        return;
      }

      if (!viewerState.clausesAvailable) {
        clauseStatusEl.textContent = "Clause highlights are not available for this text yet.";
        return;
      }

      if (!viewerState.clauseOverlayEnabled) {
        clauseStatusEl.textContent = "Clause highlights are hidden. Enable the toggle to inspect clause metadata.";
        return;
      }

      if (viewerState.activeClauseId) {
        clauseStatusEl.textContent = `Showing details for clause ${viewerState.activeClauseId}.`;
      } else {
        clauseStatusEl.textContent = "Select a highlighted clause to view clause details.";
      }
    }

    function updateClauseSummary(targetClauseId) {
      if (!clauseSummaryPrimaryEl || !clauseSummaryFunctionEl) {
        return;
      }

      const normalizedId = typeof targetClauseId === "string" ? targetClauseId.trim() : "";
      const bookName = viewerState.activeBookDisplayName || "";
      const primarySegments = [];

      if (bookName) {
        primarySegments.push(bookName);
      }

      let clauseDetail = null;
      if (normalizedId && viewerState.clauseDetails instanceof Map) {
        clauseDetail = viewerState.clauseDetails.get(normalizedId) || null;
      }

      const references = clauseDetail && Array.isArray(clauseDetail.references)
        ? clauseDetail.references
        : [];
      const referenceText =
        references.length > 0
          ? references[0]
          : viewerState.activeReference && viewerState.activeReference.trim()
            ? viewerState.activeReference.trim()
            : "";

      if (referenceText) {
        primarySegments.push(referenceText);
      }

      if (normalizedId) {
        primarySegments.push(`Clause ${normalizedId}`);
      }

      clauseSummaryPrimaryEl.textContent =
        primarySegments.length > 0 ? primarySegments.join(" · ") : "Clause overview";

      if (!viewerState.clausesAvailable) {
        clauseSummaryFunctionEl.textContent =
          "Clause highlights are not available for this text yet.";
        return;
      }

      if (!viewerState.clauseOverlayEnabled) {
        clauseSummaryFunctionEl.textContent =
          "Clause highlights are hidden. Enable the toggle to inspect clause metadata.";
        return;
      }

      if (!normalizedId || !clauseDetail) {
        clauseSummaryFunctionEl.textContent =
          "Select a highlighted clause to view its metadata.";
        return;
      }

      if (clauseDetail.functionText) {
        clauseSummaryFunctionEl.textContent = clauseDetail.functionText;
      } else if (references.length > 0) {
        clauseSummaryFunctionEl.textContent = `${normalizedId} · ${references.join(", ")}`;
      } else {
        clauseSummaryFunctionEl.textContent = `Clause ${normalizedId}`;
      }
    }

    function renderClauseDetails(targetClauseId) {
      updateClauseSummary(targetClauseId);

      if (!clauseDetailsEl) {
        return;
      }

      clauseDetailsEl.innerHTML = "";

      if (!viewerState.clausesAvailable) {
        return;
      }

      if (!viewerState.clauseOverlayEnabled) {
        const message = doc.createElement("p");
        message.className = "clause-details__empty";
        message.textContent = "Enable clause highlights to explore clause metadata.";
        clauseDetailsEl.appendChild(message);
        return;
      }

      const normalizedId = typeof targetClauseId === "string" ? targetClauseId.trim() : "";

      if (!normalizedId) {
        const message = doc.createElement("p");
        message.className = "clause-details__empty";
        message.textContent = "Select a highlighted clause to view its metadata.";
        clauseDetailsEl.appendChild(message);
        return;
      }

      const clauseDetail = viewerState.clauseDetails.get(normalizedId);
      if (!clauseDetail) {
        const message = doc.createElement("p");
        message.className = "clause-details__empty";
        message.textContent = "Clause metadata is unavailable for this selection.";
        clauseDetailsEl.appendChild(message);
        return;
      }

      const fragment = doc.createDocumentFragment();
      let hasContent = false;

      if (clauseDetail.functionText) {
        const functionEl = doc.createElement("p");
        functionEl.className = "clause-details__function";
        functionEl.textContent = clauseDetail.functionText;
        fragment.appendChild(functionEl);
        hasContent = true;
      }

      const listEl = doc.createElement("dl");
      listEl.className = "clause-detail-list";

      function appendDefinition(termText, value) {
        const dt = doc.createElement("dt");
        dt.textContent = termText;
        const dd = doc.createElement("dd");

        if (Array.isArray(value)) {
          if (value.length === 0) {
            dd.textContent = "—";
          } else {
            for (const entry of value) {
              const pill = doc.createElement("span");
              pill.className = "clause-detail__tag";
              pill.textContent = entry;
              dd.appendChild(pill);
            }
          }
        } else if (typeof value === "string" && value.trim()) {
          dd.textContent = value.trim();
        } else {
          dd.textContent = "—";
        }

        listEl.appendChild(dt);
        listEl.appendChild(dd);
      }

      appendDefinition("Clause ID", normalizedId);
      appendDefinition(
        "References",
        clauseDetail.references.length > 0 ? clauseDetail.references.join(", ") : "—",
      );
      appendDefinition("Category Tags", clauseDetail.categoryTags);
      if (clauseDetail.sourceSummary) {
        appendDefinition("Source", clauseDetail.sourceSummary);
      }

      if (listEl.children.length > 0) {
        fragment.appendChild(listEl);
        hasContent = true;
      }

      if (clauseDetail.parentClauseId) {
        const parentContainer = doc.createElement("div");
        parentContainer.className = "clause-detail__relations";

        const parentHeading = doc.createElement("p");
        parentHeading.className = "clause-detail__relations-heading";
        parentHeading.textContent = "Parent clause";
        parentContainer.appendChild(parentHeading);

        const parentButton = doc.createElement("button");
        parentButton.type = "button";
        parentButton.className = "clause-detail__link";
        parentButton.dataset.clauseTarget = clauseDetail.parentClauseId;
        parentButton.textContent =
          clauseDetail.parentSummary && clauseDetail.parentSummary.trim()
            ? `${clauseDetail.parentClauseId} · ${clauseDetail.parentSummary.trim()}`
            : clauseDetail.parentClauseId;
        parentContainer.appendChild(parentButton);

        fragment.appendChild(parentContainer);
        hasContent = true;
      }

      if (Array.isArray(clauseDetail.childClauses) && clauseDetail.childClauses.length > 0) {
        const childrenContainer = doc.createElement("div");
        childrenContainer.className = "clause-detail__relations";

        const childHeading = doc.createElement("p");
        childHeading.className = "clause-detail__relations-heading";
        childHeading.textContent = "Sub-clauses";
        childrenContainer.appendChild(childHeading);

        const childList = doc.createElement("ul");
        childList.className = "clause-detail__relation-list";

        for (const child of clauseDetail.childClauses) {
          if (!child || !child.clauseId) {
            continue;
          }

          const item = doc.createElement("li");

          const childButton = doc.createElement("button");
          childButton.type = "button";
          childButton.className = "clause-detail__link";
          childButton.dataset.clauseTarget = child.clauseId;

          const labelParts = [child.clauseId];
          if (child.label && child.label.trim()) {
            labelParts.push(child.label.trim());
          } else if (child.role && child.role.trim()) {
            labelParts.push(child.role.trim());
          }

          childButton.textContent = labelParts.join(" · ");
          item.appendChild(childButton);
          childList.appendChild(item);
        }

        if (childList.children.length > 0) {
          childrenContainer.appendChild(childList);
          fragment.appendChild(childrenContainer);
          hasContent = true;
        }
      }

      if (!hasContent) {
        const message = doc.createElement("p");
        message.className = "clause-details__empty";
        message.textContent = "Clause metadata is not available for this selection.";
        fragment.appendChild(message);
      }

      clauseDetailsEl.appendChild(fragment);
    }

    function applyActiveClauseStyling() {
      if (!containerEl || typeof containerEl.querySelectorAll !== "function") {
        return;
      }

      const highlightNodes = containerEl.querySelectorAll(".clause-highlight");
      if (!highlightNodes || typeof highlightNodes[Symbol.iterator] !== "function") {
        return;
      }

      for (const node of highlightNodes) {
        if (!node || !node.dataset) {
          continue;
        }

        const clauseId = typeof node.dataset.clauseId === "string" ? node.dataset.clauseId : "";

        if (!clauseId) {
          node.removeAttribute("aria-pressed");
          node.removeAttribute("role");
          node.removeAttribute("tabindex");
          continue;
        }

        if (viewerState.clauseOverlayEnabled) {
          node.setAttribute("role", "button");
          node.setAttribute("tabindex", "0");
        } else {
          node.removeAttribute("tabindex");
        }

        if (viewerState.activeClauseId && clauseId === viewerState.activeClauseId) {
          node.dataset.active = "true";
          node.setAttribute("aria-pressed", "true");
        } else {
          delete node.dataset.active;
          node.setAttribute("aria-pressed", "false");
        }
      }
    }

    function setActiveClauseId(nextClauseId) {
      const normalizedId = typeof nextClauseId === "string" ? nextClauseId.trim() : "";
      viewerState.activeClauseId = normalizedId;
      applyActiveClauseStyling();
    }

    function findClauseHighlightTarget(startNode) {
      let node = startNode;
      while (node && node !== containerEl) {
        if (node.classList && typeof node.classList.contains === "function") {
          if (node.classList.contains("clause-highlight")) {
            return node;
          }
        } else if (node.className === "clause-highlight") {
          return node;
        }

        node = node.parentElement || node.parentNode || null;
      }
      return null;
    }

    function findClauseDetailTarget(startNode) {
      let node = startNode;
      while (node && node !== clauseDetailsEl) {
        if (node.dataset && typeof node.dataset.clauseTarget === "string" && node.dataset.clauseTarget) {
          return node;
        }
        node = node.parentElement || node.parentNode || null;
      }
      return null;
    }

    function handleClauseDetailsClick(event) {
      if (!clauseDetailsEl) {
        return;
      }

      const targetNode = findClauseDetailTarget(event ? event.target : null);
      if (!targetNode || !targetNode.dataset) {
        return;
      }

      const clauseId = typeof targetNode.dataset.clauseTarget === "string"
        ? targetNode.dataset.clauseTarget.trim()
        : "";
      if (!clauseId) {
        return;
      }

      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }

      setActiveClauseId(clauseId);
      renderClauseDetails(clauseId);
      updateClauseStatusMessage();

      const clauseDetail = viewerState.clauseDetails.get(clauseId);
      if (clauseDetail && Array.isArray(clauseDetail.references) && clauseDetail.references.length > 0) {
        highlightVerse(clauseDetail.references[0]);
      }
    }

    function handleClauseHighlightSelection(event) {
      if (!viewerState.clausesAvailable || !viewerState.clauseOverlayEnabled) {
        return;
      }

      const targetNode = findClauseHighlightTarget(event ? event.target : null);
      if (!targetNode || !targetNode.dataset) {
        return;
      }

      const clauseId = typeof targetNode.dataset.clauseId === "string" ? targetNode.dataset.clauseId : "";
      if (!clauseId) {
        return;
      }

      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }

      setActiveClauseId(clauseId);
      renderClauseDetails(clauseId);
      updateClauseStatusMessage();
    }

    function handleClauseHighlightClick(event) {
      handleClauseHighlightSelection(event);
    }

    function handleClauseHighlightKeydown(event) {
      if (!event) {
        return;
      }

      const key = typeof event.key === "string" ? event.key : "";
      if (key !== "Enter" && key !== " " && key !== "Spacebar") {
        return;
      }

      handleClauseHighlightSelection(event);
    }

    function setClauseOverlayEnabled(nextEnabled) {
      const resolved = !!nextEnabled;
      viewerState.clauseOverlayEnabled = resolved;

      if (clauseToggleEl) {
        clauseToggleEl.checked = resolved;
        clauseToggleEl.setAttribute("aria-pressed", resolved ? "true" : "false");
      }

      if (!resolved) {
        viewerState.activeClauseId = "";
      }

      syncClauseControlsVisibility();

      if (Array.isArray(viewerState.currentVerses) && viewerState.currentVerses.length > 0) {
        renderVerses(viewerState.currentVerses, { preserveActiveReference: true });
      } else {
        applyActiveClauseStyling();
        renderClauseDetails(viewerState.activeClauseId);
        updateClauseStatusMessage();
      }

      return viewerState.clauseOverlayEnabled;
    }

    if (clauseToggleEl) {
      clauseToggleEl.addEventListener("change", (event) => {
        const toggleTarget = event && event.target ? event.target : clauseToggleEl;
        const isChecked = !!(toggleTarget && toggleTarget.checked);
        setClauseOverlayEnabled(isChecked);
      });
    }

    if (clauseCollapseButton) {
      clauseCollapseButton.addEventListener("click", (event) => {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        toggleClausePanelCollapsed();
      });
    }

    if (containerEl) {
      containerEl.addEventListener("click", handleClauseHighlightClick);
      containerEl.addEventListener("keydown", handleClauseHighlightKeydown);
    }

    if (clauseDetailsEl) {
      clauseDetailsEl.addEventListener("click", handleClauseDetailsClick);
    }

    function buildClauseLookup(clausePayload) {
      const lookup = new Map();

      if (!clausePayload || typeof clausePayload !== "object") {
        return lookup;
      }

      const verseRegistry = new Map();
      if (Array.isArray(clausePayload.verses)) {
        for (const verseEntry of clausePayload.verses) {
          if (!verseEntry || typeof verseEntry !== "object") {
            continue;
          }

          const reference =
            typeof verseEntry.reference === "string" && verseEntry.reference.trim()
              ? verseEntry.reference.trim()
              : "";
          if (!reference) {
            continue;
          }

          const charCount =
            typeof verseEntry.character_count === "number" && Number.isFinite(verseEntry.character_count)
              ? verseEntry.character_count
              : null;

          verseRegistry.set(reference, {
            characterCount: charCount,
          });
        }
      }

      if (!Array.isArray(clausePayload.clauses)) {
        return lookup;
      }

      for (const clause of clausePayload.clauses) {
        if (!clause || typeof clause !== "object") {
          continue;
        }

        const analysis = clause.analysis && typeof clause.analysis === "object" ? clause.analysis : null;
        const isGroupOnly = !!(analysis && analysis.group_only === true);

        const clauseId =
          typeof clause.clause_id === "string" && clause.clause_id.trim() ? clause.clause_id.trim() : "";
        const clauseFunction =
          typeof clause.function === "string" && clause.function.trim() ? clause.function.trim() : "";

        const references = Array.isArray(clause.references)
          ? clause.references
              .map((reference) => (typeof reference === "string" && reference.trim() ? reference.trim() : ""))
              .filter(Boolean)
          : [];

        if (references.length === 0) {
          continue;
        }

        if (isGroupOnly) {
          continue;
        }

        const startOffset =
          clause.start && typeof clause.start.offset === "number" && Number.isFinite(clause.start.offset)
            ? Math.max(0, clause.start.offset)
            : 0;
        const endOffset =
          clause.end && typeof clause.end.offset === "number" && Number.isFinite(clause.end.offset)
            ? Math.max(startOffset, clause.end.offset)
            : startOffset;

        for (let index = 0; index < references.length; index += 1) {
          const reference = references[index];
          if (!reference) {
            continue;
          }

          const verseMeta = verseRegistry.get(reference);
          const charCount =
            verseMeta && typeof verseMeta.characterCount === "number" ? verseMeta.characterCount : null;

          let rangeStart = 0;
          let rangeEnd = charCount !== null ? charCount : endOffset;

          if (references.length === 1) {
            rangeStart = startOffset;
            rangeEnd = endOffset;
          } else if (index === 0) {
            rangeStart = startOffset;
            rangeEnd = charCount !== null ? charCount : endOffset;
          } else if (index === references.length - 1) {
            rangeStart = 0;
            rangeEnd = endOffset;
          } else {
            rangeStart = 0;
            rangeEnd = charCount !== null ? charCount : rangeEnd;
          }

          const categoryTags = Array.isArray(clause.category_tags)
            ? clause.category_tags
                .map((tag) => (typeof tag === "string" && tag.trim() ? tag.trim() : ""))
                .filter(Boolean)
            : [];

          const normalizedRange = {
            clauseId,
            startOffset: rangeStart,
            endOffset: rangeEnd,
            categoryTags,
            description: clauseFunction,
          };

          if (!lookup.has(reference)) {
            lookup.set(reference, []);
          }
          lookup.get(reference).push(normalizedRange);
        }
      }

      for (const ranges of lookup.values()) {
        ranges.sort((a, b) => {
          if (a.startOffset !== b.startOffset) {
            return a.startOffset - b.startOffset;
          }
          if (a.endOffset !== b.endOffset) {
            return a.endOffset - b.endOffset;
          }
          return a.clauseId.localeCompare(b.clauseId);
        });
      }

      return lookup;
    }

    function buildClauseDetails(clausePayload) {
      const details = new Map();

      if (!clausePayload || typeof clausePayload !== "object") {
        return details;
      }

      if (!Array.isArray(clausePayload.clauses)) {
        return details;
      }

      const childrenAccumulator = new Map();

      function ensureChildRecord(parentId, childId) {
        if (!childrenAccumulator.has(parentId)) {
          childrenAccumulator.set(parentId, new Map());
        }
        const parentMap = childrenAccumulator.get(parentId);
        if (!parentMap.has(childId)) {
          parentMap.set(childId, { clauseId: childId, label: "", role: "" });
        }
        return parentMap.get(childId);
      }

      for (const clause of clausePayload.clauses) {
        if (!clause || typeof clause !== "object") {
          continue;
        }

        const clauseId =
          typeof clause.clause_id === "string" && clause.clause_id.trim()
            ? clause.clause_id.trim()
            : "";
        if (!clauseId) {
          continue;
        }

        const functionText =
          typeof clause.function === "string" && clause.function.trim()
            ? clause.function.trim()
            : "";

        const references = Array.isArray(clause.references)
          ? clause.references
              .map((reference) =>
                typeof reference === "string" && reference.trim() ? reference.trim() : "",
              )
              .filter(Boolean)
          : [];

        const categoryTags = Array.isArray(clause.category_tags)
          ? clause.category_tags
              .map((tag) => (typeof tag === "string" && tag.trim() ? tag.trim() : ""))
              .filter(Boolean)
          : [];

        let sourceSummary = "";
        if (clause && typeof clause === "object" && clause.source && typeof clause.source === "object") {
          const parts = [];
          if (typeof clause.source.method === "string" && clause.source.method.trim()) {
            parts.push(clause.source.method.trim());
          }
          if (Array.isArray(clause.source.reviewed_by)) {
            const reviewers = clause.source.reviewed_by
              .map((entry) => (typeof entry === "string" && entry.trim() ? entry.trim() : ""))
              .filter(Boolean);
            if (reviewers.length > 0) {
              parts.push(`Reviewed by ${reviewers.join(", ")}`);
            }
          }
          if (parts.length > 0) {
            sourceSummary = parts.join(" · ");
          }
        }

        const analysis = clause.analysis && typeof clause.analysis === "object" ? clause.analysis : null;
        const parentClauseId =
          typeof clause.parent_clause_id === "string" && clause.parent_clause_id.trim()
            ? clause.parent_clause_id.trim()
            : "";
        if (parentClauseId) {
          const record = ensureChildRecord(parentClauseId, clauseId);
          if (!record.label && functionText) {
            record.label = functionText;
          }
        }

        if (analysis && Array.isArray(analysis.sub_clauses)) {
          for (const entry of analysis.sub_clauses) {
            if (!entry || typeof entry !== "object") {
              continue;
            }
            const childId =
              typeof entry.clause_id === "string" && entry.clause_id.trim() ? entry.clause_id.trim() : "";
            if (!childId) {
              continue;
            }
            const record = ensureChildRecord(clauseId, childId);
            if (typeof entry.label === "string" && entry.label.trim()) {
              record.label = entry.label.trim();
            }
            if (typeof entry.role === "string" && entry.role.trim()) {
              record.role = entry.role.trim();
            }
          }
        }

        details.set(clauseId, {
          clauseId,
          functionText,
          references,
          categoryTags,
          sourceSummary,
          parentClauseId,
          parentSummary: "",
          childClauses: [],
          isGroupOnly: !!(analysis && analysis.group_only === true),
        });
      }

      for (const detail of details.values()) {
        if (detail.parentClauseId) {
          const parentDetail = details.get(detail.parentClauseId);
          if (parentDetail && !detail.parentSummary) {
            detail.parentSummary = parentDetail.functionText || "";
          }
        }
      }

      for (const [parentId, childMap] of childrenAccumulator.entries()) {
        const parentDetail = details.get(parentId);
        if (!parentDetail) {
          continue;
        }

        const combined = [];
        for (const childRecord of childMap.values()) {
          const childDetail = details.get(childRecord.clauseId);
          if (childDetail) {
            if (!childDetail.parentClauseId) {
              childDetail.parentClauseId = parentId;
            }
            if (!childDetail.parentSummary) {
              childDetail.parentSummary = parentDetail.functionText || "";
            }
          }

          const resolvedLabel =
            childRecord.label || (childDetail && childDetail.functionText ? childDetail.functionText : "");

          combined.push({
            clauseId: childRecord.clauseId,
            label: resolvedLabel,
            role: childRecord.role || "",
          });
        }

        parentDetail.childClauses = combined;
      }

      return details;
    }

    function updateClauseState(clausePayload) {
      if (!clausePayload || typeof clausePayload !== "object") {
        clearClauseState();
        return;
      }

      viewerState.clausePayload = clausePayload;
      viewerState.clauseLookup = buildClauseLookup(clausePayload);
      viewerState.clauseDetails = buildClauseDetails(clausePayload);
      viewerState.clausesAvailable = viewerState.clauseLookup.size > 0;

      if (!viewerState.clausesAvailable) {
        viewerState.activeClauseId = "";
      } else if (
        viewerState.activeClauseId &&
        !viewerState.clauseDetails.has(viewerState.activeClauseId)
      ) {
        viewerState.activeClauseId = "";
      }

      syncClauseControlsVisibility();
      renderClauseDetails(viewerState.activeClauseId);
      updateClauseStatusMessage();
    }

    function getClauseRangesForReference(reference) {
      if (!viewerState.clauseOverlayEnabled) {
        return [];
      }

      if (typeof reference !== "string" || !reference.trim()) {
        return [];
      }

      const ranges = viewerState.clauseLookup.get(reference.trim()) || [];
      return ranges.map((range) => ({
        clauseId: range.clauseId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        categoryTags: Array.isArray(range.categoryTags) ? range.categoryTags.slice() : [],
        description: range.description || "",
      }));
    }

    function clampOffset(value, min, max) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return min;
      }
      if (value < min) {
        return min;
      }
      if (value > max) {
        return max;
      }
      return value;
    }

    function createHighlightedContent(text, ranges) {
      if (!doc) {
        return null;
      }

      if (!Array.isArray(ranges) || ranges.length === 0) {
        return doc.createTextNode(typeof text === "string" ? text : "");
      }

      const codepoints = Array.from(typeof text === "string" ? text : "");
      const textLength = codepoints.length;
      const fragment = doc.createDocumentFragment();
      let cursor = 0;

      const sortedRanges = ranges
        .map((range) => ({ ...range }))
        .sort((a, b) => {
          if (a.startOffset !== b.startOffset) {
            return a.startOffset - b.startOffset;
          }
          if (a.endOffset !== b.endOffset) {
            return a.endOffset - b.endOffset;
          }
          return a.clauseId.localeCompare(b.clauseId);
        });

      for (const range of sortedRanges) {
        const start = clampOffset(range.startOffset, 0, textLength);
        const end = clampOffset(range.endOffset, start, textLength);

        if (start > cursor) {
          fragment.appendChild(doc.createTextNode(codepoints.slice(cursor, start).join("")));
        }

        const span = doc.createElement("span");
        span.className = "clause-highlight";
        if (range.clauseId) {
          span.dataset.clauseId = range.clauseId;
          span.setAttribute("role", "button");
          span.setAttribute("tabindex", "0");
          span.setAttribute("aria-pressed", "false");
          if (range.description) {
            span.setAttribute("aria-label", range.description);
          } else {
            span.setAttribute("aria-label", `Clause ${range.clauseId}`);
          }
        }
        if (Array.isArray(range.categoryTags) && range.categoryTags.length > 0) {
          span.dataset.clauseTags = range.categoryTags.join(",");
        }
        if (range.description) {
          span.title = range.description;
        }
        span.textContent = codepoints.slice(start, end).join("");
        fragment.appendChild(span);
        cursor = end;
      }

      if (cursor < textLength) {
        fragment.appendChild(doc.createTextNode(codepoints.slice(cursor).join("")));
      }

      return fragment;
    }

    function renderVerses(verses, renderOptions = {}) {
      const options = renderOptions && typeof renderOptions === "object" ? renderOptions : {};
      const preserveActiveReference = options.preserveActiveReference === true;
      const previousActiveReference = preserveActiveReference ? viewerState.activeReference : "";

      viewerState.currentVerses = Array.isArray(verses)
        ? verses.map((verse) => ({ ...verse }))
        : [];
      viewerState.navigationIndex = buildNavigationIndex(verses);

      if (!preserveActiveReference) {
        viewerState.activeReference = "";
      }

      const hasContainer = !!containerEl && !!doc;
      const hasVerses = Array.isArray(verses) && verses.length > 0;

      if (!preserveActiveReference) {
        resetReferenceInputs();
      }
      setReferenceControlsEnabled(hasVerses && hasContainer);

      if (!hasVerses) {
        if (hasContainer) {
          containerEl.innerHTML = "";
          updateContainerState("empty");
        }
        viewerState.activeClauseId = "";
        setStatus(viewerState.messages.empty, true);
        applyActiveClauseStyling();
        renderClauseDetails("");
        updateClauseStatusMessage();
        return;
      }

      if (!hasContainer) {
        return;
      }

      containerEl.innerHTML = "";

      const fragment = doc.createDocumentFragment();
      for (const verse of viewerState.currentVerses) {
        if (!verse || typeof verse !== "object") {
          continue;
        }

        const verseEl = doc.createElement("article");
        verseEl.className = "verse";

        const reference = typeof verse.reference === "string" ? verse.reference : "";
        if (reference) {
          verseEl.dataset.reference = reference;
        }

        const referenceEl = doc.createElement("span");
        referenceEl.className = "verse-ref";
        referenceEl.textContent = reference;

        const textEl = doc.createElement("span");
        textEl.className = "verse-text";

        const ranges = getClauseRangesForReference(reference);
        if (ranges.length > 0) {
          verseEl.dataset.hasClauses = "true";
          const highlighted = createHighlightedContent(verse.text, ranges);
          if (highlighted) {
            textEl.textContent = "";
            textEl.appendChild(highlighted);
          } else {
            textEl.textContent = typeof verse.text === "string" ? verse.text : "";
          }
        } else {
          delete verseEl.dataset.hasClauses;
          textEl.textContent = typeof verse.text === "string" ? verse.text : "";
        }

        verseEl.append(referenceEl, textEl);
        fragment.appendChild(verseEl);
      }

      containerEl.appendChild(fragment);
      updateContainerState("ready");

      if (viewerState.activeClauseId && !viewerState.clauseDetails.has(viewerState.activeClauseId)) {
        viewerState.activeClauseId = "";
      }

      applyActiveClauseStyling();
      renderClauseDetails(viewerState.activeClauseId);
      updateClauseStatusMessage();

      if (preserveActiveReference && previousActiveReference) {
        highlightVerse(previousActiveReference);
      }
    }

    function getNavigationIndex() {
      return cloneNavigationIndex(viewerState.navigationIndex);
    }

    function getOrderedNavigationEntries() {
      if (
        !viewerState.navigationIndex ||
        !Array.isArray(viewerState.navigationIndex.orderedReferences) ||
        viewerState.navigationIndex.orderedReferences.length === 0
      ) {
        return [];
      }

      return viewerState.navigationIndex.orderedReferences.slice();
    }

    function goToNavigationEntry(entry) {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const reference = typeof entry.reference === "string" ? entry.reference.trim() : "";
      if (!reference) {
        return false;
      }

      const highlighted = highlightVerse(reference);
      if (!highlighted) {
        return false;
      }

      if (
        referenceChapterInput &&
        typeof entry.chapter === "number" &&
        Number.isInteger(entry.chapter) &&
        entry.chapter > 0
      ) {
        referenceChapterInput.value = String(entry.chapter);
      }

      if (
        referenceVerseInput &&
        typeof entry.verse === "number" &&
        Number.isInteger(entry.verse) &&
        entry.verse > 0
      ) {
        referenceVerseInput.value = String(entry.verse);
      }

      viewerState.activeReference = reference;
      setStatus("");
      return true;
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

      return goToNavigationEntry({
        reference: targetVerseEntry.reference,
        chapter: chapterEntry.chapter,
        verse: targetVerseEntry.verse,
        index: targetVerseEntry.index,
      });
    }

    function jumpToNextReference() {
      const orderedEntries = getOrderedNavigationEntries();
      if (orderedEntries.length === 0) {
        setStatus("No text is currently available for navigation.", true);
        return false;
      }

      const lookup =
        viewerState.activeReference && viewerState.navigationIndex.referenceLookup
          ? viewerState.navigationIndex.referenceLookup[viewerState.activeReference] || null
          : null;

      let targetEntry = null;
      if (!lookup || typeof lookup.index !== "number") {
        targetEntry = orderedEntries[0] || null;
      } else {
        targetEntry = orderedEntries[lookup.index + 1] || null;
        if (!targetEntry) {
          setStatus("You have reached the final verse of this text.", true);
          return false;
        }
      }

      return goToNavigationEntry(targetEntry);
    }

    function jumpToPreviousReference() {
      const orderedEntries = getOrderedNavigationEntries();
      if (orderedEntries.length === 0) {
        setStatus("No text is currently available for navigation.", true);
        return false;
      }

      const lookup =
        viewerState.activeReference && viewerState.navigationIndex.referenceLookup
          ? viewerState.navigationIndex.referenceLookup[viewerState.activeReference] || null
          : null;

      let targetEntry = null;
      if (!lookup || typeof lookup.index !== "number") {
        targetEntry = orderedEntries[orderedEntries.length - 1] || null;
      } else {
        if (lookup.index - 1 < 0) {
          setStatus("You are at the beginning of this text.", true);
          return false;
        }
        targetEntry = orderedEntries[lookup.index - 1] || null;
      }

      return goToNavigationEntry(targetEntry);
    }

    async function fetchClausePayload(clauseUrl) {
      if (typeof clauseUrl !== "string" || !clauseUrl.trim()) {
        return null;
      }

      if (!fetchFn) {
        return null;
      }

      try {
        const response = await fetchFn(clauseUrl.trim(), { cache: "no-cache" });
        if (!response || !response.ok) {
          const status = response ? response.status : "unknown";
          throw new Error(`Clause request failed with status ${status}`);
        }

        return await response.json();
      } catch (error) {
        safeConsole.error(error);
        return null;
      }
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

      const overrideClauseUrl =
        loadOptions && typeof loadOptions === "object" ? loadOptions.clauseDataUrl : undefined;
      const targetClauseUrl =
        typeof overrideClauseUrl === "string" && overrideClauseUrl.trim()
          ? overrideClauseUrl.trim()
          : viewerState.clauseDataUrl;

      viewerState.clauseDataUrl = targetClauseUrl || "";
      clearClauseState();

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

        if (viewerState.clauseDataUrl) {
          const clausePayload = await fetchClausePayload(viewerState.clauseDataUrl);
          if (clausePayload) {
            updateClauseState(clausePayload);
          }
        }

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
      viewerState.clauseDataUrl = book.clauseDataUrl || "";
      viewerState.activeBookId = book.bookId;
      viewerState.activeBookDisplayName = book.displayName;
      viewerState.activeReference = "";
      viewerState.navigationIndex = createEmptyNavigationIndex();
      clearClauseState();
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

      return loadBook({ dataUrl: book.dataUrl, clauseDataUrl: book.clauseDataUrl });
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

      setElementDisabledState(selectorEl, true);

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
        setElementDisabledState(selectorEl, false);

        await selectBook(matchingBook.bookId);
        return manifestData;
      } catch (error) {
        safeConsole.error(error);
        setElementDisabledState(selectorEl, true);
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

      if (referencePreviousButton) {
        referencePreviousButton.addEventListener("click", (event) => {
          if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
          }

          if (!viewerState.referenceControlsEnabled) {
            return;
          }

          const success = jumpToPreviousReference();
          if (!success && typeof referencePreviousButton.focus === "function") {
            referencePreviousButton.focus();
          }
        });
      }

      if (referenceNextButton) {
        referenceNextButton.addEventListener("click", (event) => {
          if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
          }

          if (!viewerState.referenceControlsEnabled) {
            return;
          }

          const success = jumpToNextReference();
          if (!success && typeof referenceNextButton.focus === "function") {
            referenceNextButton.focus();
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
      jumpToNextReference,
      jumpToPreviousReference,
      getNavigationIndex,
      setStatus,
      setClauseOverlayEnabled,
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
