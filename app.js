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
const statusMessage = document.querySelector("#status-message");
const deleteButton = document.querySelector("#delete-paper");
const importDoiButton = document.querySelector("#import-doi");

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

function normalizeDoiInput(value) {
  return value
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .replace(/[?#].*$/, "");
}

function isValidDoi(value) {
  return /^10\.\d{4,9}\/\S+$/i.test(value);
}

function cleanText(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstText(value) {
  if (Array.isArray(value)) {
    return cleanText(value[0] || "");
  }

  return cleanText(value || "");
}

function getPublishedYear(dateParts) {
  return Array.isArray(dateParts) && Array.isArray(dateParts[0]) && dateParts[0][0]
    ? String(dateParts[0][0])
    : "";
}

function formatPersonName(author) {
  const given = cleanText(author.given || author.firstName || "");
  const family = cleanText(author.family || author.lastName || author.displayName || author.name || "");
  return [given, family].filter(Boolean).join(" ") || family || given;
}

function formatShortAuthorName(author) {
  const explicitName = cleanText(author.family || author.lastName || author.name);

  if (explicitName) {
    return explicitName;
  }

  const displayName = cleanText(author.displayName || formatPersonName(author));
  const parts = displayName.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : displayName;
}

function formatNickname(authors, year) {
  const names = authors.map(formatShortAuthorName).filter(Boolean);

  if (names.length === 0 || !year) {
    return "";
  }

  if (names.length === 1) {
    return `${names[0]} (${year})`;
  }

  if (names.length === 2) {
    return `${names[0]} & ${names[1]} (${year})`;
  }

  return `${names[0]} et al. (${year})`;
}

function formatNatureAuthors(authors) {
  const names = authors.map(formatShortAuthorName).filter(Boolean);

  if (names.length <= 2) {
    return names.join(" & ");
  }

  return `${names[0]} et al.`;
}

function formatReferenceNature(metadata) {
  const parts = [];
  const authorText = formatNatureAuthors(metadata.authors);
  const journal = metadata.shortJournal || metadata.journal;
  const volume = metadata.volume;
  const pages = metadata.pages;
  const year = metadata.year;

  if (authorText) {
    parts.push(`${authorText}.`);
  }

  if (metadata.title) {
    parts.push(`${metadata.title}.`);
  }

  if (journal) {
    let journalPart = journal;
    if (volume) {
      journalPart += ` ${volume}`;
    }
    if (pages) {
      journalPart += `, ${pages}`;
    }
    if (year) {
      journalPart += ` (${year})`;
    }
    parts.push(`${journalPart}.`);
  } else if (year) {
    parts.push(`(${year}).`);
  }

  return parts.join(" ");
}

function formatJournalInfo(metadata) {
  const journal = metadata.journal;
  const volumeIssue = metadata.volume
    ? `${metadata.volume}${metadata.issue ? `(${metadata.issue})` : ""}`
    : "";

  return [journal, volumeIssue, metadata.pages, metadata.year].filter(Boolean).join(", ");
}

function abstractFromInvertedIndex(index) {
  if (!index || typeof index !== "object") {
    return "";
  }

  const words = [];
  Object.entries(index).forEach(([word, positions]) => {
    if (Array.isArray(positions)) {
      positions.forEach((position) => {
        words[position] = word;
      });
    }
  });

  return cleanText(words.filter(Boolean).join(" "));
}

function mapCrossrefMessage(message, doi) {
  const authors = Array.isArray(message.author)
    ? message.author.map((author) => ({
        given: author.given,
        family: author.family
      }))
    : [];
  const year =
    getPublishedYear(message.published && message.published["date-parts"]) ||
    getPublishedYear(message["published-print"] && message["published-print"]["date-parts"]) ||
    getPublishedYear(message["published-online"] && message["published-online"]["date-parts"]) ||
    getPublishedYear(message.issued && message.issued["date-parts"]);

  return {
    source: "Crossref",
    doi: cleanText(message.DOI || doi),
    title: firstText(message.title),
    authors,
    year,
    journal: firstText(message["container-title"]),
    shortJournal: firstText(message["short-container-title"]),
    volume: cleanText(message.volume),
    issue: cleanText(message.issue),
    pages: cleanText(message.page),
    abstract: cleanText(message.abstract)
  };
}

function mapOpenAlexWork(work, doi) {
  const authors = Array.isArray(work.authorships)
    ? work.authorships.map((authorship) => ({
        displayName: authorship.author && authorship.author.display_name
      }))
    : [];
  const primaryLocation = work.primary_location || {};
  const source = primaryLocation.source || {};
  const biblio = work.biblio || {};

  return {
    source: "OpenAlex",
    doi: cleanText(work.doi ? work.doi.replace(/^https?:\/\/doi\.org\//i, "") : doi),
    title: cleanText(work.title || work.display_name),
    authors,
    year: work.publication_year ? String(work.publication_year) : "",
    journal: cleanText(source.display_name),
    shortJournal: cleanText(source.abbreviated_title),
    volume: cleanText(biblio.volume),
    issue: cleanText(biblio.issue),
    pages: cleanText(biblio.first_page && biblio.last_page ? `${biblio.first_page}-${biblio.last_page}` : biblio.first_page),
    abstract: abstractFromInvertedIndex(work.abstract_inverted_index)
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchDoiMetadata(doi) {
  try {
    const crossrefData = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (crossrefData && crossrefData.message) {
      return mapCrossrefMessage(crossrefData.message, doi);
    }
  } catch (error) {
    console.warn("Crossref DOI lookup failed.", error);
  }

  try {
    const openAlexId = encodeURIComponent(`https://doi.org/${doi}`);
    const openAlexData = await fetchJson(`https://api.openalex.org/works/${openAlexId}`);
    if (openAlexData && (openAlexData.id || openAlexData.doi)) {
      return mapOpenAlexWork(openAlexData, doi);
    }
  } catch (error) {
    console.warn("OpenAlex DOI lookup failed.", error);
  }

  throw new Error("DOI metadata could not be fetched from Crossref or OpenAlex.");
}

function applyMetadataToForm(metadata) {
  const existing = getFormPaper();
  const nickname = formatNickname(metadata.authors, metadata.year);
  const customTitle = nickname ? `${nickname} — key topic` : "";
  const abstract = metadata.abstract || "Abstract not available from metadata source.";

  currentPaper = normalizePaper({
    ...existing,
    doi: metadata.doi || "",
    title: metadata.title || "",
    nickname,
    referenceNature: formatReferenceNature(metadata),
    journalInfo: formatJournalInfo(metadata),
    customTitle,
    abstractKo: abstract,
    summaryKo: "Summary placeholder. Add Korean summary manually.",
    aimKo: "Aim placeholder. Add Korean aim manually.",
    resultKo: "Result placeholder. Add Korean result manually.",
    methodKo: "Method placeholder. Add Korean method manually.",
    updatedAt: new Date().toISOString()
  });
  selectedPaperId = currentPaper.id;
  loadPaperIntoForm(currentPaper);
  renderPaperList();
}

async function importDoiMetadata() {
  const normalizedDoi = normalizeDoiInput(doiInput.value || formFields.doi.value);

  if (!normalizedDoi || !isValidDoi(normalizedDoi)) {
    setStatus("Invalid DOI. Enter a DOI like 10.xxxx/example, with or without a doi.org prefix.");
    return;
  }

  importDoiButton.disabled = true;
  setStatus("Fetching DOI metadata from Crossref...");

  try {
    doiInput.value = normalizedDoi;
    const metadata = await fetchDoiMetadata(normalizedDoi);

    if (!metadata.title && !metadata.doi) {
      setStatus("Missing metadata: the DOI lookup succeeded, but no usable title or DOI was returned.");
      return;
    }

    applyMetadataToForm(metadata);
    setStatus(`Imported DOI metadata from ${metadata.source}. Review the editable fields, then Save.`);
  } catch (error) {
    setStatus(`Failed fetch: ${error.message}`);
  } finally {
    importDoiButton.disabled = false;
  }
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
  importDoiMetadata();
});

document.querySelector("#save-paper").addEventListener("click", () => {
  saveCurrentPaper().catch((error) => setStatus(`Save failed: ${error.message}`));
});

document.querySelector("#delete-paper").addEventListener("click", () => {
  deleteCurrentPaper().catch((error) => setStatus(`Delete failed: ${error.message}`));
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
