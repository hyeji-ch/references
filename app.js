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
  "abstractOriginal",
  "aimKo",
  "resultKo",
  "methodKo",
  "noteKo",
  "impactFactor",
  "summaryKo",
  "abstractKo",
  "rawMarkdown",
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
  "abstractOriginal",
  "aimKo",
  "resultKo",
  "methodKo",
  "noteKo",
  "impactFactor",
  "summaryKo",
  "abstractKo",
  "rawMarkdown"
];

const chatgptJsonFields = [
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
  abstractOriginal: "",
  aimKo: "Generate this section with ChatGPT and paste/import the result.",
  resultKo: "Generate this section with ChatGPT and paste/import the result.",
  methodKo: "Generate this section with ChatGPT and paste/import the result.",
  noteKo: "Hardcoded starter record. Edit and save it to persist your own notes.",
  impactFactor: "",
  summaryKo: "Generate this section with ChatGPT and paste/import the result.",
  abstractKo: "Generate this section with ChatGPT and paste/import the result.",
  rawMarkdown: "",
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
const importDoiButton = document.querySelector("#import-doi");
const chatgptJsonInput = document.querySelector("#chatgpt-json");
const markdownModal = document.querySelector("#markdown-modal");
const markdownInput = document.querySelector("#chatgpt-markdown");
const markdownPreview = document.querySelector("#markdown-preview");

const formFields = {
  id: document.querySelector("#paper-id"),
  customTitle: document.querySelector("#customTitle"),
  referenceNature: document.querySelector("#referenceNature"),
  tags: document.querySelector("#tags"),
  nickname: document.querySelector("#nickname"),
  title: document.querySelector("#paper-title"),
  journalInfo: document.querySelector("#journalInfo"),
  doi: document.querySelector("#paper-doi"),
  abstractOriginal: document.querySelector("#abstractOriginal"),
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

function setModalOpen(isOpen) {
  markdownModal.hidden = !isOpen;
  if (isOpen) {
    markdownInput.focus();
  }
}

function removeMarkdownReferenceNoise(value) {
  return value
    .replace(/^[ \t]*\[\d+\]:\s+\S+.*$/gm, "")
    .replace(/\[([^\]]+)\]\[\d+\]/g, "$1")
    .replace(/\[\d+\]/g, "")
    .trim();
}

function stripMarkdownHeadingText(value) {
  return value
    .replace(/^\s*(?:[-*+]\s*)?(?:#{1,6}\s*)?(?:\*\*)?/, "")
    .replace(/(?:\*\*)?\s*$/, "")
    .trim();
}

function parseChatGptMarkdown(markdown) {
  const cleaned = removeMarkdownReferenceNoise(markdown || "");
  const sections = {};
  let currentNumber = null;

  cleaned.split(/\r?\n/).forEach((line) => {
    const headingMatch = line.match(/^\s*(?:[-*+]\s*)?(?:#{1,6}\s*)?(?:\*\*)?(0|[1-9]|1[0-2])\.\s+(.+?)(?:\*\*)?\s*$/);

    if (headingMatch) {
      currentNumber = headingMatch[1];
      sections[currentNumber] = [];
      return;
    }

    if (currentNumber !== null) {
      sections[currentNumber].push(line);
    }
  });

  const result = {};
  Object.entries(sections).forEach(([number, lines]) => {
    result[number] = removeMarkdownReferenceNoise(lines.join("\n")).trim();
  });

  return result;
}

function cleanSectionValue(value) {
  return removeMarkdownReferenceNoise(value || "")
    .trim();
}

function extractTagsFromSection(value, allowTextFallback) {
  const hashtagMatches = value.match(/#[A-Za-z0-9_\-\u3131-\u318e\uac00-\ud7a3]+/g);

  if (hashtagMatches && hashtagMatches.length > 0) {
    return [...new Set(hashtagMatches)];
  }

  const cleaned = cleanSectionValue(value);
  if (!cleaned) {
    return [];
  }

  return allowTextFallback && confirm("No hashtags were found in section 1. Store the cleaned section text as one tag?")
    ? [cleaned]
    : [];
}

function extractDoiFromText(value) {
  const normalized = normalizeDoiInput(value || "");
  return isValidDoi(normalized) ? normalized : "";
}

function shortKeyTopicFromTitle(title) {
  const cleaned = cleanText(title)
    .replace(/[.:;!?].*$/, "")
    .replace(/\b(a|an|the|of|for|with|using|in|on|by|and|or|to|from)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  return words.slice(0, 5).join(" ") || cleanText(title).split(/\s+/).slice(0, 5).join(" ");
}

function buildCustomTitleFromMarkdownRecord(record) {
  const topic = shortKeyTopicFromTitle(record.title);
  if (record.nickname && topic) {
    return `${record.nickname} — ${topic}`;
  }
  return record.nickname || topic || "";
}

function sectionsToPaperFields(sections, rawMarkdown, options = {}) {
  const record = {
    referenceNature: cleanSectionValue(sections["0"] || ""),
    tags: extractTagsFromSection(sections["1"] || "", Boolean(options.confirmTagFallback)),
    nickname: cleanSectionValue(sections["2"] || ""),
    title: cleanSectionValue(sections["3"] || ""),
    journalInfo: cleanSectionValue(sections["4"] || ""),
    doi: extractDoiFromText(sections["5"] || ""),
    aimKo: cleanSectionValue(sections["6"] || ""),
    resultKo: cleanSectionValue(sections["7"] || ""),
    methodKo: cleanSectionValue(sections["8"] || ""),
    noteKo: cleanSectionValue(sections["9"] || ""),
    impactFactor: cleanSectionValue(sections["10"] || ""),
    summaryKo: cleanSectionValue(sections["11"] || ""),
    abstractKo: cleanSectionValue(sections["12"] || ""),
    rawMarkdown: rawMarkdown || ""
  };

  record.customTitle = buildCustomTitleFromMarkdownRecord(record);
  return record;
}

function renderMarkdownPreview(record, foundCount) {
  markdownPreview.innerHTML = "";

  const warning = document.createElement("p");
  warning.className = "status-message";
  const messages = [];

  if (foundCount < 8) {
    messages.push("This markdown does not look like a complete 12-section literature summary.");
  }
  if (!record.title || !record.doi) {
    messages.push("Warning: title or DOI is missing. Import is still allowed.");
  }
  warning.textContent = messages.join(" ");
  markdownPreview.appendChild(warning);

  [
    ["referenceNature", record.referenceNature],
    ["tags", record.tags.join(", ")],
    ["nickname", record.nickname],
    ["title", record.title],
    ["journalInfo", record.journalInfo],
    ["doi", record.doi],
    ["aimKo", record.aimKo],
    ["resultKo", record.resultKo],
    ["methodKo", record.methodKo],
    ["noteKo", record.noteKo],
    ["impactFactor", record.impactFactor],
    ["summaryKo", record.summaryKo],
    ["abstractKo", record.abstractKo]
  ].forEach(([label, value]) => {
    const row = document.createElement("div");
    const key = document.createElement("div");
    const body = document.createElement("div");
    row.className = "preview-row";
    key.className = "preview-label";
    body.className = "preview-value";
    key.textContent = label;
    body.textContent = value || "(empty)";
    row.appendChild(key);
    row.appendChild(body);
    markdownPreview.appendChild(row);
  });
}

function parseMarkdownForImport(options = {}) {
  try {
    const sections = parseChatGptMarkdown(markdownInput.value);
    const foundCount = Object.keys(sections).length;
    const record = sectionsToPaperFields(sections, markdownInput.value, options);
    renderMarkdownPreview(record, foundCount);

    if (foundCount < 8) {
      setStatus("This markdown does not look like a complete 12-section literature summary.");
    } else if (!record.title || !record.doi) {
      setStatus("Warning: title or DOI is missing. Import is still allowed.");
    } else {
      setStatus("Markdown parsed. Review the preview before importing.");
    }

    return { record, foundCount };
  } catch (error) {
    console.error("Markdown parser error.", error);
    setStatus("Markdown parser error. Check the pasted content.");
    return null;
  }
}

function markdownOverwriteFields() {
  return [
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
    "rawMarkdown"
  ];
}

function hasMarkdownOverwriteConflicts(existing, incoming) {
  return markdownOverwriteFields().some((field) => {
    const currentValue = field === "tags" ? existing.tags.join(", ") : existing[field];
    const incomingValue = field === "tags" ? incoming.tags.join(", ") : incoming[field];
    return currentValue && incomingValue && currentValue !== incomingValue;
  });
}

async function importMarkdownToCurrentRecord() {
  const parsed = parseMarkdownForImport({ confirmTagFallback: true });
  if (!parsed) {
    return;
  }

  const incoming = parsed.record;
  const isSavedCurrent = currentPaper && papers.some((paper) => paper.id === currentPaper.id);
  const duplicate = incoming.doi
    ? papers.find((paper) => paper.doi.toLowerCase() === incoming.doi.toLowerCase() && (!currentPaper || paper.id !== currentPaper.id))
    : null;

  if (duplicate) {
    const shouldOpen = confirm("A saved record with this DOI already exists. Open the existing record instead of creating a duplicate?");
    if (shouldOpen) {
      loadPaperIntoForm(duplicate);
      renderPaperList();
      setModalOpen(false);
      setStatus("Existing DOI record opened.");
      return;
    }
  }

  const existing = isSavedCurrent ? getFormPaper() : blankPaper();

  if (isSavedCurrent && hasMarkdownOverwriteConflicts(existing, incoming)) {
    const shouldOverwrite = confirm("This markdown will overwrite non-empty fields in the current record. Continue?");
    if (!shouldOverwrite) {
      return;
    }
  }

  const now = new Date().toISOString();
  const importedPaper = normalizePaper({
    ...existing,
    ...incoming,
    id: existing.id || generateId(),
    customTitle: incoming.customTitle || existing.customTitle,
    createdAt: existing.createdAt || now,
    updatedAt: now
  });

  await repository.save(importedPaper);
  selectedPaperId = importedPaper.id;
  currentPaper = importedPaper;
  await refreshFromStorage();
  setModalOpen(false);

  const warnings = [];
  if (parsed.foundCount < 8) {
    warnings.push("This markdown does not look like a complete 12-section literature summary.");
  }
  if (!incoming.title || !incoming.doi) {
    warnings.push("Warning: title or DOI is missing.");
  }
  setStatus(warnings.length ? `Record saved. ${warnings.join(" ")}` : "Record saved.");
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
    abstractOriginal: formFields.abstractOriginal.value.trim(),
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
  formFields.abstractOriginal.value = currentPaper.abstractOriginal;
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
  const cleaned = value
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/[.,;)\]]+$/, "");
  const doiMatch = cleaned.match(/10\.\d{4,9}\/\S+/i);

  return doiMatch ? doiMatch[0].replace(/[.,;)\]]+$/, "") : cleaned;
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
  const errors = [];
  const crossrefUrls = [
    `https://api.crossref.org/works/${doi}`,
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`
  ];

  for (const url of crossrefUrls) {
    try {
      const crossrefData = await fetchJson(url);
      if (crossrefData && crossrefData.message) {
        return mapCrossrefMessage(crossrefData.message, doi);
      }
    } catch (error) {
      errors.push(error.message);
    }
  }

  throw new Error(errors.join(" | ") || "DOI metadata not found.");
}

function applyMetadataToForm(metadata) {
  const existing = getFormPaper();
  const nickname = formatNickname(metadata.authors, metadata.year);
  const customTitle = nickname ? `${nickname} — key topic` : "";
  const abstract = metadata.abstract || "Abstract not available from metadata source.";
  const placeholder = "Generate this section with ChatGPT and paste/import the result.";

  currentPaper = normalizePaper({
    ...existing,
    doi: metadata.doi || "",
    title: metadata.title || "",
    nickname,
    referenceNature: formatReferenceNature(metadata),
    journalInfo: formatJournalInfo(metadata),
    customTitle: nickname ? `${nickname} - key topic` : "",
    abstractOriginal: metadata.abstract || "",
    abstractKo: existing.abstractKo || placeholder,
    summaryKo: existing.summaryKo || placeholder,
    aimKo: existing.aimKo || placeholder,
    resultKo: existing.resultKo || placeholder,
    methodKo: existing.methodKo || placeholder,
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
  setStatus("Fetching DOI metadata...");

  try {
    doiInput.value = normalizedDoi;
    const metadata = await fetchDoiMetadata(normalizedDoi);

    if (!metadata.title && !metadata.doi) {
      setStatus("DOI metadata not found.");
      return;
    }

    applyMetadataToForm(metadata);
    setStatus("Metadata imported.");
  } catch (error) {
    console.error("Failed DOI metadata fetch.", error);
    setStatus(`DOI metadata not found. ${error.message}`);
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
  setStatus("Record saved.");
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

function buildChatGptPrompt() {
  const paper = getFormPaper();
  const context = {
    doi: paper.doi,
    title: paper.title,
    journalInfo: paper.journalInfo,
    abstractOriginal: paper.abstractOriginal
  };

  return [
    "You are helping create a personal literature database record.",
    "Generate valid JSON only. Do not include Markdown fences or commentary.",
    "Use Korean for fields ending in Ko.",
    "Do not invent bibliographic metadata if it is missing; keep missing values as empty strings.",
    "Return exactly these fields:",
    "0. referenceNature",
    "1. tags",
    "2. nickname",
    "3. title",
    "4. journalInfo",
    "5. doi",
    "6. aimKo",
    "7. resultKo",
    "8. methodKo",
    "9. noteKo",
    "10. impactFactor",
    "11. summaryKo",
    "12. abstractKo",
    "",
    "JSON shape:",
    JSON.stringify({
      referenceNature: "",
      tags: [],
      nickname: "",
      title: "",
      journalInfo: "",
      doi: "",
      aimKo: "",
      resultKo: "",
      methodKo: "",
      noteKo: "",
      impactFactor: "",
      summaryKo: "",
      abstractKo: ""
    }, null, 2),
    "",
    "Source metadata:",
    JSON.stringify(context, null, 2)
  ].join("\n");
}

async function copyChatGptPrompt() {
  const prompt = buildChatGptPrompt();

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(prompt);
    } else {
      const temporary = document.createElement("textarea");
      temporary.value = prompt;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.left = "-9999px";
      document.body.appendChild(temporary);
      temporary.select();
      document.execCommand("copy");
      temporary.remove();
    }
    setStatus("ChatGPT prompt copied.");
  } catch (error) {
    console.error("Failed to copy ChatGPT prompt.", error);
    setStatus("Could not copy prompt. Select and copy manually from the generated text.");
  }
}

function normalizeChatGptJsonRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object.");
  }

  const normalized = {};
  chatgptJsonFields.forEach((field) => {
    if (field === "tags") {
      if (Array.isArray(value.tags)) {
        normalized.tags = value.tags.map(String).map((tag) => tag.trim()).filter(Boolean);
      } else if (typeof value.tags === "string") {
        normalized.tags = parseTags(value.tags);
      } else {
        normalized.tags = [];
      }
      return;
    }

    normalized[field] = typeof value[field] === "string" ? value[field].trim() : "";
  });

  return normalized;
}

function hasOverwriteConflicts(existing, incoming) {
  return chatgptJsonFields.some((field) => {
    const currentValue = field === "tags" ? existing.tags.join(", ") : existing[field];
    const incomingValue = field === "tags" ? incoming.tags.join(", ") : incoming[field];
    return currentValue && incomingValue && currentValue !== incomingValue;
  });
}

function applyChatGptJsonToCurrentPaper() {
  let parsed;

  try {
    parsed = JSON.parse(chatgptJsonInput.value.trim());
  } catch (error) {
    console.error("Failed to parse ChatGPT JSON.", error);
    setStatus("Invalid JSON.");
    return;
  }

  try {
    const incoming = normalizeChatGptJsonRecord(parsed);
    const existing = getFormPaper();

    if (hasOverwriteConflicts(existing, incoming) && !confirm("This JSON will overwrite existing edited fields. Apply it anyway?")) {
      return;
    }

    currentPaper = normalizePaper({
      ...existing,
      ...incoming,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    });
    selectedPaperId = currentPaper.id;
    loadPaperIntoForm(currentPaper);
    renderPaperList();
    setStatus("ChatGPT JSON imported. Review, then Save.");
  } catch (error) {
    console.error("Invalid ChatGPT JSON shape.", error);
    setStatus("Invalid JSON.");
  }
}

function validateExportedRecords(value) {
  const records = Array.isArray(value) ? value : value && Array.isArray(value.papers) ? value.papers : null;

  if (!records) {
    throw new Error("Expected an array of paper records or an object with a papers array.");
  }

  return records.map((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`Record ${index + 1} is not an object.`);
    }

    if (record.tags && !Array.isArray(record.tags) && typeof record.tags !== "string") {
      throw new Error(`Record ${index + 1} has invalid tags.`);
    }

    return normalizePaper(record);
  });
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
      const importedRecords = validateExportedRecords(parsed);
      await repository.saveMany(importedRecords);
      selectedPaperId = importedRecords[0] ? importedRecords[0].id : selectedPaperId;
      await refreshFromStorage();
      setStatus(`Imported ${importedRecords.length} ${importedRecords.length === 1 ? "record" : "records"}.`);
    } catch (error) {
      console.error("Failed to import JSON file.", error);
      setStatus("Invalid JSON.");
    } finally {
      importFile.value = "";
    }
  };

  reader.onerror = () => {
    console.error("Failed to read JSON import file.", reader.error);
    setStatus("Invalid JSON.");
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
  importDoiMetadata();
});

document.querySelector("#save-paper").addEventListener("click", () => {
  saveCurrentPaper().catch((error) => setStatus(`Save failed: ${error.message}`));
});

document.querySelector("#delete-paper").addEventListener("click", () => {
  deleteCurrentPaper().catch((error) => setStatus(`Delete failed: ${error.message}`));
});

document.querySelector("#copy-chatgpt-prompt").addEventListener("click", () => {
  copyChatGptPrompt();
});

document.querySelector("#paste-chatgpt-markdown").addEventListener("click", () => {
  markdownPreview.innerHTML = "";
  setModalOpen(true);
});

document.querySelector("#parse-markdown-preview").addEventListener("click", () => {
  parseMarkdownForImport();
});

document.querySelector("#import-markdown-current").addEventListener("click", () => {
  importMarkdownToCurrentRecord().catch((error) => {
    console.error("Markdown import failed.", error);
    setStatus("Markdown import failed.");
  });
});

document.querySelector("#cancel-markdown-import").addEventListener("click", () => {
  setModalOpen(false);
});

markdownModal.addEventListener("click", (event) => {
  if (event.target === markdownModal) {
    setModalOpen(false);
  }
});

document.querySelector("#apply-chatgpt-json").addEventListener("click", () => {
  applyChatGptJsonToCurrentPaper();
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
