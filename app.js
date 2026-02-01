const metaKeys = [
  "id",
  "name",
  "version",
  "author",
  "description",
  "sourceDir",
];

const defaultPresets = [
  "#FF6B00",
  "#FFB347",
  "#FFD166",
  "#06D6A0",
  "#4DA3FF",
  "#118AB2",
  "#073B4C",
  "#F15BB5",
  "#9B5DE5",
  "#FFFFFF",
  "#101018",
];

const state = {
  theme: null,
};

let undoStack = [];
let lastSnapshot = null;
let suppressHistory = false;
let pickerTarget = null;
let pickerEditing = false;

const metaContainer = document.querySelector("#meta");
const darkList = document.querySelector("#dark-list");
const lightList = document.querySelector("#light-list");
const statusEl = document.querySelector("#status");
const undoBtn = document.querySelector("#undo");
const pathInput = document.querySelector("#theme-path");
const pathApplyBtn = document.querySelector("#theme-path-apply");
const uiThemeToggle = document.querySelector("#ui-theme-toggle");
const uploadInput = document.querySelector("#theme-upload");
const uploadBtn = document.querySelector("#theme-upload-btn");
const scanBtn = document.querySelector("#theme-scan");
const themeSearchInput = document.querySelector("#theme-search");
const themeListEl = document.querySelector("#theme-list");


const pickerEl = document.querySelector("#picker");
const pickerTitle = document.querySelector("#picker-title");
const pickerSub = document.querySelector("#picker-sub");
const pickerPreview = document.querySelector("#picker-preview");
const pickerHex = document.querySelector("#picker-hex");
const pickerH = document.querySelector("#picker-h");
const pickerS = document.querySelector("#picker-s");
const pickerL = document.querySelector("#picker-l");
const pickerHv = document.querySelector("#picker-hv");
const pickerSv = document.querySelector("#picker-sv");
const pickerLv = document.querySelector("#picker-lv");
const presetGrid = document.querySelector("#preset-grid");
const presetAdd = document.querySelector("#preset-add");
const harmonyGrid = document.querySelector("#harmony-grid");
const pickerNativeBtn = document.querySelector("#picker-native");
const pickerNativeInput = document.querySelector("#picker-native-input");

const cloneTheme = (theme) => JSON.parse(JSON.stringify(theme));

const normalizeHex = (value) => {
  if (!value) return "#000000";
  let v = value.trim();
  if (!v.startsWith("#")) v = "#" + v;
  if (v.length === 4) {
    v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  }
  return v.toUpperCase();
};

const hexToRgb = (hex) => {
  const v = normalizeHex(hex).slice(1);
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

const rgbToHsl = ({ r, g, b }) => {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rr:
        h = (gg - bb) / d + (gg < bb ? 6 : 0);
        break;
      case gg:
        h = (bb - rr) / d + 2;
        break;
      default:
        h = (rr - gg) / d + 4;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const hslToRgb = ({ h, s, l }) => {
  const hh = h / 360;
  const ss = s / 100;
  const ll = l / 100;

  if (ss === 0) {
    const v = Math.round(ll * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const r = hue2rgb(p, q, hh + 1 / 3);
  const g = hue2rgb(p, q, hh);
  const b = hue2rgb(p, q, hh - 1 / 3);

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

const setStatus = (text, tone = "") => {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
};

let themeCandidates = [];
let pendingUploadFile = null;

const renderThemeList = () => {
  if (!themeListEl) return;
  const filter = (themeSearchInput?.value || "").toLowerCase();
  const list = themeCandidates.filter((p) => p.toLowerCase().includes(filter));
  themeListEl.innerHTML = "";
  list.forEach((path) => {
    const item = document.createElement("div");
    item.className = "theme-item";

    const title = document.createElement("strong");
    title.textContent = path.split("/").slice(-2).join("/") || path;

    const small = document.createElement("small");
    small.textContent = path;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "primary";
    btn.textContent = "Load";
    btn.addEventListener("click", async () => {
      if (pathInput) pathInput.value = path;
      await setPath();
    });

    item.append(title, small, btn);
    themeListEl.appendChild(item);
  });
};

const scanThemes = async () => {
  setStatus("Scanning themes...", "warn");
  const res = await fetch("/api/themes");
  if (!res.ok) {
    setStatus("Scan failed", "error");
    return;
  }
  const data = await res.json();
  themeCandidates = Array.isArray(data.themes) ? data.themes : [];
  renderThemeList();
  setStatus(`Found ${themeCandidates.length} themes`, "ok");
};

const uploadTheme = async (file) => {
  if (!file) return;
  setStatus("Uploading...", "warn");
  const content = await file.text();
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, content }),
  });

  if (!res.ok) {
    const msg = await res.text();
    setStatus(`Upload failed: ${msg}`, "error");
    return;
  }

  const data = await res.json();
  if (pathInput && data.path) {
    pathInput.value = data.path;
  }
  await loadTheme();
  await scanThemes();
  setStatus("Uploaded", "ok");
};

const applyUiTheme = (mode) => {
  const theme = mode === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("uiTheme", theme);
  if (uiThemeToggle) {
    uiThemeToggle.checked = theme === "dark";
  }
};

const initUiTheme = () => {
  const stored = localStorage.getItem("uiTheme") || "light";
  applyUiTheme(stored);
};

const loadPath = async () => {
  if (!pathInput) return;
  const res = await fetch("/api/path");
  if (!res.ok) {
    setStatus("Failed to load path", "error");
    return;
  }
  const data = await res.json();
  pathInput.value = data.path || "";
};

const setPath = async () => {
  if (!pathInput) return;
  const value = pathInput.value.trim();
  if (!value) return;
  setStatus("Switching path...", "warn");
  const res = await fetch("/api/path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: value }),
  });

  if (!res.ok) {
    const msg = await res.text();
    setStatus(`Path error: ${msg}`, "error");
    return;
  }

  const data = await res.json();
  pathInput.value = data.path || value;
  await loadTheme();
  setStatus("Path loaded", "ok");
};

const updateUndoButton = () => {
  undoBtn.disabled = undoStack.length === 0;
};

const pushUndo = () => {
  if (suppressHistory || !lastSnapshot) return;
  undoStack.push(cloneTheme(lastSnapshot));
  if (undoStack.length > 50) {
    undoStack.shift();
  }
  updateUndoButton();
};

const commitSnapshot = () => {
  lastSnapshot = readValues();
};

const beginPickerEdit = () => {
  if (pickerEditing) return;
  pushUndo();
  pickerEditing = true;
};

const endPickerEdit = () => {
  pickerEditing = false;
  commitSnapshot();
  updateUndoButton();
};

const buildMeta = (theme) => {
  metaContainer.innerHTML = "";
  metaKeys.forEach((key) => {
    const field = document.createElement("div");
    field.className = "field";

    const label = document.createElement("label");
    label.textContent = key;

    const input = document.createElement("input");
    input.type = "text";
    input.value = theme[key] ?? "";
    input.dataset.key = key;

    input.addEventListener("input", () => {
      pushUndo();
      commitSnapshot();
      setStatus("Edited", "warn");
    });

    field.append(label, input);
    metaContainer.appendChild(field);
  });
};

const buildList = (container, palette, section) => {
  container.innerHTML = "";
  Object.keys(palette).forEach((key) => {
    const row = document.createElement("div");
    row.className = "color-row";

    const info = document.createElement("div");
    info.className = "color-info";

    const label = document.createElement("span");
    label.textContent = key;

    const token = document.createElement("small");
    token.textContent = `${section}.${key}`;

    info.append(label, token);

    const controls = document.createElement("div");
    controls.className = "color-controls";

    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.style.background = normalizeHex(palette[key]);

    const text = document.createElement("input");
    text.type = "text";
    text.value = normalizeHex(palette[key]);
    text.dataset.section = section;
    text.dataset.key = key;

    swatch.addEventListener("click", () => {
      openPicker(section, key, text, swatch);
    });

    text.addEventListener("input", () => {
      pushUndo();
      const normalized = normalizeHex(text.value);
      text.value = normalized;
      swatch.style.background = normalized;
      commitSnapshot();
      setStatus("Edited", "warn");
    });

    controls.append(swatch, text);
    row.append(info, controls);
    container.appendChild(row);
  });
};

const applyThemeToUI = (theme) => {
  state.theme = theme;
  buildMeta(theme);
  buildList(darkList, theme.dark, "dark");
  buildList(lightList, theme.light, "light");
};

const readValues = () => {
  const theme = { ...state.theme };
  theme.dark = { ...theme.dark };
  theme.light = { ...theme.light };

  metaContainer.querySelectorAll("input").forEach((input) => {
    theme[input.dataset.key] = input.value;
  });

  document.querySelectorAll(".color-row input[type='text']").forEach((input) => {
    const section = input.dataset.section;
    const key = input.dataset.key;
    theme[section][key] = normalizeHex(input.value);
  });

  return theme;
};

const loadTheme = async () => {
  setStatus("Loading...");
  const res = await fetch("/api/theme");
  if (!res.ok) {
    setStatus("Failed to load theme", "error");
    return;
  }
  const data = await res.json();
  suppressHistory = true;
  applyThemeToUI(data);
  suppressHistory = false;
  undoStack = [];
  commitSnapshot();
  updateUndoButton();
  setStatus("Loaded", "ok");
};

const saveTheme = async () => {
  const data = readValues();
  setStatus("Saving...");
  const res = await fetch("/api/theme", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const msg = await res.text();
    setStatus(`Save failed: ${msg}`, "error");
    return;
  }

  commitSnapshot();
  setStatus("Saved", "ok");
};

const undoEdit = () => {
  if (!undoStack.length) return;
  const previous = undoStack.pop();
  suppressHistory = true;
  applyThemeToUI(previous);
  suppressHistory = false;
  commitSnapshot();
  updateUndoButton();
  setStatus("Undo", "ok");
};

const getPresetList = () => {
  const stored = JSON.parse(localStorage.getItem("themeTweakerPresets") || "[]");
  const unique = [];
  [...defaultPresets, ...stored].forEach((color) => {
    const hex = normalizeHex(color);
    if (!unique.includes(hex)) unique.push(hex);
  });
  return unique;
};

const savePresets = (list) => {
  const trimmed = list.slice(0, 60);
  localStorage.setItem("themeTweakerPresets", JSON.stringify(trimmed));
};

const renderPresets = () => {
  presetGrid.innerHTML = "";
  const list = getPresetList();
  list.forEach((color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.background = color;
    btn.title = color;
    btn.addEventListener("click", () => {
      applyPickerColor(color);
    });
    presetGrid.appendChild(btn);
  });
};

const renderHarmony = (hex) => {
  if (!harmonyGrid) return;
  harmonyGrid.innerHTML = "";
  const base = normalizeHex(hex);
  const hsl = rgbToHsl(hexToRgb(base));
  const steps = [95, 85, 75, 65, 55, 45, 35, 25, 15];
  steps.forEach((l) => {
    const color = rgbToHex(hslToRgb({ h: hsl.h, s: hsl.s, l }));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.background = color;
    btn.title = color;
    btn.addEventListener("click", () => {
      applyPickerColor(color);
    });
    harmonyGrid.appendChild(btn);
  });
};

const syncPickerUI = (hex) => {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  pickerPreview.style.background = hex;
  pickerHex.value = hex;
  pickerH.value = hsl.h;
  pickerS.value = hsl.s;
  pickerL.value = hsl.l;
  pickerHv.textContent = hsl.h;
  pickerSv.textContent = hsl.s;
  pickerLv.textContent = hsl.l;
  if (pickerNativeInput) pickerNativeInput.value = hex;
  renderHarmony(hex);
};

const applyPickerColor = (hex) => {
  if (!pickerTarget) return;
  const normalized = normalizeHex(hex);
  beginPickerEdit();
  pickerTarget.text.value = normalized;
  pickerTarget.swatch.style.background = normalized;
  syncPickerUI(normalized);
  commitSnapshot();
  setStatus("Edited", "warn");
};

const openPicker = (section, key, textInput, swatchEl) => {
  pickerTarget = { section, key, text: textInput, swatch: swatchEl };
  pickerTitle.textContent = key;
  pickerSub.textContent = `${section}.${key}`;
  const current = normalizeHex(textInput.value);
  syncPickerUI(current);
  renderPresets();
  pickerEl.classList.remove("hidden");
  pickerEl.setAttribute("aria-hidden", "false");
  pickerEditing = false;
};

const closePicker = () => {
  pickerEl.classList.add("hidden");
  pickerEl.setAttribute("aria-hidden", "true");
  pickerTarget = null;
  endPickerEdit();
};

const handleSliderChange = () => {
  const hsl = {
    h: Number(pickerH.value),
    s: Number(pickerS.value),
    l: Number(pickerL.value),
  };
  pickerHv.textContent = hsl.h;
  pickerSv.textContent = hsl.s;
  pickerLv.textContent = hsl.l;
  const rgb = hslToRgb(hsl);
  const hex = rgbToHex(rgb);
  applyPickerColor(hex);
};

pickerHex.addEventListener("input", () => {
  applyPickerColor(pickerHex.value);
});

if (pickerNativeBtn && pickerNativeInput) {
  pickerNativeBtn.addEventListener("click", () => pickerNativeInput.click());
  pickerNativeInput.addEventListener("input", () => {
    applyPickerColor(pickerNativeInput.value);
  });
}


pickerH.addEventListener("input", handleSliderChange);
pickerS.addEventListener("input", handleSliderChange);
pickerL.addEventListener("input", handleSliderChange);

presetAdd.addEventListener("click", () => {
  const current = pickerHex.value;
  const list = getPresetList();
  const normalized = normalizeHex(current);
  if (!list.includes(normalized)) {
    list.unshift(normalized);
    savePresets(list.filter((color) => !defaultPresets.includes(color)));
    renderPresets();
  }
});

pickerEl.addEventListener("click", (event) => {
  if (event.target === pickerEl) {
    closePicker();
  }
});

document.querySelector("#picker-close").addEventListener("click", closePicker);

document.querySelector("#reload").addEventListener("click", loadTheme);
document.querySelector("#save").addEventListener("click", saveTheme);
undoBtn.addEventListener("click", undoEdit);

if (uiThemeToggle) {
  uiThemeToggle.addEventListener("change", () => {
    applyUiTheme(uiThemeToggle.checked ? "dark" : "light");
  });
}

if (pathApplyBtn) {
  pathApplyBtn.addEventListener("click", setPath);
}

if (pathInput) {
  pathInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      setPath();
    }
  });
}

const init = async () => {
  initUiTheme();
  await loadPath();
  await loadTheme();
  await scanThemes();
};

init();
