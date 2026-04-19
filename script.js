/* ===== TalesRunner Items Database ===== */
(function () {
  "use strict";

  // ── State ──
  let allItems = [];
  let filtered = [];
  let currentPage = 1;
  const PER_PAGE = 60;
  let viewMode = "grid"; // grid | list
  let allStatKeys = [];
  let allParts = [];

  // Part label mapping
  const PART_LABELS = {
    accback: "Back", accbooster: "Booster", accface: "Face",
    acchand: "Hand", acchead: "Head Acc", accneck: "Necklace",
    acctail: "Tail", accwrist: "Bracelet", character: "Character",
    downbody: "Bottom", etc: "Etc", expansion: "Expansion",
    foot: "Shoes", head: "Hair", "image.png": "Other",
    object: "Object", pet: "Pet", topbody: "Top"
  };

  // ── DOM refs ──
  const $ = (s) => document.getElementById(s);
  const searchInput = $("search-input");
  const searchClear = $("search-clear");
  const btnToggle = $("btn-toggle-filters");
  const btnReset = $("btn-reset-filters");
  const sidebar = $("filter-sidebar");
  const btnCloseSidebar = $("btn-close-sidebar");
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
    allParts = [...partSet].sort((a, b) => partLabel(a).localeCompare(partLabel(b)));
    allStatKeys = [...statSet].sort();

    statTotal.textContent = allItems.length.toLocaleString();
    buildPartBadges();
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

  function buildPartBadges() {
    const container = $("part-badges-container");
    container.innerHTML = "";
    
    const allBadge = document.createElement("div");
    allBadge.className = "part-badge active";
    allBadge.textContent = "All Parts";
    allBadge.addEventListener("click", () => {
      document.querySelectorAll(".part-badge").forEach(b => b.classList.remove("active"));
      allBadge.classList.add("active");
      currentPage = 1; applyFilters();
    });
    container.appendChild(allBadge);

    allParts.forEach((part) => {
      const count = allItems.filter((i) => i._part === part).length;
      const badge = document.createElement("div");
      badge.className = "part-badge";
      badge.setAttribute("data-part", part);
      badge.innerHTML = `${partLabel(part)} <small>(${count})</small>`;
      badge.addEventListener("click", () => {
        allBadge.classList.remove("active");
        badge.classList.toggle("active");
        if (!document.querySelector('.part-badge[data-part].active')) {
          allBadge.classList.add("active");
        }
        currentPage = 1; applyFilters();
      });
      container.appendChild(badge);
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
    $("stats-count").textContent = allStatKeys.length;
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

    // Sidebar toggle
    const btnToggle = $("btn-toggle-filters");
    const btnCloseSidebar = $("btn-close-sidebar");
    if (btnToggle) btnToggle.addEventListener("click", toggleSidebar);
    if (btnCloseSidebar) btnCloseSidebar.addEventListener("click", closeSidebar);

    // Overlay (already in HTML)
    const overlay = $("sidebar-overlay");
    overlay.addEventListener("click", closeSidebar);

    // Reset
    btnReset.addEventListener("click", resetFilters);

    // View toggle
    $("btn-view-grid").addEventListener("click", () => setView("grid"));
    $("btn-view-list").addEventListener("click", () => setView("list"));

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
      r.addEventListener("change", () => { currentPage = 1; applyFilters(); });
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

    // Collapsible groups removed, always open.


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

    // Selected parts
    const allBadgeActive = document.querySelector('.part-badge:not([data-part])').classList.contains("active");
    const selectedParts = allBadgeActive ? allParts : [...document.querySelectorAll('.part-badge.active')].map(b => b.getAttribute("data-part"));
    
    // Selected stats
    const selectedStats = [...document.querySelectorAll('#stats-checkboxes input:checked')].map(cb => cb.getAttribute("data-stat"));

    filtered = allItems.filter((item) => {
      // Search
      if (query && !item.name.toLowerCase().includes(query)) return false;
      // Part
      if (!selectedParts.includes(item._part)) return false;
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
    
    // Reset badges
    document.querySelectorAll(".part-badge").forEach(b => b.classList.remove("active"));
    const allBadge = document.querySelector('.part-badge:not([data-part])');
    if (allBadge) allBadge.classList.add("active");
    
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

      if (item._statsCount > 0) {
        const badge = document.createElement("div");
        badge.className = "item-card-stats-count";
        badge.textContent = item._statsCount + " stats";
        card.appendChild(badge);
      }

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

  // ── Sidebar ──
  function toggleSidebar() {
    sidebar.classList.toggle("sidebar-visible");
    document.getElementById("sidebar-overlay").classList.toggle("visible", sidebar.classList.contains("sidebar-visible"));
  }
  function closeSidebar() {
    sidebar.classList.remove("sidebar-visible");
    document.getElementById("sidebar-overlay").classList.remove("visible");
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