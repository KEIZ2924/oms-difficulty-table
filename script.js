const HEADER_URL = "header.json";

let header = null;
let scores = [];
let levelOrder = [];

let columnWidths = {
  level: 72,
  title: 300,
  artist: 210,
  field1: 140,
  field2: 140,
  patterns: 140
};

let currentPopup = null;
let selectedLevels = new Set();

const pageTitle = document.getElementById("page-title");
const pageSubtitle = document.getElementById("page-subtitle");
const descriptionBox = document.getElementById("description-box");
const meta = document.getElementById("meta");
const content = document.getElementById("content");
const searchInput = document.getElementById("search-input");

const levelFilterWrap = document.getElementById("level-filter-wrap");
const levelFilterButton = document.getElementById("level-filter-button");
const levelFilterPanel = document.getElementById("level-filter-panel");
const levelFilterOptions = document.getElementById("level-filter-options");
const selectAllLevelsButton = document.getElementById("select-all-levels");
const clearLevelsButton = document.getElementById("clear-levels");

const displayField1 = document.getElementById("display-field-1");
const displayField2 = document.getElementById("display-field-2");
const clearButton = document.getElementById("clear-button");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resolveUrl(base, path) {
  if (!path) return "";

  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

function createLink(text, href) {
  const safeText = escapeHtml(text);

  if (!href) {
    return safeText;
  }

  const safeHref = escapeHtml(href);

  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
}

function normalizeLevel(level) {
  const lv = String(level ?? "").trim();
  return lv || "未分類";
}

function getScoreSearchText(item) {
  return [item.title, item.artist]
    .map(v => String(v ?? "").toLowerCase())
    .join(" ");
}

function compareByTitleArtist(a, b) {
  const at = String(a.title ?? "");
  const bt = String(b.title ?? "");

  const titleCompare = at.localeCompare(bt, "ja");

  if (titleCompare !== 0) {
    return titleCompare;
  }

  const aa = String(a.artist ?? "");
  const ba = String(b.artist ?? "");

  return aa.localeCompare(ba, "ja");
}

function buildLevelList() {
  const fromHeader = Array.isArray(header.level_order)
    ? header.level_order.slice()
    : [];

  const existingLevels = Array.from(
    new Set(scores.map(s => normalizeLevel(s.level)))
  );

  const result = [];

  for (const lv of fromHeader) {
    if (!result.includes(lv)) {
      result.push(lv);
    }
  }

  for (const lv of existingLevels) {
    if (!result.includes(lv)) {
      result.push(lv);
    }
  }

  if (!result.includes("未分類")) {
    result.push("未分類");
  }

  return result;
}

function getAvailableLevels() {
  return levelOrder.filter(lv =>
    scores.some(s => normalizeLevel(s.level) === lv)
  );
}

function updateLevelFilterButtonText() {
  const availableLevels = getAvailableLevels();
  const selectedAvailable = availableLevels.filter(lv => selectedLevels.has(lv));

  if (selectedAvailable.length === 0) {
    levelFilterButton.textContent = "All";
    return;
  }

  if (selectedAvailable.length === availableLevels.length) {
    levelFilterButton.textContent = "All";
    return;
  }

  if (selectedAvailable.length === 1) {
    levelFilterButton.textContent = selectedAvailable[0];
    return;
  }

  if (selectedAvailable.length <= 3) {
    levelFilterButton.textContent = selectedAvailable.join(", ");
    return;
  }

  levelFilterButton.textContent = `${selectedAvailable.length} selected`;
}

function syncLevelCheckboxes() {
  const checkboxes = levelFilterOptions.querySelectorAll('input[type="checkbox"]');

  checkboxes.forEach(cb => {
    cb.checked = selectedLevels.has(cb.value);
  });
}

function populateLevelFilter() {
  levelFilterOptions.innerHTML = "";

  for (const lv of levelOrder) {
    const count = scores.filter(s => normalizeLevel(s.level) === lv).length;

    if (count <= 0) {
      continue;
    }

    const label = document.createElement("label");
    label.className = "multi-select-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = lv;
    checkbox.checked = selectedLevels.has(lv);

    const text = document.createElement("span");
    text.className = "multi-select-text";
    text.textContent = `${lv} (${count})`;

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedLevels.add(lv);
      } else {
        selectedLevels.delete(lv);
      }

      updateLevelFilterButtonText();
      render();
    });

    label.appendChild(checkbox);
    label.appendChild(text);

    levelFilterOptions.appendChild(label);
  }

  updateLevelFilterButtonText();
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function closePopup() {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
}

function toggleLevelFilterPanel() {
  levelFilterPanel.classList.toggle("hidden");
}

function closeLevelFilterPanel() {
  levelFilterPanel.classList.add("hidden");
}

function showInfoPopup(item, triggerElement) {
  closePopup();

  const popup = document.createElement("div");
  popup.className = "pattern-popup";

  let html = "";

  html += `
    <div class="popup-title">Patterns</div>
  `;

  html += `<div class="popup-stat-list">`;

  html += `
    <div class="popup-stat-row">
      <span class="popup-stat-label">Dan Estimate</span>
      <span class="popup-stat-value">
        ${hasValue(item.dan_estimate) ? escapeHtml(item.dan_estimate) : "-"}
      </span>
    </div>
  `;

  html += `
    <div class="popup-stat-row">
      <span class="popup-stat-label">BMS Difficulty</span>
      <span class="popup-stat-value">
        ${hasValue(item.bms_difficulty) ? escapeHtml(item.bms_difficulty) : "-"}
      </span>
    </div>
  `;

  html += `
    <div class="popup-stat-row">
      <span class="popup-stat-label">Sunny SR</span>
      <span class="popup-stat-value">
        ${hasValue(item.sunny_sr) ? escapeHtml(item.sunny_sr) : "-"}
      </span>
    </div>
  `;

  html += `</div>`;

  if (Array.isArray(item.patterns) && item.patterns.length > 0) {
    html += `
      <div class="popup-section">
        <div class="popup-section-title">Patterns</div>
    `;

    item.patterns.forEach(line => {
      const text = String(line);
      const parts = text.split(":");

      if (parts.length >= 2) {
        const main = escapeHtml(parts[0].trim());
        const sub = escapeHtml(parts.slice(1).join(":").trim());

        html += `
          <div class="pattern-popup-item">
            <div class="pattern-popup-main">${main}</div>
            <div class="pattern-popup-sub">${sub}</div>
          </div>
        `;
      } else {
        html += `
          <div class="pattern-popup-item">
            <div class="pattern-popup-main">${escapeHtml(text)}</div>
          </div>
        `;
      }
    });

    html += `</div>`;
  } else {
    html += `
      <div class="popup-section">
        <div class="popup-section-title">Patterns</div>
        <div class="pattern-popup-empty">No pattern data.</div>
      </div>
    `;
  }

  popup.innerHTML = html;

  document.body.appendChild(popup);

  const rect = triggerElement.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();

  let left = rect.left;
  let top = rect.bottom + 6;

  if (left + popupRect.width > window.innerWidth) {
    left = window.innerWidth - popupRect.width - 10;
  }

  if (left < 10) {
    left = 10;
  }

  if (top + popupRect.height > window.innerHeight) {
    top = rect.top - popupRect.height - 6;
  }

  if (top < 10) {
    top = 10;
  }

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;

  currentPopup = popup;
}

function formatDisplayValue(item, field, rowIndex) {
  const value = item[field];

  if (field === "patterns") {
    return `<span class="pattern-trigger" data-row="${rowIndex}">View Details</span>`;
  }

  return escapeHtml(value);
}

function setupPatternTriggers() {
  const triggers = content.querySelectorAll(".pattern-trigger");

  triggers.forEach(trigger => {
    trigger.addEventListener("click", event => {
      event.stopPropagation();

      const rowIndex = Number(trigger.dataset.row);
      const item = scores[rowIndex];

      if (!item) {
        return;
      }

      showInfoPopup(item, trigger);
    });
  });
}

function setupColumnResize() {
  const table = content.querySelector("table");

  if (!table) {
    return;
  }

  const headers = table.querySelectorAll("thead th");

  const columns = [
    "level",
    "title",
    "artist",
    "field1",
    "field2",
    "patterns"
  ];

  headers.forEach((th, index) => {
    const resizer = document.createElement("div");
    resizer.className = "resizer";

    th.appendChild(resizer);

    let startX;
    let startWidth;

    resizer.addEventListener("mousedown", event => {
      event.stopPropagation();

      startX = event.pageX;
      startWidth = th.offsetWidth;

      const onMouseMove = event => {
        const width = startWidth + (event.pageX - startX);

        if (width > 50) {
          th.style.width = `${width}px`;
          columnWidths[columns[index]] = width;
        }
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  });
}

function render() {
  closePopup();

  const keyword = searchInput.value.trim().toLowerCase();
  const selectedField1 = displayField1.value;
  const selectedField2 = displayField2.value;

  let filtered = scores.slice();

  if (selectedLevels.size > 0) {
    filtered = filtered.filter(item => selectedLevels.has(normalizeLevel(item.level)));
  }

  if (keyword) {
    filtered = filtered.filter(item => getScoreSearchText(item).includes(keyword));
  }

  const totalCount = scores.length;
  const filteredCount = filtered.length;

  meta.innerHTML = `Total: <strong>${totalCount}</strong> / Displayed: <strong>${filteredCount}</strong>`;

  if (filtered.length === 0) {
    content.className = "message";
    content.innerHTML = "No entries.";
    return;
  }

  const byLevel = new Map();

  for (const lv of levelOrder) {
    byLevel.set(lv, []);
  }

  for (const item of filtered) {
    const lv = normalizeLevel(item.level);

    if (!byLevel.has(lv)) {
      byLevel.set(lv, []);
    }

    byLevel.get(lv).push(item);
  }

  const fieldLabels = {
    type: "Type",
    sunny_sr: "Sunny SR",
    bms_difficulty: "BMS Difficulty",
    dan_estimate: "Dan Estimate",
    patterns: "Patterns"
  };

  let html = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width: ${columnWidths.level}px">Level</th>
            <th style="width: ${columnWidths.title}px">Title</th>
            <th style="width: ${columnWidths.artist}px">Artist</th>
            <th style="width: ${columnWidths.field1}px">${fieldLabels[selectedField1]}</th>
            <th style="width: ${columnWidths.field2}px">${fieldLabels[selectedField2]}</th>
            <th style="width: ${columnWidths.patterns}px">Patterns</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const lv of levelOrder) {
    const list = byLevel.get(lv) || [];

    if (list.length === 0) {
      continue;
    }

    list.sort(compareByTitleArtist);

    html += `
      <tr class="group-row">
        <td colspan="6">${escapeHtml(lv)} (${list.length})</td>
      </tr>
    `;

    for (const item of list) {
      const rowIndex = scores.indexOf(item);

      const level = normalizeLevel(item.level);
      const title = item.title || "";
      const artist = item.artist || "";
      const osuUrl = item.url || "";

      let titleHtml = escapeHtml(title);

      if (osuUrl) {
        titleHtml = createLink(title, osuUrl);
      }

      const displayValue1 = formatDisplayValue(item, selectedField1, rowIndex);
      const displayValue2 = formatDisplayValue(item, selectedField2, rowIndex);
      const patternsPopup = formatDisplayValue(item, "patterns", rowIndex);

      html += `
        <tr class="data-row">
          <td><span class="level-badge">${escapeHtml(level)}</span></td>
          <td>${titleHtml}</td>
          <td>${escapeHtml(artist)}</td>
          <td>${displayValue1}</td>
          <td>${displayValue2}</td>
          <td>${patternsPopup}</td>
        </tr>
      `;
    }
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  content.className = "";
  content.innerHTML = html;

  setupColumnResize();
  setupPatternTriggers();
}

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-cache" });

  if (!res.ok) {
    throw new Error(`${url} load failed: HTTP ${res.status}`);
  }

  return await res.json();
}

async function init() {
  try {
    header = await loadJson(HEADER_URL);

    if (!header || typeof header !== "object") {
      throw new Error("header.json format is invalid.");
    }

    const tableName = header.name || "Difficulty Table";

    pageTitle.textContent = tableName;
    document.title = tableName;
    pageSubtitle.textContent = "";

    const dataUrl = header.data_url || "score.json";
    const scoreUrl = resolveUrl(window.location.href, dataUrl);

    descriptionBox.textContent = `• Chart Source: Compiled and curated by O!M7K charters
• Rating System: Based on O!M7K dan rankings (★10.5 = Regular 10 dan | ◆13.5 = LN Zenith dan|★/◆15 > Stellium dan)
• Difficulty Analysis: Integrated SunnyRework algorithm + BMS SL/ST estimation algorithm + Pattern Analysis
• BMS Convert Settings: JUDGE = EASY, Total = max(0.2 × notes, 300), REMOVE All SV`;



    scores = await loadJson(scoreUrl);

    if (!Array.isArray(scores)) {
      throw new Error("score.json must be an array.");
    }

    levelOrder = buildLevelList();

    selectedLevels = new Set(getAvailableLevels());

    populateLevelFilter();
    syncLevelCheckboxes();

    displayField1.value = "bms_difficulty";
    displayField2.value = "sunny_sr";

    render();
  } catch (err) {
    console.error(err);

    pageSubtitle.textContent = "Error";
    content.className = "message error";
    content.textContent =
      "読み込みに失敗しました。\n\n" +
      String(err && err.message ? err.message : err);
  }
}

document.addEventListener("click", event => {
  closePopup();

  if (
    !levelFilterWrap.contains(event.target)
  ) {
    closeLevelFilterPanel();
  }
});

window.addEventListener("resize", closePopup);
window.addEventListener("scroll", closePopup, true);

searchInput.addEventListener("input", render);

displayField1.addEventListener("change", render);
displayField2.addEventListener("change", render);

levelFilterButton.addEventListener("click", event => {
  event.stopPropagation();
  toggleLevelFilterPanel();
});

levelFilterPanel.addEventListener("click", event => {
  event.stopPropagation();
});

selectAllLevelsButton.addEventListener("click", event => {
  event.stopPropagation();

  selectedLevels.clear();

  const checkboxes = levelFilterOptions.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = true;
    selectedLevels.add(cb.value);
  });

  updateLevelFilterButtonText();
  render();
});

clearLevelsButton.addEventListener("click", event => {
  event.stopPropagation();

  selectedLevels.clear();
  syncLevelCheckboxes();

  updateLevelFilterButtonText();
  render();
});

clearButton.addEventListener("click", () => {
  searchInput.value = "";

  selectedLevels = new Set(getAvailableLevels());
  syncLevelCheckboxes();

  displayField1.value = "bms_difficulty";
  displayField2.value = "sunny_sr";

  updateLevelFilterButtonText();
  render();
});

init();
