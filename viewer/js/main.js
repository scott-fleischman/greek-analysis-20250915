(function () {
  const statusEl = document.getElementById("viewer-status");
  const containerEl = document.getElementById("text-container");
  const displayEl = document.getElementById("book-display");
  const headerEl = document.getElementById("book-header");

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
    }
  }

  function renderVerses(verses) {
    if (!Array.isArray(verses) || verses.length === 0) {
      setStatus("No verse data available.", true);
      return;
    }

    containerEl.innerHTML = "";

    const fragment = document.createDocumentFragment();
    for (const verse of verses) {
      const verseEl = document.createElement("article");
      verseEl.className = "verse";
      verseEl.dataset.reference = verse.reference;

      const referenceEl = document.createElement("span");
      referenceEl.className = "verse-ref";
      referenceEl.textContent = verse.reference;

      const textEl = document.createElement("span");
      textEl.className = "verse-text";
      textEl.textContent = verse.text;

      verseEl.append(referenceEl, textEl);
      fragment.appendChild(verseEl);
    }

    containerEl.appendChild(fragment);
  }

  async function loadBook() {
    try {
      setStatus("Loading the SBLGNT text…");
      const response = await fetch("data/mark.json", { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = await response.json();
      const { display_name: displayName, header, verses } = payload;

      displayEl.textContent = displayName || "Gospel of Mark";
      headerEl.textContent = header || "";
      document.title = `${displayEl.textContent} · SBLGNT Viewer`;

      renderVerses(verses);
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus("Unable to load the Gospel of Mark at this time.", true);
    }
  }

  if (containerEl && displayEl && headerEl) {
    window.addEventListener("DOMContentLoaded", loadBook);
  }
})();
