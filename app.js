const DB_NAME = "literature-doi-database";
const DB_VERSION = 1;
const STORE_NAME = "papers";
const LOCAL_STORAGE_KEY = "literature-doi-database-papers";

const schemaFields = [
  "id",
  "customTitle",
  "referenceNature",
  "tags",
  "nickname",
  "title",
  "journalInfo",
  "doi",
  "aimKo",
  "resultKo",
  "methodKo",
  "noteKo",
  "impactFactor",
  "summaryKo",
  "abstractKo",
  "createdAt",
  "updatedAt"
];

const stringFields = schemaFields.filter((field) => field !== "tags");
const searchFields = [
  "customTitle",
  "referenceNature",
  "nickname",
  "title",
  "journalInfo",
  "doi",
  "aimKo",
  "resultKo",
  "methodKo",
  "noteKo",
  "impactFactor",
  "summaryKo",
  "abstractKo"
];

const samplePaper = {
  id: "sample-paper",
  customTitle: "Transformer architecture paper",
  referenceNature: "Foundational machine learning paper",
  tags: ["transformer", "attention", "nlp"],
  nickname: "Attention",
  title: "Attention Is All You Need",
  journalInfo: "Advances in Neural Information Processing Systems, 2017",
  doi: "10.48550/arXiv.1706.03762",
  aimKo: "Sample aim note.",
  resultKo: "Sample result note.",
  methodKo: "Sample method note.",
  noteKo: "Hardcoded starter record. Edit and save it to persist your own notes.",
  impactFactor: "",
  summaryKo: "Sample summary note.",
  abstractKo: "Sample abstract note.",
  createdAt: new Date("2017-06-12T00:00:00.000Z").toISOString(),
  updatedAt: new Date("2017-06-12T00:00:00.000Z").toISOString()
};

let papers = [];
let selectedPaperId = "";
let currentPaper = null;
let repository = null;

const paperList = document.querySelector("#paper-list");
const paperCount = document.querySelector("#paper-count");
const emptyList = document.querySelector("#empty-list");
const searchInput = document.querySelector("#search-input");
const doiInput = document.querySelector("#doi-input");
const importFile = document.querySelector("#import-file");
const statusMessage = document.querySelector("#status-message");
const deleteButton = document.querySelector("#delete-paper");

const formFields = {
  id: document.querySelector("#paper-id"),
  customTitle: document.querySelector("#customTitle"),
  referenceNature: document.querySelector("#referenceNature"),
  tags: document.querySelector("#tags"),
  nickname: document.querySelector("#nickname"),
  title: document.querySelector("#paper-title"),
  journalInfo: document.querySelector("#journalInfo"),
  doi: document.querySelector("#paper-doi"),
  aimKo: document.querySelector("#aimKo"),
  resultKo: document.querySelector("#resultKo"),
  methodKo: document.querySelector("#methodKo"),
  noteKo: document.querySelector("#noteKo"),
  impactFactor: document.querySelector("#impactFactor"),
  summaryKo: document.querySelector("#summaryKo"),
  abstractKo: document.querySelector("#abstractKo"),
  createdAt: document.querySelector("#createdAt"),
  updatedAt: document.querySelector("#updatedAt")
};

function createRepository() {
  if (!window.indexedDB) {
    return Promise.resolve(createLocalStorageRepository());
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      resolve(createIndexedDbRepository(db));
    };

    request.onerror = () => {
      resolve(createLocalStorageRepository());
    };

    request.onblocked = () => {
      resolve(createLocalStorageRepository());
    };
  });
}

function createIndexedDbRepository(db) {
  function withStore(mode, callback) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const result = callback(store);

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  return {
    type: "IndexedDB",
    getAll() {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result.map(normalizePaper));
        request.onerror = () => reject(request.error);
      });
    },
    save(paper) {
      return withStore("readwrite", (store) => {
        store.put(normalizePaper(paper));
      });
    },
    saveMany(records) {
      return withStore("readwrite", (store) => {
        records.forEach((paper) => store.put(normalizePaper(paper)));
      });
    },
    delete(id) {
      return withStore("readwrite", (store) => {
        store.delete(id);
      });
    }
  };
}

function createLocalStorageRepository() {
  function read() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw).map(normalizePaper) : [];
    } catch {
      return [];
    }
  }

  function write(records) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records.map(normalizePaper)));
  }

  return {
    type: "localStorage",
    async getAll() {
      return read();
    },
    async save(paper) {
      const records = read();
      const index = records.findIndex((record) => record.id === paper.id);
      if (index >= 0) {
        records[index] = normalizePaper(paper);
      } else {
        records.push(normalizePaper(paper));
      }
      write(records);
    },
    async saveMany(importedRecords) {
      const records = read();
      importedRecords.forEach((paper) => {
        const normalized = normalizePaper(paper);
        const index = records.findIndex((record) => record.id === normalized.id);
        if (index >= 0) {
          records[index] = normalized;
        } else {
          records.push(normalized);
        }
      });
      write(records);
    },
    async delete(id) {
      write(read().filter((record) => record.id !== id));
    }
  };
}

function normalizePaper(paper) {
  const normalized = {};
  const now = new Date().toISOString();

  stringFields.forEach((field) => {
    normalized[field] = typeof paper[field] === "string" ? paper[field] : "";
  });

  normalized.id = normalized.id || generateId();
  normalized.tags = Array.isArray(paper.tags)
    ? paper.tags.map(String).map((tag) => tag.trim()).filter(Boolean)
    : parseTags(paper.tags || "");
  normalized.createdAt = normalized.createdAt || now;
  normalized.updatedAt = normalized.updatedAt || now;

  return normalized;
}

function blankPaper() {
  const now = new Date().toISOString();
  return normalizePaper({
    id: generateId(),
    tags: [],
    createdAt: now,
    updatedAt: now
  });
}

function generateId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `paper-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getDisplayTitle(paper) {
  return paper.customTitle.trim() || paper.title.trim() || paper.doi.trim() || "Untitled paper";
}

function getFormPaper() {
  const now = new Date().toISOString();
  const existing = currentPaper || blankPaper();

  return normalizePaper({
    ...existing,
    id: formFields.id.value.trim() || existing.id || generateId(),
    customTitle: formFields.customTitle.value.trim(),
    referenceNature: formFields.referenceNature.value.trim(),
    tags: parseTags(formFields.tags.value),
    nickname: formFields.nickname.value.trim(),
    title: formFields.title.value.trim(),
    journalInfo: formFields.journalInfo.value.trim(),
    doi: formFields.doi.value.trim(),
    aimKo: formFields.aimKo.value.trim(),
    resultKo: formFields.resultKo.value.trim(),
    methodKo: formFields.methodKo.value.trim(),
    noteKo: formFields.noteKo.value.trim(),
    impactFactor: formFields.impactFactor.value.trim(),
    summaryKo: formFields.summaryKo.value.trim(),
    abstractKo: formFields.abstractKo.value.trim(),
    createdAt: formFields.createdAt.value.trim() || existing.createdAt || now,
    updatedAt: formFields.updatedAt.value.trim() || now
  });
}

function loadPaperIntoForm(paper) {
  currentPaper = normalizePaper(paper);
  selectedPaperId = currentPaper.id;
  formFields.id.value = currentPaper.id;
  formFields.customTitle.value = currentPaper.customTitle;
  formFields.referenceNature.value = currentPaper.referenceNature;
  formFields.tags.value = currentPaper.tags.join(", ");
  formFields.nickname.value = currentPaper.nickname;
  formFields.title.value = currentPaper.title;
  formFields.journalInfo.value = currentPaper.journalInfo;
  formFields.doi.value = currentPaper.doi;
  formFields.aimKo.value = currentPaper.aimKo;
  formFields.resultKo.value = currentPaper.resultKo;
  formFields.methodKo.value = currentPaper.methodKo;
  formFields.noteKo.value = currentPaper.noteKo;
  formFields.impactFactor.value = currentPaper.impactFactor;
  formFields.summaryKo.value = currentPaper.summaryKo;
  formFields.abstractKo.value = currentPaper.abstractKo;
  formFields.createdAt.value = currentPaper.createdAt;
  formFields.updatedAt.value = currentPaper.updatedAt;
  deleteButton.disabled = !papers.some((record) => record.id === selectedPaperId);
}

function renderPaperList() {
  const visiblePapers = getFilteredPapers();
  paperList.innerHTML = "";
  paperCount.textContent = `${visiblePapers.length} ${visiblePapers.length === 1 ? "paper" : "papers"}`;
  emptyList.hidden = visiblePapers.length > 0;

  visiblePapers.forEach((paper) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const title = document.createElement("span");
    const meta = document.createElement("span");

    button.type = "button";
    button.className = paper.id === selectedPaperId ? "selected" : "";
    button.dataset.paperId = paper.id;
    title.className = "paper-title";
    title.textContent = getDisplayTitle(paper);
    meta.className = "paper-meta";
    meta.textContent = [paper.nickname, paper.doi].filter(Boolean).join(" - ");

    button.appendChild(title);
    button.appendChild(meta);

    if (paper.tags.length > 0) {
      const tags = document.createElement("span");
      tags.className = "paper-tags";
      paper.tags.slice(0, 4).forEach((tag) => {
        const tagPill = document.createElement("span");
        tagPill.textContent = tag;
        tags.appendChild(tagPill);
      });
      button.appendChild(tags);
    }

    item.appendChild(button);
    paperList.appendChild(item);
  });
}

function getFilteredPapers() {
  const query = searchInput.value.trim().toLowerCase();
  const sorted = [...papers].sort((a, b) => getDisplayTitle(a).localeCompare(getDisplayTitle(b)));

  if (!query) {
    return sorted;
  }

  return sorted.filter((paper) => {
    const searchable = [
      ...searchFields.map((field) => paper[field]),
      paper.tags.join(" ")
    ].join(" ").toLowerCase();

    return searchable.includes(query);
  });
}

function setStatus(message) {
  statusMessage.textContent = message;
}

async function refreshFromStorage() {
  papers = await repository.getAll();

  if (papers.length === 0) {
    await repository.save(samplePaper);
    papers = await repository.getAll();
  }

  const selected = papers.find((paper) => paper.id === selectedPaperId) || papers[0] || blankPaper();
  loadPaperIntoForm(selected);
  renderPaperList();
}

function validateImportedRecords(value) {
  const records = Array.isArray(value) ? value : value && Array.isArray(value.papers) ? value.papers : null;

  if (!records) {
    throw new Error("Imported JSON must be an array of paper records or an object with a papers array.");
  }

  records.forEach((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`Record ${index + 1} is not an object.`);
    }

    schemaFields.forEach((field) => {
      if (!(field in record)) {
        throw new Error(`Record ${index + 1} is missing "${field}".`);
      }
    });

    stringFields.forEach((field) => {
      if (typeof record[field] !== "string") {
        throw new Error(`Record ${index + 1} field "${field}" must be a string.`);
      }
    });

    if (!Array.isArray(record.tags) || record.tags.some((tag) => typeof tag !== "string")) {
      throw new Error(`Record ${index + 1} field "tags" must be an array of strings.`);
    }

    if (!record.id.trim()) {
      throw new Error(`Record ${index + 1} must have a non-empty id.`);
    }
  });

  return records.map(normalizePaper);
}

async function saveCurrentPaper() {
  const previousId = currentPaper ? currentPaper.id : "";
  const paper = getFormPaper();
  const duplicate = papers.find((record) => record.id === paper.id && record.id !== previousId);

  if (duplicate) {
    setStatus(`Save failed: another paper already uses id "${paper.id}".`);
    return;
  }

  if (previousId && previousId !== paper.id && papers.some((record) => record.id === previousId)) {
    await repository.delete(previousId);
  }
  await repository.save(paper);
  currentPaper = paper;
  selectedPaperId = paper.id;
  await refreshFromStorage();
  setStatus("Paper saved.");
}

async function deleteCurrentPaper() {
  if (!currentPaper || !papers.some((paper) => paper.id === currentPaper.id)) {
    setStatus("No saved paper is selected.");
    return;
  }

  const title = getDisplayTitle(currentPaper);
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) {
    return;
  }

  await repository.delete(currentPaper.id);
  selectedPaperId = "";
  await refreshFromStorage();
  setStatus("Paper deleted.");
}

function exportJson() {
  const data = JSON.stringify(papers.map(normalizePaper), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `literature-doi-database-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("Exported JSON file.");
}

function importJsonFile(file) {
  const reader = new FileReader();

  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result);
      const importedRecords = validateImportedRecords(parsed);
      await repository.saveMany(importedRecords);
      selectedPaperId = importedRecords[0] ? importedRecords[0].id : selectedPaperId;
      await refreshFromStorage();
      setStatus(`Imported ${importedRecords.length} ${importedRecords.length === 1 ? "record" : "records"}.`);
    } catch (error) {
      setStatus(`Import failed: ${error.message}`);
    } finally {
      importFile.value = "";
    }
  };

  reader.onerror = () => {
    setStatus("Import failed: could not read the selected file.");
    importFile.value = "";
  };

  reader.readAsText(file);
}

paperList.addEventListener("click", (event) => {
  const selectedButton = event.target.closest("button[data-paper-id]");
  if (!selectedButton) {
    return;
  }

  const selectedPaper = papers.find((paper) => paper.id === selectedButton.dataset.paperId);
  if (selectedPaper) {
    loadPaperIntoForm(selectedPaper);
    renderPaperList();
    setStatus("");
  }
});

searchInput.addEventListener("input", renderPaperList);

document.querySelector("#new-paper").addEventListener("click", () => {
  const draft = blankPaper();
  selectedPaperId = draft.id;
  loadPaperIntoForm(draft);
  renderPaperList();
  setStatus("New blank paper ready. Save to add it to the list.");
});

document.querySelector("#import-doi").addEventListener("click", () => {
  const doi = doiInput.value.trim();
  if (doi) {
    formFields.doi.value = doi;
  }
  setStatus("DOI API import is not implemented yet. The DOI field was copied into the editor.");
});

document.querySelector("#save-paper").addEventListener("click", () => {
  saveCurrentPaper().catch((error) => setStatus(`Save failed: ${error.message}`));
});

document.querySelector("#delete-paper").addEventListener("click", () => {
  deleteCurrentPaper().catch((error) => setStatus(`Delete failed: ${error.message}`));
});

document.querySelector("#export-json").addEventListener("click", exportJson);

document.querySelector("#import-json").addEventListener("click", () => {
  importFile.click();
});

importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (file) {
    importJsonFile(file);
  }
});

createRepository()
  .then(async (storage) => {
    repository = storage;
    await refreshFromStorage();
    setStatus(`Storage ready: ${repository.type}.`);
  })
  .catch((error) => {
    setStatus(`Storage failed: ${error.message}`);
  });
