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
const topPaperCount = document.querySelector("#top-paper-count");
const emptyList = document.querySelector("#empty-list");
const searchInput = document.querySelector("#search-input");
const statusMessage = document.querySelector("#status-message");
const deleteButton = document.querySelector("#delete-paper");
const saveButton = document.querySelector("#save-paper");
const mainMarkdownInput = document.querySelector("#markdownPasteInput");
const mainMarkdownStatus = document.querySelector("#markdownImportStatus");
const mainMarkdownCount = document.querySelector("#main-markdown-count");
let latestMainMarkdownParse = null;

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
  normalized.customTitle = normalizeCustomTitle(normalized.customTitle);
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

function normalizeCustomTitle(value) {
  return String(value || "")
    .replace(/\s*(?:\?|\u2014|\u2013)\s*/g, " - ")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function removeMarkdownReferenceNoise(value) {
  return value
    .replace(/^[ \t]*\[\d+\]:\s+\S+.*$/gm, "")
    .replace(/\[([^\]]+)\]\[\d+\]/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/\(\s*\)/g, "")
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
  const cleaned = removeMarkdownReferenceNoise(value || "").trim();
  const lines = cleaned.split(/\r?\n/);
  const nonEmpty = lines.filter((line) => line.trim());
  const bulletWrapped = nonEmpty.length > 0 && nonEmpty.every((line) => /^\s*[-*+]\s+/.test(line));

  if (!bulletWrapped) {
    return cleaned;
  }

  return lines
    .map((line) => line.replace(/^\s*[-*+]\s?/, ""))
    .join("\n")
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
    return `${record.nickname} - ${topic}`;
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

function parseMarkdownForImport(options = {}) {
  try {
    const sourceInput = options.input || mainMarkdownInput;
    const countTarget = options.countTarget || null;
    const statusTarget = options.statusTarget || null;
    const sections = parseChatGptMarkdown(sourceInput.value);
    const foundCount = Object.keys(sections).length;
    const record = sectionsToPaperFields(sections, sourceInput.value, options);

    if (countTarget) {
      countTarget.textContent = `Parsed ${foundCount}/13 sections`;
    }

    if (foundCount < 8) {
      setTargetStatus(statusTarget, "Warning: This does not look like a complete ChatGPT 12-section literature summary.");
    } else if (!record.title || !record.doi) {
      setTargetStatus(statusTarget, "Warning: title or DOI is missing. Import is still allowed.");
    } else {
      setTargetStatus(statusTarget, "Markdown parsed. Review the preview before importing.");
    }

    return { record, foundCount };
  } catch (error) {
    console.error("Markdown parser error.", error);
    setTargetStatus(options.statusTarget || null, "Markdown parser error. Check the pasted content.");
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

async function importMarkdownToCurrentRecord(options = {}) {
  const parsed = options.parsed || parseMarkdownForImport({
    confirmTagFallback: true,
    input: options.input || mainMarkdownInput,
    countTarget: options.countTarget || null,
    statusTarget: options.statusTarget || null
  });
  if (!parsed) {
    return;
  }

  if (parsed.foundCount < 8) {
    setTargetStatus(options.statusTarget || null, "Warning: This does not look like a complete ChatGPT 12-section literature summary.");
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
      setTargetStatus(options.statusTarget || null, "Existing DOI record opened.");
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

  selectedPaperId = importedPaper.id;
  currentPaper = importedPaper;
  loadPaperIntoForm(importedPaper);
  renderPaperList();
  saveButton.disabled = false;

  const warnings = [];
  if (parsed.foundCount < 8) {
    warnings.push("Warning: This does not look like a complete ChatGPT 12-section literature summary.");
  }
  if (!incoming.title || !incoming.doi) {
    warnings.push("Warning: title or DOI is missing.");
  }

  if (options.clearOnSuccess && options.input) {
    options.input.value = "";
  }

  setTargetStatus(
    options.statusTarget || null,
    warnings.length
      ? `Imported ${parsed.foundCount}/13 sections. Paste box cleared. ${warnings.join(" ")} Review fields and click Save.`
      : `Imported ${parsed.foundCount}/13 sections. Paste box cleared. Review fields and click Save.`
  );
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
    customTitle: normalizeCustomTitle(formFields.customTitle.value),
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
  formFields.customTitle.value = normalizeCustomTitle(currentPaper.customTitle);
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
  topPaperCount.textContent = paperCount.textContent;
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

function setTargetStatus(target, message) {
  if (target) {
    target.textContent = message;
  }
  setStatus(message);
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

document.querySelector("#save-paper").addEventListener("click", () => {
  saveCurrentPaper().catch((error) => setStatus(`Save failed: ${error.message}`));
});

document.querySelector("#delete-paper").addEventListener("click", () => {
  deleteCurrentPaper().catch((error) => setStatus(`Delete failed: ${error.message}`));
});

document.querySelector("#clearMarkdownButton").addEventListener("click", () => {
  mainMarkdownInput.value = "";
  mainMarkdownStatus.textContent = "";
  mainMarkdownCount.textContent = "Parsed 0/13 sections";
  latestMainMarkdownParse = null;
});

document.querySelector("#importMarkdownButton").addEventListener("click", () => {
  importMarkdownToCurrentRecord({
    input: mainMarkdownInput,
    countTarget: mainMarkdownCount,
    statusTarget: mainMarkdownStatus,
    clearOnSuccess: true
  }).catch((error) => {
    console.error("Markdown import failed.", error);
    setTargetStatus(mainMarkdownStatus, "Markdown import failed.");
  });
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
