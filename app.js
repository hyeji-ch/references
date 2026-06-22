const samplePaper = {
  id: "sample-paper",
  title: "Attention Is All You Need",
  authors: "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Lukasz Kaiser, Illia Polosukhin",
  year: "2017",
  doi: "10.48550/arXiv.1706.03762",
  journal: "Advances in Neural Information Processing Systems",
  notes: "Hardcoded sample record for the static UI skeleton. DOI importing, persistence, search behavior, and JSON file handling will be implemented later."
};

const papers = [samplePaper];
let selectedPaperId = samplePaper.id;

const paperList = document.querySelector("#paper-list");
const formFields = {
  title: document.querySelector("#paper-title"),
  authors: document.querySelector("#paper-authors"),
  year: document.querySelector("#paper-year"),
  doi: document.querySelector("#paper-doi"),
  journal: document.querySelector("#paper-journal"),
  notes: document.querySelector("#paper-notes")
};

function renderPaperList() {
  paperList.innerHTML = "";

  papers.forEach((paper) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = paper.id === selectedPaperId ? "selected" : "";
    button.dataset.paperId = paper.id;
    button.innerHTML = `
      <span class="paper-title">${paper.title}</span>
      <span class="paper-meta">${paper.authors.split(",")[0]} - ${paper.year}</span>
    `;

    item.appendChild(button);
    paperList.appendChild(item);
  });
}

function loadPaperIntoForm(paper) {
  formFields.title.value = paper.title;
  formFields.authors.value = paper.authors;
  formFields.year.value = paper.year;
  formFields.doi.value = paper.doi;
  formFields.journal.value = paper.journal;
  formFields.notes.value = paper.notes;
}

paperList.addEventListener("click", (event) => {
  const selectedButton = event.target.closest("button[data-paper-id]");
  if (!selectedButton) {
    return;
  }

  selectedPaperId = selectedButton.dataset.paperId;
  const selectedPaper = papers.find((paper) => paper.id === selectedPaperId);
  renderPaperList();
  loadPaperIntoForm(selectedPaper);
});

document.querySelector("#new-paper").addEventListener("click", () => {
  Object.values(formFields).forEach((field) => {
    field.value = "";
  });
});

document.querySelector("#import-doi").addEventListener("click", () => {
  alert("DOI import will be added in a later version.");
});

document.querySelector("#save-paper").addEventListener("click", () => {
  alert("Saving will be added in a later version.");
});

document.querySelector("#delete-paper").addEventListener("click", () => {
  alert("Deleting will be added in a later version.");
});

document.querySelector("#export-json").addEventListener("click", () => {
  alert("JSON export will be added in a later version.");
});

document.querySelector("#import-json").addEventListener("click", () => {
  alert("JSON import will be added in a later version.");
});

renderPaperList();
loadPaperIntoForm(samplePaper);
