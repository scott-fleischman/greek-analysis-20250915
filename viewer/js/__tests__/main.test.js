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

function buildDocument() {
  const doc = new MockDocument();
  const statusEl = doc.register("viewer-status", new MockElement("div"));
  const containerEl = doc.register("text-container", new MockElement("section"));
  const displayEl = doc.register("book-display", new MockElement("h1"));
  const headerEl = doc.register("book-header", new MockElement("p"));
  return { doc, statusEl, containerEl, displayEl, headerEl };
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
  const { doc } = buildDocument();
  doc.readyState = "loading";
  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        display_name: "Mark",
        header: "",
        verses: [{ reference: "Mk 1:1", text: "Ἀρχὴ" }],
      };
    },
  }));

  const viewer = createViewer({ document: doc, fetch: fetchMock });

  assert.equal(viewer.init(), true);
  assert.equal(fetchMock.mock.calls.length, 0);

  doc.dispatchEvent({ type: "DOMContentLoaded" });
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 1);
});

test("init triggers a load immediately when the document is ready", async () => {
  const { doc } = buildDocument();
  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        display_name: "Mark",
        header: "",
        verses: [],
      };
    },
  }));

  const viewer = createViewer({ document: doc, fetch: fetchMock });

  assert.equal(viewer.init(), true);
  await flushAsyncOperations();
  assert.equal(fetchMock.mock.calls.length, 1);
});

test("browser build initializes itself in a window context", async () => {
  const filePath = path.join(__dirname, "../main.js");
  const source = fs.readFileSync(filePath, "utf8");
  const { doc } = buildDocument();
  doc.readyState = "loading";

  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        display_name: "Mark",
        header: "",
        verses: [{ reference: "Mk 1:1", text: "Ἀρχὴ" }],
      };
    },
  }));

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

  assert.equal(fetchMock.mock.calls.length, 1);
});

test("bootstrap attaches the viewer to the provided global object", async () => {
  const { doc } = buildDocument();
  doc.readyState = "loading";
  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        display_name: "Mark",
        header: "",
        verses: [{ reference: "Mk 1:1", text: "Ἀρχὴ" }],
      };
    },
  }));

  const globalObject = { document: doc, fetch: fetchMock, console: { error() {} } };

  const viewerInstance = bootstrap(globalObject);

  assert.ok(viewerInstance);
  assert.equal(globalObject.SBLGNTViewer, viewerInstance);

  doc.dispatchEvent({ type: "DOMContentLoaded" });
  await flushAsyncOperations();

  assert.equal(fetchMock.mock.calls.length, 1);
});
