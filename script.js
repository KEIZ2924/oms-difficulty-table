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
  field3: 140
};

const pageTitle = document.getElementById("page-title");
const pageSubtitle = document.getElementById("page-subtitle");
const descriptionBox = document.getElementById("description-box");
const meta = document.getElementById("meta");
const content = document.getElementById("content");
const searchInput = document.getElementById("search-input");
const levelFilter = document.getElementById("level-filter");
const displayField1 = document.getElementById("display-field-1");
const displayField2 = document.getElementById("display-field-2");
const displayField3 = document.getElementById("display-field-3");
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
  if (!href) return safeText;
  const safeHref = escapeHtml(href);
  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
}

function normalizeLevel(level) {
  const lv = String(level ?? "").trim();
  return lv || "未分類";
}

function getScoreSearchText(item) {
  return [item.title, item.artist].map(v => String(v ?? "").toLowerCase()).join(" ");
}

function compareByTitleArtist(a, b) {
  const at = String(a.title ?? "");
  const bt = String(b.title ?? "");
  const t = at.localeCompare(bt, "ja");
  if (t !== 0) return t;
  const aa = String(a.artist ?? "");
  const ba = String(b.artist ?? "");
  return aa.localeCompare(ba, "ja");
}

function buildLevelList() {
  const fromHeader = Array.isArray(header.level_order) ? header.level_order.slice() : [];
  const existingLevels = Array.from(new Set(scores.map(s => normalizeLevel(s.level))));
  const result = [];

  for (const lv of fromHeader) {
    if (!result.includes(lv)) result.push(lv);
  }
  for (const lv of existingLevels) {
    if (!result.includes(lv)) result.push(lv);
  }
  if (!result.includes("未分類")) {
    result.push("未分類");
  }
  return result;
}

function populateLevelFilter() {
  levelFilter.innerHTML = `<option value="">All</option>`;
  for (const lv of levelOrder) {
    const count = scores.filter(s => normalizeLevel(s.level) === lv).length;
    if (count <= 0) continue;
    const opt = document.createElement("option");
    opt.value = lv;
    opt.textContent = `${lv} (${count})`;
    levelFilter.appendChild(opt);
  }
}

function formatDisplayValue(item, field) {
  const value = item[field];
  if (field === "patterns") {
    if (Array.isArray(value)) {
      return value.join("<br>");
    }
    return escapeHtml(value);
  }
  return escapeHtml(value);
}

function setupColumnResize() {
  const table = content.querySelector("table");
  if (!table) return;

  const headers = table.querySelectorAll("thead th");
  const columns = ["level", "title", "artist", "field1", "field2", "field3"];
  
  headers.forEach((th, index) => {
    const resizer = document.createElement("div");
    resizer.className = "resizer";
    th.appendChild(resizer);

    let startX, startWidth;

    resizer.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      startX = e.pageX;
      startWidth = th.offsetWidth;

      const onMouseMove = (e) => {
        const width = startWidth + (e.pageX - startX);
        if (width > 50) {
          th.style.width = width + "px";
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
  const keyword = searchInput.value.trim().toLowerCase();
  const selectedLevel = levelFilter.value;
  const selectedField1 = displayField1.value;
  const selectedField2 = displayField2.value;
  const selectedField3 = displayField3.value;

  let filtered = scores.slice();

  if (selectedLevel) {
    filtered = filtered.filter(item => normalizeLevel(item.level) === selectedLevel);
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
            <th style="width: ${columnWidths.field3}px">${fieldLabels[selectedField3]}</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const lv of levelOrder) {
    const list = byLevel.get(lv) || [];
    if (list.length === 0) continue;

    list.sort(compareByTitleArtist);

    html += `
      <tr class="group-row">
        <td colspan="6">${escapeHtml(lv)} (${list.length})</td>
      </tr>
    `;

    for (const item of list) {
      const level = normalizeLevel(item.level);
      const title = item.title || "";
      const artist = item.artist || "";
      const osuUrl = item.osu_url || "";

      let titleHtml = escapeHtml(title);
      if (osuUrl) {
        titleHtml = createLink(title, osuUrl);
      }

      const displayValue1 = formatDisplayValue(item, selectedField1);
      const displayValue2 = formatDisplayValue(item, selectedField2);
      const displayValue3 = formatDisplayValue(item, selectedField3);

      html += `
        <tr class="data-row">
          <td><span class="level-badge">${escapeHtml(level)}</span></td>
          <td>${titleHtml}</td>
          <td>${escapeHtml(artist)}</td>
          <td>${displayValue1}</td>
          <td>${displayValue2}</td>
          <td>${displayValue3}</td>
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

    descriptionBox.textContent = "T/N(total/notes)=0.2 for ALL Charts";

    scores = await loadJson(scoreUrl);
    if (!Array.isArray(scores)) {
      throw new Error("score.json must be an array.");
    }

    levelOrder = buildLevelList();
    populateLevelFilter();
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

searchInput.addEventListener("input", render);
levelFilter.addEventListener("change", render);
displayField1.addEventListener("change", render);
displayField2.addEventListener("change", render);
displayField3.addEventListener("change", render);
clearButton.addEventListener("click", () => {
  searchInput.value = "";
  levelFilter.value = "";
  render();
});

init();
