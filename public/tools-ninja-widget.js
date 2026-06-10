/////////////////////////////////
// Unnecessary but fun buttons //
/////////////////////////////////

$("#widgetRefreshGlassButton, .ninja").click(function () {
  var el = $(".ninja"),
    newone = el.clone(true);
  el.before(newone);
  $("." + el.attr("class") + ":last").remove();

  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "tools-ninja:refresh-report" }, window.location.origin);
  }
});

const setWidgetConsole = (message, level = "info", append = false) => {
  const consoleElement = document.getElementById("widgetConsole");
  if (!consoleElement) {
    return;
  }

  const atBottom =
    consoleElement.scrollHeight - consoleElement.scrollTop - consoleElement.clientHeight < 24;

  const cleanLines = String(message || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\[(?:info|error)\]\s*/i, ""))
    .filter(Boolean);

  const existingLines = append
    ? Array.from(consoleElement.querySelectorAll(".widget-console-line"))
      .map((node) => String(node.textContent || "").trim())
      .filter(Boolean)
    : [];
  const combinedLines = [...existingLines, ...cleanLines];
  const limitedLines = combinedLines.slice(-300);
  consoleElement.innerHTML = limitedLines
    .map((line) => `<div class="widget-console-line">${line}</div>`)
    .join("");
  consoleElement.className = `widget-console${limitedLines.length ? " is-visible" : ""} is-${level}`;

  if (atBottom) {
    consoleElement.scrollTop = consoleElement.scrollHeight;
  }
};

const widgetLogoStorageKey = "tools-ninja-widget-logo";
const widgetBusinessNameStorageKey = "tools-ninja-widget-business-name";
const widgetBrandColorStorageKey = "tools-ninja-widget-brand-color";
const homeSettingsStorageKey = "tools-ninja-home-settings";
const widgetVersionFallback = "v3.24 loaded";

const normalizeBrandColor = (value) => {
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#0000ff";
};

const toRgb = (hex) => {
  const value = String(hex || "").replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16) || 0,
    g: Number.parseInt(value.slice(2, 4), 16) || 0,
    b: Number.parseInt(value.slice(4, 6), 16) || 0,
  };
};

const toHex = ({ r, g, b }) => {
  const channel = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
};

const mixHex = (fromHex, toHexValue, ratio) => {
  const from = toRgb(fromHex);
  const to = toRgb(toHexValue);
  const p = Math.max(0, Math.min(1, ratio));
  return toHex({
    r: from.r + (to.r - from.r) * p,
    g: from.g + (to.g - from.g) * p,
    b: from.b + (to.b - from.b) * p,
  });
};

const syncWidgetBrandColor = (value) => {
  const color = normalizeBrandColor(value);
  const deep = mixHex(color, "#000000", 0.52);
  const strong = mixHex(color, "#000000", 0.26);
  const light = mixHex(color, "#ffffff", 0.22);
  const consoleColor = mixHex(color, "#d8f7ff", 0.34);
  const consolePrefix = mixHex(color, "#ffffff", 0.44);
  const consoleBorder = mixHex(color, "#ffffff", 0.2);
  const consoleGlow = mixHex(color, "#000000", 0.45);
  document.documentElement.style.setProperty("--ninja-dynamic-color", color);
  document.documentElement.style.setProperty("--ninja-logo-color-1", deep);
  document.documentElement.style.setProperty("--ninja-logo-color-2", strong);
  document.documentElement.style.setProperty("--ninja-logo-color-3", light);
  document.documentElement.style.setProperty("--widget-console-color", consoleColor);
  document.documentElement.style.setProperty("--widget-console-prefix", consolePrefix);
  document.documentElement.style.setProperty("--widget-console-border", consoleBorder);
  document.documentElement.style.setProperty("--widget-console-glow", consoleGlow);
};

const syncWidgetLogoPreview = (value) => {
  const panel = document.querySelector(".widget-logo-panel");
  const preview = document.getElementById("widgetLogoPreview");
  const placeholder = document.getElementById("widgetLogoPlaceholder");
  const clearButton = document.getElementById("widgetLogoClear");
  const title = document.getElementById("widgetLogoTitle");
  const uploadLabel = document.getElementById("widgetLogoUploadLabel");
  const miniUpload = document.getElementById("widgetLogoMiniUpload");

  if (!panel || !preview || !placeholder || !clearButton || !title || !uploadLabel || !miniUpload) {
    return;
  }

  if (value) {
    panel.classList.add("has-logo");
    preview.src = value;
    preview.hidden = false;
    placeholder.hidden = true;
    clearButton.hidden = true;
    title.hidden = true;
    uploadLabel.hidden = true;
    miniUpload.hidden = false;
    return;
  }

  panel.classList.remove("has-logo");
  preview.removeAttribute("src");
  preview.hidden = true;
  placeholder.hidden = false;
  clearButton.hidden = false;
  title.hidden = false;
  uploadLabel.hidden = false;
  miniUpload.hidden = true;
};

const syncWidgetBusinessName = (value) => {
  const businessName = document.getElementById("widgetBusinessName");
  if (!businessName) {
    return;
  }

  const nextValue = String(value || "").trim() || "Name of Business";
  const label = `\uf504 ${nextValue}`;
  businessName.textContent = label;
  businessName.setAttribute("data-text", label);
};

const syncWidgetRefreshHeader = (title, reportDate) => {
  const refreshSummary = document.getElementById("widgetRefreshSummary");
  if (!refreshSummary) {
    return;
  }

  const cleanTitle = String(title || "").trim();
  const cleanDate = String(reportDate || "").trim();
  if (!cleanTitle) {
    refreshSummary.hidden = true;
    refreshSummary.textContent = "";
    return;
  }

  refreshSummary.hidden = false;
  refreshSummary.textContent = cleanDate ? `${cleanTitle} ${cleanDate}` : cleanTitle;
};

const syncWidgetScriptVersion = (value) => {
  const versionElement = document.getElementById("widgetConsoleVersion");
  if (!versionElement) {
    return;
  }
  const clean = String(value || "").trim() || widgetVersionFallback;
  versionElement.textContent = clean;
};

const postWidgetHubMode = (mode) => {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "tools-ninja:hub-mode", mode }, window.location.origin);
  }
};

const initLiquidNav = () => {
  const nav = document.getElementById("tnwNav");
  const glare = document.getElementById("tnwGlare");
  const activePill = document.getElementById("tnwActivePill");
  const navButtons = Array.from(document.querySelectorAll(".tnw-nav-btn"));
  const themeBtn = document.getElementById("tnwThemeBtn");
  if (!nav || !glare || !activePill || !navButtons.length) {
    return;
  }

  const updatePill = (btn, smooth = true) => {
    if (!btn) return;
    activePill.style.transition = smooth
      ? "transform 0.45s cubic-bezier(0.34, 1.2, 0.64, 1), width 0.45s cubic-bezier(0.34, 1.2, 0.64, 1)"
      : "none";
    activePill.style.width = `${btn.offsetWidth}px`;
    activePill.style.transform = `translateX(${btn.offsetLeft}px)`;
  };

  const activate = (btn) => {
    navButtons.forEach((item) => item.classList.remove("active"));
    btn.classList.add("active");
    updatePill(btn, true);

    const action = String(btn.dataset.action || "").trim();
    if (action === "add") {
      postWidgetHubMode("add");
    } else if (action === "home") {
      postWidgetHubMode("home");
    } else {
      postWidgetHubMode("clients");
    }
  };

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => activate(btn));
  });

  nav.addEventListener("mousemove", (event) => {
    const rect = nav.getBoundingClientRect();
    glare.style.setProperty("--x", `${event.clientX - rect.left}px`);
    glare.style.setProperty("--y", `${event.clientY - rect.top}px`);
  });

  themeBtn?.addEventListener("click", () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    const active = document.querySelector(".tnw-nav-btn.active");
    if (active) {
      window.setTimeout(() => updatePill(active, true), 60);
    }
  });

  const initialActive = document.querySelector(".tnw-nav-btn.active") || navButtons[0];
  if (initialActive) {
    window.setTimeout(() => updatePill(initialActive, false), 50);
  }

  window.addEventListener("resize", () => {
    const active = document.querySelector(".tnw-nav-btn.active");
    if (active) updatePill(active, false);
  });
};

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) {
    return;
  }

  if (event.data?.type === "tools-ninja:console-log") {
    setWidgetConsole(event.data.message || "", event.data.level || "info", Boolean(event.data.append));
  }

  if (event.data?.type === "tools-ninja:refresh-header") {
    syncWidgetRefreshHeader(event.data.title || "", event.data.reportDate || "");
  }

  if (event.data?.type === "tools-ninja:business-name") {
    syncWidgetBusinessName(event.data.value || "");
  }

  if (event.data?.type === "tools-ninja:logo") {
    syncWidgetLogoPreview(event.data.value || "");
  }

  if (event.data?.type === "tools-ninja:brand-color") {
    syncWidgetBrandColor(event.data.value || "");
  }

  if (event.data?.type === "tools-ninja:script-version") {
    syncWidgetScriptVersion(event.data.value || "");
  }
});

$(document).ready(function () {
  initLiquidNav();
  syncWidgetLogoPreview(window.localStorage.getItem(widgetLogoStorageKey) || "");
  syncWidgetBusinessName(window.localStorage.getItem(widgetBusinessNameStorageKey) || "");
  try {
    const settings = JSON.parse(window.localStorage.getItem(homeSettingsStorageKey) || "{}");
    syncWidgetBrandColor(settings.companyColor || window.localStorage.getItem(widgetBrandColorStorageKey) || "#0000ff");
  } catch {
    syncWidgetBrandColor(window.localStorage.getItem(widgetBrandColorStorageKey) || "#0000ff");
  }
  syncWidgetScriptVersion(widgetVersionFallback);
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "tools-ninja:request-script-version" }, window.location.origin);
  }

  $("#widgetLogoUpload").on("change", function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      const value = String(reader.result || "");
      window.localStorage.setItem(widgetLogoStorageKey, value);
      syncWidgetLogoPreview(value);
    };
    reader.readAsDataURL(file);
  });

  $("#widgetLogoClear").on("click", function () {
    window.localStorage.removeItem(widgetLogoStorageKey);
    $("#widgetLogoUpload").val("");
    syncWidgetLogoPreview("");
  });

  $("#widgetBusinessNameEdit").on("click", function () {
    const currentValue = window.localStorage.getItem(widgetBusinessNameStorageKey) || "";
    const nextValue = window.prompt("Business name", currentValue || "Name of Business");
    if (nextValue === null) {
      return;
    }

    const trimmed = String(nextValue || "").trim();
    window.localStorage.setItem(widgetBusinessNameStorageKey, trimmed || "Name of Business");
    syncWidgetBusinessName(trimmed);
  });

  $("#outlineToggle").click(function () {
    $("body").toggleClass("outlineIt");
  });
});
