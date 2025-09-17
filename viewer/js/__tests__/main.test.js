const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { createViewer, bootstrap } = require("../main.js");

class MockElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = "";
    this._textContent = "";
    this._innerHTML = "";
    this.eventListeners = new Map();
    this.value = "";
    this.disabled = false;
  }

  append(...nodes) {
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  appendChild(node) {
    if (!node) {
      return node;
    }

    if (node.isFragment) {
      for (const child of node.children) {
        this.children.push(child);
      }
    } else {
      this.children.push(node);
    }
    return node;
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = value;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = value;
    if (value === "") {
      this.children = [];
    }
  }

  querySelectorAll(selector) {
    const [tagPart, classPart] = selector.split(".");
    const expectedTag = tagPart ? tagPart.toUpperCase() : null;
    const expectedClass = classPart || null;
    const matches = [];

    function visit(node) {
      for (const child of node.children) {
        const tagMatches = !expectedTag || child.tagName === expectedTag;
        const classMatches = !expectedClass || child.className === expectedClass;
        if (tagMatches && classMatches) {
          matches.push(child);
        }
        visit(child);
      }
    }

    visit(this);
    return matches;
  }

  addEventListener(type, handler) {
    if (!type || typeof handler !== "function") {
      return;
    }
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    const listeners = this.eventListeners.get(type);
    if (!listeners) {
      return;
    }
    listeners.delete(handler);
  }

  dispatchEvent(event) {
    if (!event || typeof event.type !== "string") {
      return true;
    }

    const listeners = this.eventListeners.get(event.type);
    if (!listeners || listeners.size === 0) {
      return true;
    }

    const eventObject = {
      ...event,
      type: event.type,
      target: this,
      currentTarget: this,
      defaultPrevented: false,
    };

    eventObject.preventDefault = () => {
      eventObject.defaultPrevented = true;
    };

    for (const handler of listeners) {
      handler.call(this, eventObject);
    }

    return !eventObject.defaultPrevented;
  }
}

class MockDocumentFragment {
  constructor() {
    this.children = [];
    this.isFragment = true;
  }

  appendChild(node) {
    this.children.push(node);
    return node;
  }
}

class MockDocument {
  constructor() {
    this.elements = new Map();
    this.listeners = new Map();
    this.readyState = "complete";
    this.title = "";
  }

  register(id, element) {
    this.elements.set(id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  createElement(tagName) {
    return new MockElement(tagName);
  }

  createDocumentFragment() {
    return new MockDocumentFragment();
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      return;
    }
    this.listeners.get(type).delete(handler);
  }

  dispatchEvent(event) {
    const handlers = this.listeners.get(event.type);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      handler.call(this, event);
    }
  }
}

function buildDocument({ includeSelector = true } = {}) {
  const doc = new MockDocument();
  const statusEl = doc.register("viewer-status", new MockElement("div"));
  const containerEl = doc.register("text-container", new MockElement("section"));
  const displayEl = doc.register("book-display", new MockElement("h1"));
  const headerEl = doc.register("book-header", new MockElement("p"));
  let selectorEl = null;
  if (includeSelector) {
    selectorEl = doc.register("book-selector", new MockElement("select"));
    selectorEl.disabled = true;
  }
  return { doc, statusEl, containerEl, displayEl, headerEl, selectorEl };
}

async function flushAsyncOperations() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("setStatus updates the message panel", () => {
  const { doc, statusEl } = buildDocument();
  const viewer = createViewer({ document: doc });

  viewer.setStatus("Loaded");
  assert.equal(statusEl.textContent, "Loaded");
  assert.equal(statusEl.style.display, "block");
  assert.equal(statusEl.style.borderLeftColor, "");

  viewer.setStatus("Problem", true);
  assert.equal(statusEl.style.borderLeftColor, "#a23b3b");

  viewer.setStatus("");
  assert.equal(statusEl.textContent, "");
  assert.equal(statusEl.style.display, "none");
  assert.equal(statusEl.style.borderLeftColor, "");
});

test("setStatus safely no-ops when the status element is absent", () => {
  const doc = new MockDocument();
  doc.register("text-container", new MockElement("section"));
  doc.register("book-display", new MockElement("h1"));
  doc.register("book-header", new MockElement("p"));

  const viewer = createViewer({ document: doc });

  assert.doesNotThrow(() => viewer.setStatus("Ready"));
});

test("renderVerses populates the container", () => {
  const { doc, containerEl } = buildDocument();
  const viewer = createViewer({ document: doc });

  viewer.renderVerses([
    { reference: "Mk 1:1", text: "Ἀρχὴ τοῦ εὐαγγελίου" },
    { reference: "Mk 1:2", text: "καθὼς γέγραπται" },
  ]);

  assert.equal(containerEl.children.length, 2);
  const [firstVerse] = containerEl.children;
  assert.equal(firstVerse.className, "verse");
  assert.equal(firstVerse.children[0].className, "verse-ref");
  assert.equal(firstVerse.children[0].textContent, "Mk 1:1");
  assert.equal(firstVerse.children[1].className, "verse-text");
  assert.equal(firstVerse.children[1].textContent, "Ἀρχὴ τοῦ εὐαγγελίου");
});

test("renderVerses exits early when the container is missing", () => {
  const doc = new MockDocument();
  const statusEl = doc.register("viewer-status", new MockElement("div"));
  const viewer = createViewer({ document: doc });

  viewer.renderVerses([{ reference: "Mk 1:1", text: "Ἀρχὴ" }]);

  assert.equal(statusEl.textContent, "");
  assert.equal(statusEl.style.display, undefined);
});

test("renderVerses shows an error when the data is empty", () => {
  const { doc, statusEl, containerEl } = buildDocument();
  const viewer = createViewer({ document: doc });

  containerEl.children.push(new MockElement("article"));
  viewer.renderVerses([]);

  assert.equal(statusEl.textContent, "No verse data available.");
  assert.equal(statusEl.style.borderLeftColor, "#a23b3b");
  assert.equal(containerEl.children.length, 0);
});

test("loadBook fetches the data and updates the document", async () => {
  const { doc, statusEl, displayEl, headerEl, containerEl } = buildDocument();
  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        display_name: "Gospel of Mark",
        header: "A fast-paced narrative",
        verses: [
          { reference: "Mk 1:1", text: "Ἀρχὴ τοῦ εὐαγγελίου" },
        ],
      };
    },
  }));

  const viewer = createViewer({ document: doc, fetch: fetchMock });

  const payload = await viewer.loadBook();

  assert.equal(fetchMock.mock.calls.length, 1);
  assert.deepEqual(fetchMock.mock.calls[0].arguments, ["data/mark.json", { cache: "no-cache" }]);
  assert.equal(payload.display_name, "Gospel of Mark");
  assert.equal(displayEl.textContent, "Gospel of Mark");
  assert.equal(headerEl.textContent, "A fast-paced narrative");
  assert.equal(doc.title, "Gospel of Mark · SBLGNT Viewer");
  assert.equal(statusEl.textContent, "");
  assert.equal(statusEl.style.display, "none");
  assert.equal(containerEl.children.length, 1);
});

test("loadBook reports failures and leaves an error message", async () => {
  const { doc, statusEl } = buildDocument();
  const consoleMock = { error: mock.fn() };
  const fetchMock = mock.fn(async () => ({ ok: false, status: 503, async json() {} }));

  const viewer = createViewer({ document: doc, fetch: fetchMock, console: consoleMock });

  const result = await viewer.loadBook();

  assert.equal(result, null);
  assert.equal(statusEl.textContent, "Unable to load the Gospel of Mark at this time.");
  assert.equal(statusEl.style.display, "block");
  assert.equal(statusEl.style.borderLeftColor, "#a23b3b");
  assert.equal(consoleMock.error.mock.calls.length, 1);
});

test("loadBook tolerates console objects without an error method", async () => {
  const { doc, statusEl } = buildDocument();
  const fetchMock = mock.fn(async () => ({ ok: false, status: 500, async json() {} }));

  const viewer = createViewer({ document: doc, fetch: fetchMock, console: {} });

  const result = await viewer.loadBook();

  assert.equal(result, null);
  assert.equal(statusEl.style.display, "block");
  assert.equal(statusEl.textContent, "Unable to load the Gospel of Mark at this time.");
});

test("loadBook returns null when display elements are not available", async () => {
  const doc = new MockDocument();
  doc.register("viewer-status", new MockElement("div"));
  doc.register("text-container", new MockElement("section"));
  const fetchMock = mock.fn(async () => ({ ok: true, status: 200, async json() { return {}; } }));

  const viewer = createViewer({ document: doc, fetch: fetchMock });

  const result = await viewer.loadBook();

  assert.equal(result, null);
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("loadBook handles a missing fetch implementation", async () => {
  const { doc, statusEl } = buildDocument();
  const consoleMock = { error: mock.fn() };

  const viewer = createViewer({ document: doc, fetch: null, console: consoleMock });

  const result = await viewer.loadBook();

  assert.equal(result, null);
  assert.equal(statusEl.textContent, "Unable to load the Gospel of Mark at this time.");
  assert.equal(consoleMock.error.mock.calls.length, 1);
});

test("init returns false when required elements are missing", () => {
  const doc = new MockDocument();
  const viewer = createViewer({ document: doc });

  assert.equal(viewer.init(), false);
});

test("init waits for DOMContentLoaded when the document is loading", async () => {
  const { doc, selectorEl } = buildDocument();
  doc.readyState = "loading";
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              {
                book_id: "mark",
                display_name: "Gospel of Mark",
                data_url: "data/mark.json",
              },
            ],
          };
        },
      };
    }

    if (url === "data/mark.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Mark",
            header: "",
            verses: [{ reference: "Mk 1:1", text: "Ἀρχὴ" }],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const viewer = createViewer({ document: doc, fetch: fetchMock });

  assert.equal(viewer.init(), true);
  assert.equal(fetchMock.mock.calls.length, 0);

  doc.dispatchEvent({ type: "DOMContentLoaded" });
  await flushAsyncOperations();
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(fetchMock.mock.calls[0].arguments[0], "data/manifest.json");
  assert.equal(fetchMock.mock.calls[1].arguments[0], "data/mark.json");
  assert.equal(selectorEl.disabled, false);
  assert.equal(selectorEl.value, "mark");
});

test("init triggers a load immediately when the document is ready", async () => {
  const { doc, selectorEl } = buildDocument();
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              {
                book_id: "mark",
                display_name: "Gospel of Mark",
                data_url: "data/mark.json",
              },
            ],
          };
        },
      };
    }

    if (url === "data/mark.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Mark",
            header: "",
            verses: [],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const viewer = createViewer({ document: doc, fetch: fetchMock });

  assert.equal(viewer.init(), true);
  await flushAsyncOperations();
  await flushAsyncOperations();
  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(fetchMock.mock.calls[0].arguments[0], "data/manifest.json");
  assert.equal(fetchMock.mock.calls[1].arguments[0], "data/mark.json");
  assert.equal(selectorEl.disabled, false);
});

test("changing the selector triggers a new book load", async () => {
  const { doc, selectorEl, displayEl } = buildDocument();
  doc.readyState = "complete";
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              {
                book_id: "mark",
                display_name: "Gospel of Mark",
                data_url: "data/mark.json",
              },
              {
                book_id: "matthew",
                display_name: "Gospel of Matthew",
                data_url: "data/matthew.json",
              },
            ],
          };
        },
      };
    }

    if (url === "data/mark.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Gospel of Mark",
            header: "",
            verses: [{ reference: "Mk 1:1", text: "Ἀρχὴ" }],
          };
        },
      };
    }

    if (url === "data/matthew.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Gospel of Matthew",
            header: "",
            verses: [{ reference: "Mt 1:1", text: "Βίβλος" }],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const viewer = createViewer({ document: doc, fetch: fetchMock });

  viewer.init();
  await flushAsyncOperations();
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(selectorEl.children.length, 2);
  assert.equal(selectorEl.value, "mark");
  assert.equal(displayEl.textContent, "Gospel of Mark");

  selectorEl.value = "matthew";
  selectorEl.dispatchEvent({ type: "change" });
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 3);
  assert.equal(fetchMock.mock.calls[2].arguments[0], "data/matthew.json");
  assert.equal(selectorEl.value, "matthew");
  assert.equal(displayEl.textContent, "Gospel of Matthew");
});

test("viewer skips manifest loading when the selector is absent", async () => {
  const { doc } = buildDocument({ includeSelector: false });
  doc.readyState = "complete";
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/mark.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Mark",
            header: "",
            verses: [],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const viewer = createViewer({ document: doc, fetch: fetchMock });

  viewer.init();
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 1);
  assert.equal(fetchMock.mock.calls[0].arguments[0], "data/mark.json");
});

test("init falls back to book loading when the manifest request fails", async () => {
  const { doc, selectorEl, statusEl } = buildDocument();
  doc.readyState = "complete";
  const consoleMock = { error: mock.fn() };
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/manifest.json") {
      return {
        ok: false,
        status: 503,
        async json() {
          return {};
        },
      };
    }

    if (url === "data/mark.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Mark",
            header: "",
            verses: [],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const viewer = createViewer({ document: doc, fetch: fetchMock, console: consoleMock });

  viewer.init();
  await flushAsyncOperations();
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(fetchMock.mock.calls[0].arguments[0], "data/manifest.json");
  assert.equal(fetchMock.mock.calls[1].arguments[0], "data/mark.json");
  assert.equal(selectorEl.disabled, true);
  assert.equal(consoleMock.error.mock.calls.length, 1);
  assert.equal(statusEl.textContent, "");
});

test("loadManifest filters invalid entries and normalizes keys", async () => {
  const { doc, selectorEl, displayEl } = buildDocument();
  doc.readyState = "complete";
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              null,
              { book_id: "   ", data_url: "data/ignored.json" },
              { book_id: "luke", data_url: "data/luke.json" },
              {
                bookId: "acts",
                dataUrl: "data/acts.json",
                displayName: "Acts of the Apostles",
              },
              { book_id: "invalid", data_url: "   " },
            ],
          };
        },
      };
    }

    if (url === "data/luke.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Luke",
            header: "",
            verses: [],
          };
        },
      };
    }

    if (url === "data/acts.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Acts of the Apostles",
            header: "",
            verses: [],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const viewer = createViewer({ document: doc, fetch: fetchMock });

  viewer.init();
  await flushAsyncOperations();
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(selectorEl.children.length, 2);
  assert.equal(selectorEl.children[0].textContent, "luke");
  assert.equal(selectorEl.children[1].textContent, "Acts of the Apostles");
  assert.equal(selectorEl.value, "luke");
  assert.equal(displayEl.textContent, "Luke");

  selectorEl.value = "acts";
  selectorEl.dispatchEvent({ type: "change" });
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 3);
  assert.equal(fetchMock.mock.calls[2].arguments[0], "data/acts.json");
  assert.equal(displayEl.textContent, "Acts of the Apostles");
});

test("loadManifest returns null when the selector element is absent", async () => {
  const { doc } = buildDocument({ includeSelector: false });
  const fetchMock = mock.fn();
  const viewer = createViewer({ document: doc, fetch: fetchMock });

  const result = await viewer.loadManifest();

  assert.equal(result, null);
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("loadManifest reports missing fetch implementations", async () => {
  const { doc, selectorEl } = buildDocument();
  const consoleMock = { error: mock.fn() };

  const viewer = createViewer({ document: doc, fetch: null, console: consoleMock });

  const result = await viewer.loadManifest();

  assert.equal(result, null);
  assert.equal(selectorEl.disabled, true);
  assert.equal(consoleMock.error.mock.calls.length, 1);
});

test("loadManifest handles payloads without book listings", async () => {
  const { doc, selectorEl } = buildDocument();
  const consoleMock = { error: mock.fn() };
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return { version: 1 };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const viewer = createViewer({ document: doc, fetch: fetchMock, console: consoleMock });

  const result = await viewer.loadManifest();

  assert.equal(result, null);
  assert.equal(fetchMock.mock.calls.length, 1);
  assert.equal(selectorEl.disabled, true);
  assert.equal(consoleMock.error.mock.calls.length, 1);
});

test("loadManifest rejects manifests without usable entries", async () => {
  const { doc, selectorEl } = buildDocument();
  const consoleMock = { error: mock.fn() };
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              { book_id: "   ", data_url: "" },
              { bookId: "", dataUrl: "data/unused.json" },
            ],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const viewer = createViewer({ document: doc, fetch: fetchMock, console: consoleMock });

  const result = await viewer.loadManifest();

  assert.equal(result, null);
  assert.equal(fetchMock.mock.calls.length, 1);
  assert.equal(selectorEl.disabled, true);
  assert.equal(consoleMock.error.mock.calls.length, 1);
});

test("selectBook ignores unknown ids and supports skipLoad", async () => {
  const { doc, selectorEl } = buildDocument();
  doc.readyState = "complete";
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              {
                book_id: "mark",
                display_name: "Gospel of Mark",
                data_url: "data/mark.json",
              },
            ],
          };
        },
      };
    }

    if (url === "data/mark.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Gospel of Mark",
            header: "",
            verses: [],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const viewer = createViewer({ document: doc, fetch: fetchMock });

  viewer.init();
  await flushAsyncOperations();
  await flushAsyncOperations();

  const baselineCalls = fetchMock.mock.calls.length;

  const missingResult = await viewer.selectBook("unknown");
  assert.equal(missingResult, null);
  assert.equal(fetchMock.mock.calls.length, baselineCalls);

  const skipResult = await viewer.selectBook(selectorEl.value, { skipLoad: true });
  assert.equal(skipResult, null);
  assert.equal(fetchMock.mock.calls.length, baselineCalls);

  selectorEl.value = "unlisted";
  selectorEl.dispatchEvent({ type: "change" });
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, baselineCalls);

  selectorEl.value = "mark";
  selectorEl.dispatchEvent({ type: "change" });
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, baselineCalls + 1);
});

test("browser build initializes itself in a window context", async () => {
  const filePath = path.join(__dirname, "../main.js");
  const source = fs.readFileSync(filePath, "utf8");
  const { doc, selectorEl } = buildDocument();
  doc.readyState = "loading";

  const fetchMock = mock.fn(async (url) => {
    if (url === "data/manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              {
                book_id: "mark",
                display_name: "Gospel of Mark",
                data_url: "data/mark.json",
              },
            ],
          };
        },
      };
    }

    if (url === "data/mark.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Mark",
            header: "",
            verses: [{ reference: "Mk 1:1", text: "Ἀρχὴ" }],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const consoleMock = { error: mock.fn() };

  const windowObject = {
    document: doc,
  };

  const context = {
    window: windowObject,
    document: doc,
    fetch: fetchMock,
    console: consoleMock,
  };
  context.globalThis = context;
  windowObject.fetch = fetchMock;
  windowObject.console = consoleMock;
  windowObject.globalThis = context;

  vm.createContext(context);
  vm.runInContext(source, context, { filename: "main.js" });

  assert.ok(windowObject.SBLGNTViewer);
  assert.equal(typeof windowObject.SBLGNTViewer.init, "function");
  doc.dispatchEvent({ type: "DOMContentLoaded" });
  await flushAsyncOperations();

  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(fetchMock.mock.calls[0].arguments[0], "data/manifest.json");
  assert.equal(fetchMock.mock.calls[1].arguments[0], "data/mark.json");
  assert.equal(selectorEl.disabled, false);
});

test("bootstrap attaches the viewer to the provided global object", async () => {
  const { doc, selectorEl } = buildDocument();
  doc.readyState = "loading";
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              {
                book_id: "mark",
                display_name: "Gospel of Mark",
                data_url: "data/mark.json",
              },
            ],
          };
        },
      };
    }

    if (url === "data/mark.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Mark",
            header: "",
            verses: [{ reference: "Mk 1:1", text: "Ἀρχὴ" }],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const globalObject = { document: doc, fetch: fetchMock, console: { error() {} } };

  const viewerInstance = bootstrap(globalObject);

  assert.ok(viewerInstance);
  assert.equal(globalObject.SBLGNTViewer, viewerInstance);

  doc.dispatchEvent({ type: "DOMContentLoaded" });
  await flushAsyncOperations();

  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(fetchMock.mock.calls[0].arguments[0], "data/manifest.json");
  assert.equal(fetchMock.mock.calls[1].arguments[0], "data/mark.json");
  assert.equal(selectorEl.disabled, false);
});


test("configure updates the data url and status messages", async () => {
  const { doc, statusEl } = buildDocument();
  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        display_name: "Custom",
        header: "Header",
        verses: [
          { reference: "Mk 1:1", text: "Ἀρχὴ" },
        ],
      };
    },
  }));

  const viewer = createViewer({ document: doc, fetch: fetchMock });

  const initialConfig = viewer.configure();
  assert.equal(initialConfig.dataUrl, "data/mark.json");
  assert.equal(initialConfig.manifestUrl, "data/manifest.json");
  assert.equal(initialConfig.statusMessages.empty, "No verse data available.");

  const updatedConfig = viewer.configure({
    dataUrl: "data/custom.json",
    manifestUrl: "data/alt-manifest.json",
    statusMessages: {
      empty: "Nothing to display.",
      loading: "Loading custom data…",
    },
  });

  assert.equal(updatedConfig.dataUrl, "data/custom.json");
  assert.equal(updatedConfig.manifestUrl, "data/alt-manifest.json");
  assert.equal(updatedConfig.statusMessages.empty, "Nothing to display.");
  assert.equal(updatedConfig.statusMessages.loading, "Loading custom data…");

  viewer.renderVerses([]);
  assert.equal(statusEl.textContent, "Nothing to display.");

  const payload = await viewer.loadBook();
  assert.ok(payload);
  assert.equal(fetchMock.mock.calls.length, 1);
  assert.deepEqual(fetchMock.mock.calls[0].arguments, ["data/custom.json", { cache: "no-cache" }]);
});

test("configure ignores invalid updates", () => {
  const { doc } = buildDocument();
  const viewer = createViewer({ document: doc });

  const configAfterInvalid = viewer.configure({
    dataUrl: "   ",
    statusMessages: { empty: 42, loading: null },
  });

  assert.equal(configAfterInvalid.dataUrl, "data/mark.json");
  assert.equal(configAfterInvalid.manifestUrl, "data/manifest.json");
  assert.equal(configAfterInvalid.statusMessages.empty, "No verse data available.");
  assert.equal(configAfterInvalid.statusMessages.loading, "Loading the SBLGNT text…");

  const snapshot = viewer.configure("not-an-object");
  assert.equal(snapshot.dataUrl, "data/mark.json");
  assert.equal(snapshot.manifestUrl, "data/manifest.json");
  assert.equal(snapshot.statusMessages.loading, "Loading the SBLGNT text…");
});

test("bootstrap reads viewer config from the global object", async () => {
  const { doc, statusEl } = buildDocument();
  doc.readyState = "complete";
  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        display_name: "Acts",
        header: "",
        verses: [],
      };
    },
  }));

  const globalObject = {
    document: doc,
    fetch: fetchMock,
    console: { error() {} },
    SBLGNTViewerConfig: {
      dataUrl: "data/acts.json",
      manifestUrl: "data/custom-manifest.json",
      statusMessages: {
        loading: "Loading Acts…",
        empty: "Acts data unavailable.",
      },
      globalPropertyName: "ConfiguredViewer",
      autoInit: false,
    },
  };

  const viewerInstance = bootstrap(globalObject);

  assert.ok(viewerInstance);
  assert.equal(globalObject.ConfiguredViewer, viewerInstance);
  assert.equal(fetchMock.mock.calls.length, 0);

  const snapshot = viewerInstance.configure();
  assert.equal(snapshot.dataUrl, "data/acts.json");
  assert.equal(snapshot.manifestUrl, "data/custom-manifest.json");
  assert.equal(snapshot.statusMessages.loading, "Loading Acts…");

  const loadPromise = viewerInstance.loadBook();
  assert.equal(statusEl.textContent, "Loading Acts…");
  await loadPromise;

  assert.equal(fetchMock.mock.calls.length, 1);
  assert.equal(fetchMock.mock.calls[0].arguments[0], "data/acts.json");
});

test("bootstrap accepts a configuration object as the first argument", async () => {
  const { doc, selectorEl } = buildDocument();
  doc.readyState = "loading";
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/custom-manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              {
                book_id: "john",
                display_name: "Gospel of John",
                data_url: "data/john.json",
              },
              {
                book_id: "mark",
                display_name: "Gospel of Mark",
                data_url: "data/mark.json",
              },
            ],
          };
        },
      };
    }

    if (url === "data/john.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "John",
            header: "",
            verses: [],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const globalObject = { document: doc, fetch: fetchMock, console: { error() {} } };

  const viewerInstance = bootstrap({
    globalTarget: globalObject,
    dataUrl: "data/john.json",
    manifestUrl: "data/custom-manifest.json",
    autoInit: false,
    globalPropertyName: "MyViewer",
  });

  assert.equal(globalObject.MyViewer, viewerInstance);
  assert.equal(fetchMock.mock.calls.length, 0);

  const config = viewerInstance.configure();
  assert.equal(config.dataUrl, "data/john.json");
  assert.equal(config.manifestUrl, "data/custom-manifest.json");

  viewerInstance.init();
  doc.dispatchEvent({ type: "DOMContentLoaded" });
  await flushAsyncOperations();
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(fetchMock.mock.calls[0].arguments[0], "data/custom-manifest.json");
  assert.equal(fetchMock.mock.calls[1].arguments[0], "data/john.json");
  assert.equal(selectorEl.disabled, false);
  assert.equal(selectorEl.value, "john");
});

test("bootstrap merges optional configuration arguments", async () => {
  const { doc, selectorEl } = buildDocument();
  doc.readyState = "loading";
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/custom-manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              {
                book_id: "mark",
                display_name: "Gospel of Mark",
                data_url: "data/mark.json",
              },
            ],
          };
        },
      };
    }

    if (url === "data/mark.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Gospel of Mark",
            header: "",
            verses: [],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const globalObject = { document: doc, fetch: fetchMock, console: { error() {} } };

  const viewerInstance = bootstrap(globalObject, {
    manifestUrl: "data/custom-manifest.json",
    autoInit: false,
  });

  assert.equal(globalObject.SBLGNTViewer, viewerInstance);
  assert.equal(fetchMock.mock.calls.length, 0);

  viewerInstance.init();
  doc.dispatchEvent({ type: "DOMContentLoaded" });
  await flushAsyncOperations();
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(fetchMock.mock.calls[0].arguments[0], "data/custom-manifest.json");
  assert.equal(fetchMock.mock.calls[1].arguments[0], "data/mark.json");
  assert.equal(selectorEl.disabled, false);
});

test("bootstrap allows overriding the global target via optional arguments", async () => {
  const { doc, selectorEl } = buildDocument();
  doc.readyState = "loading";
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/custom-manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              {
                book_id: "mark",
                display_name: "Gospel of Mark",
                data_url: "data/mark.json",
              },
            ],
          };
        },
      };
    }

    if (url === "data/mark.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Gospel of Mark",
            header: "",
            verses: [],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const primaryGlobal = { document: doc, fetch: fetchMock, console: { error() {} } };
  const secondaryGlobal = { document: doc, fetch: fetchMock, console: { error() {} } };

  const viewerInstance = bootstrap(primaryGlobal, {
    globalTarget: secondaryGlobal,
    manifestUrl: "data/custom-manifest.json",
    autoInit: false,
  });

  assert.equal(primaryGlobal.SBLGNTViewer, undefined);
  assert.equal(secondaryGlobal.SBLGNTViewer, viewerInstance);

  viewerInstance.init();
  doc.dispatchEvent({ type: "DOMContentLoaded" });
  await flushAsyncOperations();
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(fetchMock.mock.calls[0].arguments[0], "data/custom-manifest.json");
  assert.equal(fetchMock.mock.calls[1].arguments[0], "data/mark.json");
  assert.equal(selectorEl.disabled, false);
});

test("bootstrap falls back to the global window object", async () => {
  const { doc, selectorEl } = buildDocument();
  doc.readyState = "loading";
  const fetchMock = mock.fn(async (url) => {
    if (url === "data/manifest.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            books: [
              {
                book_id: "mark",
                display_name: "Gospel of Mark",
                data_url: "data/mark.json",
              },
            ],
          };
        },
      };
    }

    if (url === "data/mark.json") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            display_name: "Gospel of Mark",
            header: "",
            verses: [],
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const originalWindow = globalThis.window;
  const windowObject = { document: doc, fetch: fetchMock, console: { error() {} } };
  globalThis.window = windowObject;

  try {
    const viewerInstance = bootstrap({ autoInit: false });

    assert.equal(windowObject.SBLGNTViewer, viewerInstance);

    viewerInstance.init();
    doc.dispatchEvent({ type: "DOMContentLoaded" });
    await flushAsyncOperations();
    await flushAsyncOperations();

    assert.equal(fetchMock.mock.calls.length, 2);
    assert.equal(fetchMock.mock.calls[0].arguments[0], "data/manifest.json");
    assert.equal(fetchMock.mock.calls[1].arguments[0], "data/mark.json");
    assert.equal(selectorEl.disabled, false);
  } finally {
    globalThis.window = originalWindow;
  }
});
