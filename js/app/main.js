const API_URL =
  "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PesquisarPostos?idsTiposComb=1120%2C3400%2C3205%2C3405%2C3201%2C2105%2C2101&idMarca=&idTipoPosto=&idDistrito=&idsMunicipios=&qtdPorPagina=11713";
const DB_NAME = "meuBancoDeDados";
const STORE_NAME = "meusDados";
const CACHE_KEY = "output";
const CONSENT_KEY = "ptfuel_cookie_consent_v1";

const MONETIZATION_CONFIG = {
  gaMeasurementId: window.PTFUEL_MONETIZATION?.gaMeasurementId || "",
  adsenseClientId: window.PTFUEL_MONETIZATION?.adsenseClientId || "",
  affiliateBaseUrl: window.PTFUEL_MONETIZATION?.affiliateBaseUrl || "",
};

const initialViewBoxX = 615;
const initialViewBoxY = 0;
const initialViewBoxWidth = 580;
const initialViewBoxHeight = 277;

const state = {
  allPosts: [],
  districtPosts: [],
  filteredPosts: [],
  selectedDistrict: "",
  selectedMunicipio: "",
  selectedFuel: "",
  selectedBrand: "",
  sortOrder: "asc",
  searchQuery: "",
  currentPage: 1,
  pageSize: 25,
};

const ui = {};
let lastClickedElement = null;

document.addEventListener("DOMContentLoaded", () => {
  cacheDomElements();
  bindStaticEvents();
  const consentStatus = setupCookieConsent();
  applyConsentSettings(consentStatus);
  startDataLoad();
});

function cacheDomElements() {
  ui.title = null; // removed from DOM
  ui.app = document.getElementById("app");
  ui.form = document.getElementById("form");
  ui.svg = document.getElementById("meuSVG");
  ui.mapWrapper = document.getElementById("tuga");
  ui.cityTitle = document.getElementById("cityTitle");
  ui.municipiosTitle = document.getElementById("municipiosTitle");
  ui.fuelsTitle = document.getElementById("Fuels");
  ui.brandTitle = document.getElementById("Brand");
  ui.municipiosContainer = document.getElementById("municipiosContainer");
  ui.fuelContainer = document.getElementById("FuelContainer");
  ui.brandContainer = document.getElementById("BrandContainer");
  ui.info = document.getElementById("info");
  ui.filters = document.getElementById("filters");
  ui.priceSummary = document.getElementById("precoMedio");
  ui.sortBox = document.getElementById("boxx");
  ui.sortSelect = ui.sortBox ? ui.sortBox.querySelector("select") : null;
  ui.closeBtn = document.getElementById("closePanelBtn");
  ui.adSlotTop = document.getElementById("adSlotTop");
  ui.adSlotTopText = document.getElementById("adSlotTopText");
}

function bindStaticEvents() {
  const districtPaths = document.querySelectorAll("#meuSVG path[id]");
  districtPaths.forEach((pathElement) => {
    pathElement.addEventListener("click", onDistrictClick);
  });

  if (ui.closeBtn) {
    ui.closeBtn.addEventListener("click", () => {
      if (lastClickedElement) {
        resetMapAndPanel(lastClickedElement);
      }
    });
  }

  if (ui.sortSelect) {
    ui.sortSelect.addEventListener("change", (event) => {
      state.sortOrder =
        event.target.value === "desc" ||
        event.target.value === "Preço: Do mais caro para o mais barato"
          ? "desc"
          : "asc";
      state.currentPage = 1;
      refreshFilteredView();
    });
  }

  setupSearchAndPaginationControls();
}

function setupSearchAndPaginationControls() {
  if (!ui.filters) {
    return;
  }

  ui.filters.innerHTML = `
    <section class="search-toolbar" aria-label="Ferramentas de pesquisa">
      <div class="toolbar-grid">
        <label class="input-field input-field--search">
          <span class="input-label">Pesquisa direta</span>
          <input id="searchInput" type="search" placeholder="Posto, morada ou localidade" autocomplete="off" />
        </label>
        <label class="input-field input-field--sort">
          <span class="input-label">Ordenar</span>
          <select id="toolbarSortSelect">
            <option value="asc" selected>Mais barato primeiro</option>
            <option value="desc">Mais caro primeiro</option>
          </select>
        </label>
      </div>
      <div id="pagination" class="pagination toolbar-pagination"></div>
    </section>
  `;

  ui.searchInput = document.getElementById("searchInput");
  ui.toolbarSortSelect = document.getElementById("toolbarSortSelect");
  ui.pagination = document.getElementById("pagination");

  if (ui.toolbarSortSelect) {
    ui.toolbarSortSelect.value = state.sortOrder;
    ui.toolbarSortSelect.addEventListener("change", (event) => {
      state.sortOrder = event.target.value === "desc" ? "desc" : "asc";
      state.currentPage = 1;
      refreshFilteredView();
    });
  }

  if (ui.searchInput) {
    ui.searchInput.addEventListener("input", (event) => {
      state.searchQuery = event.target.value || "";
      state.currentPage = 1;
      refreshFilteredView();
    });
  }

  setControlsEnabled(false);
}

async function startDataLoad() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Falha na API (${response.status})`);
    }

    const payload = await response.json();
    const rawList = Array.isArray(payload.resultado) ? payload.resultado : [];
    state.allPosts = rawList.map(normalizePost);
    await savePostsInCache(state.allPosts);
  } catch (error) {
    console.error("Falha no carregamento online. A tentar cache local.", error);
    const cachedPosts = await getPostsFromCache();
    state.allPosts = cachedPosts;
  }

  if (!state.allPosts.length) {
    renderDataError();
    return;
  }

  // If the user already clicked a district while data was loading, render it now
  if (state.selectedDistrict) {
    state.districtPosts = state.allPosts.filter((post) =>
      sameText(post.district, state.selectedDistrict),
    );
    setControlsEnabled(true);
    refreshFilteredView();
  }
}

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function savePostsInCache(posts) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(posts, CACHE_KEY);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = (event) => {
      db.close();
      reject(event.target.error);
    };
  });
}

async function getPostsFromCache() {
  try {
    const db = await openDatabase();

    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);

      request.onsuccess = () => {
        const cached = request.result;
        db.close();
        resolve(Array.isArray(cached) ? cached : []);
      };

      request.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch (error) {
    console.error("Erro ao abrir cache local.", error);
    return [];
  }
}

function normalizePost(post) {
  const priceValue = parseEuroPrice(post.Preco);

  return {
    id: post.Id || crypto.randomUUID(),
    name: post.Nome || "Posto sem nome",
    type: post.TipoPosto || "N/A",
    municipio: post.Municipio || "Sem municipio",
    district: post.Distrito || "Sem distrito",
    fuel: post.Combustivel || "Sem combustivel",
    brand: post.Marca || "Sem marca",
    address: post.Morada || "Morada nao disponivel",
    locality: post.Localidade || "",
    postalCode: post.CodPostal || "",
    updatedAt: post.DataAtualizacao || "",
    priceText: post.Preco || "N/A",
    priceValue,
    latitude: post.Latitude,
    longitude: post.Longitude,
  };
}

function parseEuroPrice(value) {
  if (!value) {
    return Number.NaN;
  }

  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function onDistrictClick(event) {
  const districtName = event.target.getAttribute("id") || "";
  if (!districtName) {
    return;
  }

  // If map is hidden (district already active), ignore map clicks
  if (ui.app && ui.app.classList.contains("district-active")) {
    return;
  }

  focusDistrict(event.target, districtName);
}

function focusDistrict(pathElement, districtName) {
  animateTitleAndPanelOpen();
  highlightDistrict(pathElement);

  state.selectedDistrict = districtName;
  state.selectedMunicipio = "";
  state.selectedFuel = "";
  state.selectedBrand = "";
  state.searchQuery = "";
  state.currentPage = 1;

  ui.cityTitle.textContent = districtName;

  if (state.allPosts.length === 0) {
    // Data still loading — show a spinner in the stats area
    if (ui.priceSummary) {
      ui.priceSummary.innerHTML =
        '<div class="stat-item"><span class="stat-label">A carregar dados...</span></div>';
    }
    setControlsEnabled(false);
    return;
  }

  ui.municipiosTitle.textContent = "Concelhos";
  ui.fuelsTitle.textContent = "Combustíveis";
  ui.brandTitle.textContent = "Marcas";

  state.districtPosts = state.allPosts.filter((post) =>
    sameText(post.district, districtName),
  );

  setControlsEnabled(true);
  if (ui.searchInput) {
    ui.searchInput.value = "";
  }

  refreshFilteredView();
}

function resetMapAndPanel(pathElement) {
  animateTitleAndPanelClose();

  state.selectedDistrict = "";
  state.selectedMunicipio = "";
  state.selectedFuel = "";
  state.selectedBrand = "";
  state.districtPosts = [];
  state.filteredPosts = [];
  state.searchQuery = "";
  state.currentPage = 1;

  if (lastClickedElement) {
    lastClickedElement.style.fill = "";
  }

  if (pathElement) {
    pathElement.style.fill = "";
  }

  lastClickedElement = null;
  clearDistrictContent();
}

function highlightDistrict(pathElement) {
  if (lastClickedElement) {
    lastClickedElement.style.fill = "";
  }

  pathElement.style.fill = "#3a3939";
  lastClickedElement = pathElement;
}

function clearDistrictContent() {
  if (ui.sortBox) {
    ui.sortBox.style.display = "none";
  }

  ui.cityTitle.textContent = "";
  ui.municipiosContainer.innerHTML = "";
  ui.fuelContainer.innerHTML = "";
  ui.brandContainer.innerHTML = "";
  ui.info.innerHTML = "";
  ui.priceSummary.innerHTML = "";
  if (ui.pagination) {
    ui.pagination.innerHTML = "";
  }
  if (ui.searchInput) {
    ui.searchInput.value = "";
  }
  setControlsEnabled(false);
}

function refreshFilteredView() {
  if (!state.selectedDistrict) {
    return;
  }

  const filtered = state.districtPosts.filter((post) => {
    const municipioMatch =
      !state.selectedMunicipio ||
      sameText(post.municipio, state.selectedMunicipio);
    const fuelMatch =
      !state.selectedFuel || sameText(post.fuel, state.selectedFuel);
    const brandMatch =
      !state.selectedBrand || sameText(post.brand, state.selectedBrand);
    const searchMatch = postMatchesSearch(post, state.searchQuery);
    return municipioMatch && fuelMatch && brandMatch && searchMatch;
  });

  filtered.sort((a, b) => {
    const valueA = Number.isFinite(a.priceValue)
      ? a.priceValue
      : Number.POSITIVE_INFINITY;
    const valueB = Number.isFinite(b.priceValue)
      ? b.priceValue
      : Number.POSITIVE_INFINITY;
    return state.sortOrder === "desc" ? valueB - valueA : valueA - valueB;
  });

  state.filteredPosts = filtered;
  normalizeCurrentPage();
  renderFilterGroups();
  renderPosts(getPaginatedPosts());
  renderSummary();
  renderPagination();

  if (ui.sortBox) {
    ui.sortBox.style.display = "none";
  }
}

// Tracks which filter sections are collapsed: key = section id
const filterCollapsed = {
  munHover: false,
  fuelsHover: false,
  brandHover: false,
};

const filterExpanded = {
  munHover: false,
  fuelsHover: false,
  brandHover: false,
};

function renderFilterGroups() {
  const fuelsBase = state.districtPosts.filter((post) => {
    return (
      !state.selectedMunicipio ||
      sameText(post.municipio, state.selectedMunicipio)
    );
  });

  const brandsBase = fuelsBase.filter((post) => {
    return !state.selectedFuel || sameText(post.fuel, state.selectedFuel);
  });

  const municipios = buildGroupedOptions(state.districtPosts, "municipio");
  const fuels = buildGroupedOptions(fuelsBase, "fuel");
  const brands = buildGroupedOptions(brandsBase, "brand");

  setupCollapsibleSection(
    "munHover",
    ui.municipiosTitle,
    "Concelhos",
    state.selectedMunicipio || "Todos os concelhos",
  );
  setupCollapsibleSection(
    "fuelsHover",
    ui.fuelsTitle,
    "Combustíveis",
    state.selectedFuel || "Todos os combustíveis",
  );
  setupCollapsibleSection(
    "brandHover",
    ui.brandTitle,
    "Marcas",
    state.selectedBrand || "Todas as marcas",
  );

  renderFilterButtons({
    container: ui.municipiosContainer,
    options: municipios,
    selectedValue: state.selectedMunicipio,
    allLabel: "Todos os concelhos",
    sectionId: "munHover",
    onClick: (value) => {
      state.selectedMunicipio = value;
      state.selectedFuel = "";
      state.selectedBrand = "";
      state.currentPage = 1;
      refreshFilteredView();
    },
  });

  renderFilterButtons({
    container: ui.fuelContainer,
    options: fuels,
    selectedValue: state.selectedFuel,
    allLabel: "Todos os combustíveis",
    sectionId: "fuelsHover",
    onClick: (value) => {
      state.selectedFuel = value;
      state.selectedBrand = "";
      state.currentPage = 1;
      refreshFilteredView();
    },
  });

  renderFilterButtons({
    container: ui.brandContainer,
    options: brands,
    selectedValue: state.selectedBrand,
    allLabel: "Todas as marcas",
    sectionId: "brandHover",
    onClick: (value) => {
      state.selectedBrand = value;
      state.currentPage = 1;
      refreshFilteredView();
    },
  });
}

function setupCollapsibleSection(sectionId, titleEl, label, summaryText) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  // Already wired up — just update title and apply collapse state
  if (section.dataset.collapsible === "true") {
    const h2 = section.querySelector("h2");
    if (h2) h2.textContent = label;
    const summary = section.querySelector(".filter-summary");
    if (summary) summary.textContent = summaryText || "";
    const body = section.querySelector(".filter-body");
    if (body) body.classList.toggle("collapsed", !!filterCollapsed[sectionId]);
    const btn = section.querySelector(".filter-toggle");
    if (btn)
      btn.setAttribute(
        "aria-expanded",
        filterCollapsed[sectionId] ? "false" : "true",
      );
    return;
  }

  section.dataset.collapsible = "true";
  section.classList.add("filter-section");

  // Capture the filter container (sibling of titleEl) BEFORE moving titleEl
  const filterContainer = titleEl.nextElementSibling;

  titleEl.textContent = label;

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "filter-toggle";
  toggleBtn.setAttribute("aria-expanded", "true");
  toggleBtn.setAttribute("aria-controls", sectionId + "-body");

  const summary = document.createElement("span");
  summary.className = "filter-summary";
  summary.textContent = summaryText || "";

  const icon = document.createElement("span");
  icon.className = "filter-toggle-icon";
  icon.textContent = "▾";

  // Build toggleBtn outside the DOM, then replace titleEl with it
  toggleBtn.appendChild(titleEl);
  toggleBtn.appendChild(summary);
  toggleBtn.appendChild(icon);
  section.insertBefore(toggleBtn, filterContainer || null);

  // Wrap the filter container in a body div
  const body = document.createElement("div");
  body.className = "filter-body";
  body.id = sectionId + "-body";
  if (filterContainer) body.appendChild(filterContainer);
  section.appendChild(body);

  toggleBtn.addEventListener("click", () => {
    filterCollapsed[sectionId] = !filterCollapsed[sectionId];
    toggleBtn.setAttribute(
      "aria-expanded",
      filterCollapsed[sectionId] ? "false" : "true",
    );
    body.classList.toggle("collapsed", filterCollapsed[sectionId]);
  });
}

function buildGroupedOptions(list, key) {
  const grouped = new Map();

  list.forEach((post) => {
    const value = String(post[key] || "N/A").trim();
    grouped.set(value, (grouped.get(value) || 0) + 1);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "pt-PT"))
    .map(([value, count]) => ({ value, count }));
}

function renderFilterButtons({
  container,
  options,
  selectedValue,
  allLabel,
  sectionId,
  onClick,
}) {
  const VISIBLE_LIMIT = 8;
  container.innerHTML = "";

  const allButton = createFilterButton(
    `${allLabel} (${state.districtPosts.length})`,
    !selectedValue,
  );
  allButton.addEventListener("click", () => onClick(""));
  container.appendChild(allButton);

  const selectedIndex = options.findIndex((option) =>
    sameText(option.value, selectedValue),
  );

  let optionsToRender = options;
  const shouldClamp =
    sectionId && options.length > VISIBLE_LIMIT && !filterExpanded[sectionId];

  if (shouldClamp) {
    optionsToRender = options.slice(0, VISIBLE_LIMIT);

    // Keep selected option visible even when it falls outside the first items.
    if (selectedIndex >= VISIBLE_LIMIT) {
      const selectedOption = options[selectedIndex];
      optionsToRender = optionsToRender.slice(0, VISIBLE_LIMIT - 1);
      optionsToRender.push(selectedOption);
    }
  }

  optionsToRender.forEach((option) => {
    const isActive = sameText(option.value, selectedValue);
    const button = createFilterButton(
      `${option.value} (${option.count})`,
      isActive,
    );
    button.addEventListener("click", () => onClick(option.value));
    container.appendChild(button);
  });

  if (sectionId && options.length > VISIBLE_LIMIT) {
    const actionWrap = document.createElement("div");
    actionWrap.className = "filter-actions";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "filter-more-btn";
    toggleButton.textContent = filterExpanded[sectionId]
      ? "Ver menos"
      : `Ver mais (${options.length - VISIBLE_LIMIT})`;
    toggleButton.addEventListener("click", () => {
      filterExpanded[sectionId] = !filterExpanded[sectionId];
      renderFilterGroups();
    });

    actionWrap.appendChild(toggleButton);
    container.appendChild(actionWrap);
  }
}

function createFilterButton(text, isActive) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.className = isActive ? "municipio-button-active" : "municipio-button";
  return button;
}

function renderPosts(postsPage) {
  ui.info.innerHTML = "";

  if (!postsPage.length) {
    ui.info.innerHTML =
      '<p class="no-results">Sem resultados para os filtros selecionados.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  postsPage.forEach((post) => {
    const card = document.createElement("article");
    card.className = "posto-info";

    const mapsUrl =
      Number.isFinite(post.latitude) && Number.isFinite(post.longitude)
        ? `https://www.google.com/maps?q=${post.latitude},${post.longitude}`
        : "";

    const affiliateUrl = buildAffiliateUrl(post);

    card.innerHTML = `
      <div class="posto-head">
        <h3 class="posto-name">${escapeHtml(post.name)}</h3>
        <span class="posto-price">${formatPrice(post)}</span>
      </div>
      <div class="posto-secondary">
        <span class="posto-fuel-tag">${escapeHtml(post.fuel)}</span>
        <span class="meta-chip">${escapeHtml(post.municipio)}</span>
      </div>
      <p class="posto-address">${escapeHtml(post.address)}</p>
      <div class="posto-meta">
        <span class="meta-chip">${escapeHtml(post.brand)}</span>
        <span class="meta-chip">${escapeHtml(post.updatedAt || "N/A")}</span>
        ${mapsUrl ? `<a class="posto-map-link" href="${mapsUrl}" target="_blank" rel="noreferrer">Ver no mapa</a>` : ""}
        ${affiliateUrl ? `<a class="posto-aff-link" href="${affiliateUrl}" target="_blank" rel="sponsored noreferrer">Oferta</a>` : ""}
      </div>
    `;

    fragment.appendChild(card);
  });

  ui.info.appendChild(fragment);
}

function renderPagination() {
  if (!ui.pagination) {
    return;
  }

  ui.pagination.innerHTML = "";

  const totalPages = getTotalPages();
  if (totalPages <= 1) {
    return;
  }

  const previousButton = document.createElement("button");
  previousButton.type = "button";
  previousButton.className = "page-btn";
  previousButton.textContent = "Anterior";
  previousButton.disabled = state.currentPage <= 1;
  previousButton.addEventListener("click", () => {
    state.currentPage = Math.max(1, state.currentPage - 1);
    refreshFilteredView();
  });

  const pageInfo = document.createElement("span");
  pageInfo.className = "page-info";
  pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "page-btn";
  nextButton.textContent = "Seguinte";
  nextButton.disabled = state.currentPage >= totalPages;
  nextButton.addEventListener("click", () => {
    state.currentPage = Math.min(totalPages, state.currentPage + 1);
    refreshFilteredView();
  });

  ui.pagination.appendChild(previousButton);
  ui.pagination.appendChild(pageInfo);
  ui.pagination.appendChild(nextButton);
}

function renderSummary() {
  ui.priceSummary.innerHTML = "";

  if (!state.filteredPosts.length) {
    ui.priceSummary.innerHTML =
      '<div class="stat-item"><span class="stat-label">Postos</span><strong class="stat-value">0</strong></div>';
    return;
  }

  const priceList = state.filteredPosts
    .map((post) => post.priceValue)
    .filter((value) => Number.isFinite(value));

  const avgPrice = priceList.length
    ? priceList.reduce((acc, value) => acc + value, 0) / priceList.length
    : Number.NaN;
  const minPrice = priceList.length ? Math.min(...priceList) : Number.NaN;
  const maxPrice = priceList.length ? Math.max(...priceList) : Number.NaN;

  ui.priceSummary.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">Postos</span>
      <strong class="stat-value">${state.filteredPosts.length}</strong>
    </div>
    <div class="stat-item">
      <span class="stat-label">M\u00ednimo</span>
      <strong class="stat-value">${formatPriceValue(minPrice)}</strong>
    </div>
    <div class="stat-item">
      <span class="stat-label">M\u00e9dio</span>
      <strong class="stat-value">${formatPriceValue(avgPrice)}</strong>
    </div>
    <div class="stat-item">
      <span class="stat-label">M\u00e1ximo</span>
      <strong class="stat-value">${formatPriceValue(maxPrice)}</strong>
    </div>
  `;
}

function renderDataError() {
  ui.priceSummary.innerHTML = `
    <p class="summary-title">Dados indisponiveis</p>
    <p class="summary-item">Nao foi possivel carregar os dados da API nem do cache local.</p>
  `;
}

function formatPrice(post) {
  if (Number.isFinite(post.priceValue)) {
    return formatPriceValue(post.priceValue);
  }
  return escapeHtml(post.priceText);
}

function formatPriceValue(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(3).replace(".", ",")} EUR`;
}

function postMatchesSearch(post, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }

  const searchableText = [
    post.name,
    post.address,
    post.locality,
    post.municipio,
    post.brand,
    post.fuel,
  ]
    .map((item) => normalizeText(item))
    .join(" ");

  return searchableText.includes(normalizedQuery);
}

function getTotalPages() {
  return Math.max(1, Math.ceil(state.filteredPosts.length / state.pageSize));
}

function getPaginatedPosts() {
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = startIndex + state.pageSize;
  return state.filteredPosts.slice(startIndex, endIndex);
}

function normalizeCurrentPage() {
  const totalPages = getTotalPages();
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }

  if (state.currentPage < 1) {
    state.currentPage = 1;
  }
}

function sameText(a, b) {
  return normalizeText(a) === normalizeText(b);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function animateTitleAndPanelOpen() {
  if (ui.form) {
    ui.form.classList.add("loaded");
  }
  if (ui.app) {
    ui.app.classList.add("district-active");
  }
}

function setControlsEnabled(enabled) {
  if (ui.searchInput) {
    ui.searchInput.disabled = !enabled;
  }

  if (ui.toolbarSortSelect) {
    ui.toolbarSortSelect.disabled = !enabled;
  }
}

function animateTitleAndPanelClose() {
  if (ui.form) {
    ui.form.classList.remove("loaded");
  }
  if (ui.app) {
    ui.app.classList.remove("district-active");
  }
}

function zoomMapIn() {
  animateViewBox(ui.svg, 850, 0, 580, 277);
  if (ui.mapWrapper) {
    setTimeout(() => {
      ui.mapWrapper.style.zIndex = "1";
    }, 900);
  }
}

function zoomMapOut() {
  animateViewBox(
    ui.svg,
    initialViewBoxX,
    initialViewBoxY,
    initialViewBoxWidth,
    initialViewBoxHeight,
  );
  if (ui.mapWrapper) {
    ui.mapWrapper.style.zIndex = "2";
  }
}

function animateViewBox(svg, targetX, targetY, targetWidth, targetHeight) {
  const currentViewBox = svg.viewBox.baseVal;
  const startX = currentViewBox.x;
  const startY = currentViewBox.y;
  const startWidth = currentViewBox.width;
  const startHeight = currentViewBox.height;

  const duration = 500;
  const fps = 120;
  const frameDuration = 1000 / fps;
  const totalFrames = Math.max(1, Math.ceil(duration / frameDuration));

  const deltaX = (targetX - startX) / totalFrames;
  const deltaY = (targetY - startY) / totalFrames;
  const deltaWidth = (targetWidth - startWidth) / totalFrames;
  const deltaHeight = (targetHeight - startHeight) / totalFrames;

  let frame = 0;

  function step() {
    currentViewBox.x += deltaX;
    currentViewBox.y += deltaY;
    currentViewBox.width += deltaWidth;
    currentViewBox.height += deltaHeight;

    svg.setAttribute(
      "viewBox",
      `${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`,
    );

    frame += 1;
    if (frame < totalFrames) {
      requestAnimationFrame(step);
    } else {
      svg.setAttribute(
        "viewBox",
        `${targetX} ${targetY} ${targetWidth} ${targetHeight}`,
      );
    }
  }

  step();
}

function setupCookieConsent() {
  const banner = document.getElementById("cookieBanner");
  if (!banner) return "rejected";

  const acceptButton = document.getElementById("cookieAcceptBtn");
  const rejectButton = document.getElementById("cookieRejectBtn");
  const savedConsent = localStorage.getItem(CONSENT_KEY);

  if (savedConsent) {
    banner.classList.remove("is-visible");
    return savedConsent;
  }

  banner.classList.add("is-visible");

  if (acceptButton) {
    acceptButton.addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "accepted");
      banner.classList.remove("is-visible");
      applyConsentSettings("accepted");
    });
  }

  if (rejectButton) {
    rejectButton.addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "rejected");
      banner.classList.remove("is-visible");
      applyConsentSettings("rejected");
    });
  }

  return "rejected";
}

function applyConsentSettings(status) {
  if (status === "accepted") {
    initializeAnalytics();
    initializeAdsense();
    renderAdSlot("ads");
    return;
  }

  renderAdSlot("placeholder");
}

function initializeAnalytics() {
  const measurementId = MONETIZATION_CONFIG.gaMeasurementId;
  if (!measurementId) {
    return;
  }

  if (!document.getElementById("ga4-script")) {
    const script = document.createElement("script");
    script.id = "ga4-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }

  gtag("js", new Date());
  gtag("consent", "default", {
    ad_storage: "granted",
    analytics_storage: "granted",
  });
  gtag("config", measurementId, { anonymize_ip: true });
}

function initializeAdsense() {
  const clientId = MONETIZATION_CONFIG.adsenseClientId;
  if (!clientId || document.getElementById("adsense-script")) {
    return;
  }

  const script = document.createElement("script");
  script.id = "adsense-script";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
  document.head.appendChild(script);
}

function renderAdSlot(mode) {
  if (!ui.adSlotTop) {
    return;
  }

  const clientId = MONETIZATION_CONFIG.adsenseClientId;

  if (mode === "ads" && clientId) {
    ui.adSlotTop.innerHTML = `
      <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="${escapeHtml(clientId)}"
        data-ad-slot="0000000000"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
    `;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      renderAdSlot("placeholder");
    }
    return;
  }

  ui.adSlotTop.innerHTML = `
    <span class="ad-slot-label">Publicidade</span>
    <span id="adSlotTopText">Espaco publicitario disponivel (ativa AdSense em window.PTFUEL_MONETIZATION)</span>
  `;
}

function buildAffiliateUrl(post) {
  const baseUrl = MONETIZATION_CONFIG.affiliateBaseUrl;
  if (!baseUrl) {
    return "";
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("utm_source", "ptfuel");
    url.searchParams.set("utm_medium", "affiliate");
    url.searchParams.set("utm_campaign", "postos");
    url.searchParams.set("posto", post.name || "");
    url.searchParams.set("combustivel", post.fuel || "");
    return url.toString();
  } catch (error) {
    return "";
  }
}
