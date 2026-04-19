/* ===== TalesRunner Items Database ===== */
(function () {
  "use strict";

  // ── State ──
  let allItems = [];
  let filtered = [];
  let currentPage = 1;
  const PER_PAGE = 150;
  let viewMode = "grid"; // grid | list
  let allStatKeys = [];
  let allParts = [];

  // Part label mapping
  const PART_LABELS = {
    character: "Character", acchead: "Head", head: "Hair", accface: "Face",
    accneck: "Scarf", topbody: "Top", downbody: "Bottom", acchand: "Hands",
    accwrist: "Bracelet", foot: "Shoes", accbooster: "Booster", pet: "Pet",
    expansion: "Expansion", accback: "Wing", acctail: "Tail",
    etc: "Etc", "image.png": "Other", object: "Object"
  };

  // Explicit display order (matching in-game)
  const PART_ORDER = [
    "character", "acchead", "head", "accface", "accneck",
    "topbody", "downbody", "acchand", "accwrist", "foot",
    "accbooster", "pet", "expansion", "accback", "acctail",
    "etc", "image.png", "object"
  ];

  // Part icons (SVG-style inline icons matching in-game clothing silhouettes)
  const PART_ICONS = {
    character: "🔄", acchead: "👒", head: "✂️", accface: "😎",
    accneck: "🧣", topbody: "👕", downbody: "👖", acchand: "🧤",
    accwrist: "💎", foot: "👟", accbooster: "🚀", pet: "🐾",
    expansion: "✨", accback: "🪽", acctail: "🦊",
    etc: "📦", "image.png": "❓", object: "🎁"
  };

  // ── DOM refs ──
  const $ = (s) => document.getElementById(s);
  const searchInput = $("search-input");
  const searchClear = $("search-clear");
  const btnReset = $("btn-reset-filters");
  const itemsContainer = $("items-container");
  const emptyState = $("empty-state");
  const loadingState = $("loading-state");
  const paginationInfo = $("pagination-info");
  const paginationControls = $("pagination-controls");
  const statTotal = $("stat-total");
  const statShowing = $("stat-showing");
  const filterBadge = $("filter-badge");
  const activeFilters = $("active-filters");
  const activeFiltersInner = $("active-filters-inner");
  const btnBackTop = $("btn-back-top");
  const sortSelect = $("sort-select");
  const statsSearch = $("stats-search");

  // Modal
  const modalOverlay = $("item-modal");
  const modalClose = $("modal-close");
  const modalImg = $("modal-img");
  const modalName = $("modal-name");
  const modalPart = $("modal-part");
  const modalStats = $("modal-stats");

  // ── Helpers ──
  function extractPart(imgPath) {
    const parts = imgPath.split("__");
    return parts.length >= 3 ? parts[2] : "unknown";
  }

  function partLabel(key) {
    return PART_LABELS[key] || key;
  }

  function partIcon(key) {
    return PART_ICONS[key] || "📄";
  }

  function parseStatValue(val) {
    if (!val) return -Infinity;
    const num = parseFloat(val.replace(/[^0-9.\-]/g, ""));
    return isNaN(num) ? -Infinity : num;
  }

  // ── Init ──
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    createBgParticles();
    try {
      const resp = await fetch("items_clean.json");
      allItems = await resp.json();
    } catch (e) {
      console.error("Failed to load items:", e);
      loadingState.innerHTML = "<p style='color:var(--danger)'>Failed to load data.</p>";
      return;
    }

    // Derive parts & stats
    const partSet = new Set();
    const statSet = new Set();
    allItems.forEach((item) => {
      item._part = extractPart(item.image);
      item._statsCount = Object.keys(item.stats || {}).length;
      partSet.add(item._part);
      Object.keys(item.stats || {}).forEach((k) => statSet.add(k));
    });
    // Sort parts by explicit order
    allParts = [...partSet].sort((a, b) => {
      const ia = PART_ORDER.indexOf(a);
      const ib = PART_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    allStatKeys = [...statSet].sort();

    statTotal.textContent = allItems.length.toLocaleString();
    buildPartSidebar();
    buildStatFilters();
    buildSortStatOptions();
    bindEvents();
    applyFilters();
    loadingState.style.display = "none";
  }

  // ── Background particles ──
  function createBgParticles() {
    const container = $("bg-particles");
    for (let i = 0; i < 20; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const size = Math.random() * 200 + 50;
      p.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*10}s;animation-duration:${15+Math.random()*15}s`;
      container.appendChild(p);
    }
  }

  // ── Build Part Sidebar ──
  function buildPartSidebar() {
    const container = $("part-sidebar-list");
    container.innerHTML = "";

    // "All" button
    const allBtn = document.createElement("button");
    allBtn.className = "part-btn active";
    allBtn.innerHTML = `<span class="part-icon">🗂️</span><span class="part-label">All</span>`;
    allBtn.addEventListener("click", () => {
      document.querySelectorAll(".part-btn").forEach(b => b.classList.remove("active"));
      allBtn.classList.add("active");
      currentPage = 1; applyFilters();
    });
    container.appendChild(allBtn);

    allParts.forEach((part) => {
      const btn = document.createElement("button");
      btn.className = "part-btn";
      btn.setAttribute("data-part", part);
      btn.innerHTML = `<span class="part-icon">${partIcon(part)}</span><span class="part-label">${partLabel(part)}</span>`;
      btn.addEventListener("click", () => {
        document.querySelectorAll(".part-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentPage = 1; applyFilters();
      });
      container.appendChild(btn);
    });
  }

  function buildStatFilters() {
    const container = $("stats-checkboxes");
    container.innerHTML = "";
    allStatKeys.forEach((stat) => {
      const label = document.createElement("label");
      label.className = "filter-checkbox stat-filter-item";
      label.setAttribute("data-stat-lower", stat.toLowerCase());
      label.innerHTML = `<input type="checkbox" data-stat="${stat}"><span class="cb-custom"></span><span>${stat}</span>`;
      container.appendChild(label);
    });
  }

  function buildSortStatOptions() {
    const container = $("sort-stat-options");
    container.innerHTML = "";
    // "None" option
    const noneLabel = document.createElement("label");
    noneLabel.className = "sort-stat-radio sort-stat-item";
    noneLabel.setAttribute("data-stat-lower", "none");
    noneLabel.innerHTML = '<input type="radio" name="sort-stat" value="" checked><span class="radio-custom"></span><span>None</span>';
    container.appendChild(noneLabel);
    allStatKeys.forEach((stat) => {
      const label = document.createElement("label");
      label.className = "sort-stat-radio sort-stat-item";
      label.setAttribute("data-stat-lower", stat.toLowerCase());
      label.innerHTML = `<input type="radio" name="sort-stat" value="${stat}"><span class="radio-custom"></span><span>${stat}</span>`;
      container.appendChild(label);
    });
  }

  // ── Bind Events ──
  function bindEvents() {
    // Search
    searchInput.addEventListener("input", debounce(() => { currentPage = 1; applyFilters(); }, 200));
    searchClear.addEventListener("click", () => { searchInput.value = ""; searchClear.classList.remove("visible"); currentPage = 1; applyFilters(); });
    searchInput.addEventListener("input", () => { searchClear.classList.toggle("visible", searchInput.value.length > 0); });

    // Mobile parts toggle
    const btnMobileParts = $("btn-mobile-parts");
    const partSidebar = $("part-sidebar");
    const overlay = $("sidebar-overlay");
    if (btnMobileParts) {
      btnMobileParts.addEventListener("click", () => {
        partSidebar.classList.toggle("sidebar-visible");
        overlay.classList.toggle("visible", partSidebar.classList.contains("sidebar-visible"));
      });
    }
    overlay.addEventListener("click", () => {
      partSidebar.classList.remove("sidebar-visible");
      overlay.classList.remove("visible");
    });

    // Reset
    btnReset.addEventListener("click", resetFilters);

    // View toggle
    $("btn-view-grid").addEventListener("click", () => setView("grid"));
    $("btn-view-list").addEventListener("click", () => setView("list"));

    // Stats dropdown toggle
    const btnStatsDropdown = $("btn-stats-dropdown");
    const statsPanel = $("stats-dropdown-panel");
    btnStatsDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close other panels
      $("sort-stat-dropdown-panel").classList.remove("open");
      $("btn-sort-stat-dropdown").classList.remove("open");
      statsPanel.classList.toggle("open");
      btnStatsDropdown.classList.toggle("open");
    });

    // Sort stat dropdown toggle
    const btnSortStatDropdown = $("btn-sort-stat-dropdown");
    const sortStatPanel = $("sort-stat-dropdown-panel");
    btnSortStatDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close other panels
      statsPanel.classList.remove("open");
      btnStatsDropdown.classList.remove("open");
      sortStatPanel.classList.toggle("open");
      btnSortStatDropdown.classList.toggle("open");
    });

    // Close dropdowns when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".top-dropdown-stats")) {
        statsPanel.classList.remove("open");
        btnStatsDropdown.classList.remove("open");
        sortStatPanel.classList.remove("open");
        btnSortStatDropdown.classList.remove("open");
      }
    });

    // Filter change events
    document.querySelectorAll('#stats-checkboxes input').forEach(cb => cb.addEventListener("change", () => { currentPage = 1; applyFilters(); }));
    sortSelect.addEventListener("change", () => { currentPage = 1; applyFilters(); });

    // Stats search
    statsSearch.addEventListener("input", () => {
      const q = statsSearch.value.toLowerCase();
      document.querySelectorAll(".stat-filter-item").forEach((el) => {
        el.style.display = el.getAttribute("data-stat-lower").includes(q) ? "" : "none";
      });
    });

    // Sort by stat events
    document.querySelectorAll('#sort-stat-options input[name="sort-stat"]').forEach(r => {
      r.addEventListener("change", () => {
        const val = r.value;
        $("sort-stat-dropdown-text").textContent = val || "None";
        currentPage = 1; applyFilters();
      });
    });
    $("sort-dir-desc").addEventListener("click", () => {
      $("sort-dir-desc").classList.add("active");
      $("sort-dir-asc").classList.remove("active");
      currentPage = 1; applyFilters();
    });
    $("sort-dir-asc").addEventListener("click", () => {
      $("sort-dir-asc").classList.add("active");
      $("sort-dir-desc").classList.remove("active");
      currentPage = 1; applyFilters();
    });
    $("sort-stat-search").addEventListener("input", () => {
      const q = $("sort-stat-search").value.toLowerCase();
      document.querySelectorAll(".sort-stat-item").forEach((el) => {
        const val = el.getAttribute("data-stat-lower");
        el.style.display = (val === "none" || val.includes(q)) ? "" : "none";
      });
    });

    // Modal
    modalClose.addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

    // Back to top
    window.addEventListener("scroll", () => { btnBackTop.style.display = window.scrollY > 400 ? "flex" : "none"; });
    btnBackTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  // ── Filter Logic ──
  function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();

    // Selected part (single select from sidebar)
    const activePartBtn = document.querySelector('.part-btn.active');
    const selectedPart = activePartBtn ? activePartBtn.getAttribute("data-part") : null;

    // Selected stats
    const selectedStats = [...document.querySelectorAll('#stats-checkboxes input:checked')].map(cb => cb.getAttribute("data-stat"));

    filtered = allItems.filter((item) => {
      // Search
      if (query && !item.name.toLowerCase().includes(query)) return false;
      // Part (null = all parts)
      if (selectedPart && item._part !== selectedPart) return false;
      // Must have selected stats
      if (selectedStats.length > 0) {
        for (const s of selectedStats) {
          if (!(item.stats && s in item.stats)) return false;
        }
      }
      return true;
    });

    // Sort
    const sortVal = sortSelect.value;
    const sortStatRadio = document.querySelector('#sort-stat-options input[name="sort-stat"]:checked');
    const sortStatKey = sortStatRadio ? sortStatRadio.value : "";
    const sortStatDesc = $("sort-dir-desc").classList.contains("active");

    // If a stat sort is selected, it takes priority
    if (sortStatKey) {
      filtered.sort((a, b) => {
        const aVal = parseStatValue(a.stats && a.stats[sortStatKey]);
        const bVal = parseStatValue(b.stats && b.stats[sortStatKey]);
        return sortStatDesc ? bVal - aVal : aVal - bVal;
      });
    } else {
      filtered.sort((a, b) => {
        switch (sortVal) {
          case "name-asc": return a.name.localeCompare(b.name);
          case "name-desc": return b.name.localeCompare(a.name);
          case "stats-desc": return b._statsCount - a._statsCount;
          case "stats-asc": return a._statsCount - b._statsCount;
          default: return 0;
        }
      });
    }

    statShowing.textContent = filtered.length.toLocaleString();
    updateActiveFilters(selectedStats, query);
    updateFilterBadge(selectedStats);
    renderItems();
    renderPagination();

    // Update stats dropdown text
    const statsCount = selectedStats.length;
    $("stats-dropdown-text").textContent = statsCount > 0 ? `${statsCount} selected` : "All Stats";
  }

  function updateFilterBadge(selectedStats) {
    if (selectedStats.length > 0) {
      filterBadge.textContent = selectedStats.length;
      filterBadge.style.display = "flex";
    } else {
      filterBadge.style.display = "none";
    }
  }

  function updateActiveFilters(selectedStats, query) {
    activeFiltersInner.innerHTML = "";
    let hasAny = false;

    // Selected stats
    selectedStats.forEach((s) => {
      hasAny = true;
      addFilterTag(`+${s}`, () => {
        const cb = document.querySelector(`#stats-checkboxes input[data-stat="${s}"]`);
        if (cb) { cb.checked = false; currentPage = 1; applyFilters(); }
      });
    });

    activeFilters.classList.toggle("active-filters-hidden", !hasAny);
  }

  function addFilterTag(label, onRemove) {
    const tag = document.createElement("div");
    tag.className = "active-filter-tag";
    tag.innerHTML = `<span>${label}</span><button>✕</button>`;
    tag.querySelector("button").addEventListener("click", onRemove);
    activeFiltersInner.appendChild(tag);
  }

  function resetFilters() {
    searchInput.value = "";
    searchClear.classList.remove("visible");

    // Reset part sidebar
    document.querySelectorAll(".part-btn").forEach(b => b.classList.remove("active"));
    const allBtn = document.querySelector('.part-btn:not([data-part])');
    if (allBtn) allBtn.classList.add("active");

    document.querySelectorAll('#stats-checkboxes input').forEach(cb => cb.checked = false);
    sortSelect.value = "name-asc";
    statsSearch.value = "";
    document.querySelectorAll(".stat-filter-item").forEach(el => el.style.display = "");
    // Reset stat sort
    const noneRadio = document.querySelector('#sort-stat-options input[value=""]');
    if (noneRadio) noneRadio.checked = true;
    $("sort-dir-desc").classList.add("active");
    $("sort-dir-asc").classList.remove("active");
    $("sort-stat-search").value = "";
    document.querySelectorAll(".sort-stat-item").forEach(el => el.style.display = "");
    $("sort-stat-dropdown-text").textContent = "None";
    currentPage = 1;
    applyFilters();
  }

  // ── Render Items ──
  function renderItems() {
    const start = (currentPage - 1) * PER_PAGE;
    const end = start + PER_PAGE;
    const page = filtered.slice(start, end);

    itemsContainer.innerHTML = "";
    itemsContainer.className = viewMode === "list" ? "items-list" : "items-grid";
    emptyState.style.display = page.length === 0 ? "flex" : "none";

    const fragment = document.createDocumentFragment();
    page.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "item-card";
      card.setAttribute("data-idx", start + idx);

      const img = document.createElement("img");
      img.className = "item-card-img";
      img.alt = item.name;
      img.loading = "lazy";
      img.src = item.image;

      const body = document.createElement("div");
      body.className = "item-card-body";

      const name = document.createElement("div");
      name.className = "item-card-name";
      name.textContent = item.name;

      const part = document.createElement("div");
      part.className = "item-card-part";
      part.textContent = partLabel(item._part);

      body.appendChild(name);
      body.appendChild(part);

      // List mode: show stat preview
      if (viewMode === "list" && item._statsCount > 0) {
        const preview = document.createElement("div");
        preview.className = "item-card-stats-preview";
        const entries = Object.entries(item.stats).slice(0, 4);
        entries.forEach(([k, v]) => {
          const tag = document.createElement("span");
          tag.className = "stat-mini-tag";
          tag.textContent = `${k}: ${v}`;
          preview.appendChild(tag);
        });
        if (item._statsCount > 4) {
          const more = document.createElement("span");
          more.className = "stat-mini-tag";
          more.textContent = `+${item._statsCount - 4} more`;
          preview.appendChild(more);
        }
        body.appendChild(preview);
      }

      card.appendChild(img);
      card.appendChild(body);

      // Stats badge REMOVED per user request

      card.addEventListener("click", () => openModal(item));
      fragment.appendChild(card);
    });
    itemsContainer.appendChild(fragment);
  }

  // ── Pagination ──
  function renderPagination() {
    const total = Math.ceil(filtered.length / PER_PAGE);
    const start = (currentPage - 1) * PER_PAGE + 1;
    const end = Math.min(currentPage * PER_PAGE, filtered.length);

    paginationInfo.textContent = filtered.length > 0
      ? `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${filtered.length.toLocaleString()}`
      : "";

    paginationControls.innerHTML = "";
    if (total <= 1) return;

    const addBtn = (label, page, disabled, active) => {
      const btn = document.createElement("button");
      btn.className = "page-btn" + (active ? " active" : "");
      btn.textContent = label;
      btn.disabled = disabled;
      if (!disabled && !active) btn.addEventListener("click", () => { currentPage = page; renderItems(); renderPagination(); window.scrollTo({ top: 0, behavior: "smooth" }); });
      paginationControls.appendChild(btn);
    };
    const addEllipsis = () => {
      const span = document.createElement("span");
      span.className = "page-ellipsis";
      span.textContent = "…";
      paginationControls.appendChild(span);
    };

    addBtn("‹", currentPage - 1, currentPage === 1, false);

    const delta = 2;
    const pages = [];
    pages.push(1);
    let left = Math.max(2, currentPage - delta);
    let right = Math.min(total - 1, currentPage + delta);
    if (left > 2) pages.push(null);
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < total - 1) pages.push(null);
    if (total > 1) pages.push(total);

    pages.forEach((p) => {
      if (p === null) addEllipsis();
      else addBtn(p, p, false, p === currentPage);
    });

    addBtn("›", currentPage + 1, currentPage === total, false);
  }

  // ── View Toggle ──
  function setView(mode) {
    viewMode = mode;
    document.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b.getAttribute("data-view") === mode));
    renderItems();
  }

  // ── Modal ──
  function openModal(item) {
    modalImg.src = item.image;
    modalImg.alt = item.name;
    modalName.textContent = item.name;
    modalPart.textContent = partLabel(item._part);
    modalStats.innerHTML = "";

    if (item._statsCount > 0) {
      Object.entries(item.stats).forEach(([k, v]) => {
        const row = document.createElement("div");
        row.className = "modal-stat-row";
        row.innerHTML = `<span class="modal-stat-name">${k}</span><span class="modal-stat-value">${v}</span>`;
        modalStats.appendChild(row);
      });
    } else {
      modalStats.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:20px">No stats available</p>';
    }

    modalOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modalOverlay.style.display = "none";
    document.body.style.overflow = "";
  }

  // ── Utils ──
  function debounce(fn, ms) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }
})();