const API_URL =
  "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PesquisarPostos?idsTiposComb=1120%2C3400%2C3205%2C3405%2C3201%2C2105%2C2101&idMarca=&idTipoPosto=&idDistrito=&idsMunicipios=&qtdPorPagina=11713";
const DB_NAME = "meuBancoDeDados";
const STORE_NAME = "meusDados";
const CACHE_KEY = "output";

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
};

const ui = {};
let lastClickedElement = null;

document.addEventListener("DOMContentLoaded", () => {
  cacheDomElements();
  bindStaticEvents();
  startDataLoad();
});

function cacheDomElements() {
  ui.title = document.querySelector(".title");
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
  ui.priceSummary = document.getElementById("precoMedio");
  ui.sortBox = document.getElementById("boxx");
  ui.sortSelect = ui.sortBox ? ui.sortBox.querySelector("select") : null;
}

function bindStaticEvents() {
  const districtPaths = document.querySelectorAll("#meuSVG path[id]");
  districtPaths.forEach((pathElement) => {
    pathElement.addEventListener("click", onDistrictClick);
  });

  if (ui.sortSelect) {
    ui.sortSelect.addEventListener("change", (event) => {
      state.sortOrder = event.target.value === "Price: High to Low" ? "desc" : "asc";
      refreshFilteredView();
    });
  }
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

  const normalized = String(value).replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function onDistrictClick(event) {
  const districtName = event.target.getAttribute("id") || "";
  if (!districtName) {
    return;
  }

  const isSamePath = lastClickedElement === event.target;
  const isMapExpanded =
    ui.svg.getAttribute("viewBox") !==
    `${initialViewBoxX} ${initialViewBoxY} ${initialViewBoxWidth} ${initialViewBoxHeight}`;

  if (isSamePath && isMapExpanded) {
    resetMapAndPanel(event.target);
    return;
  }

  focusDistrict(event.target, districtName);
}

function focusDistrict(pathElement, districtName) {
  animateTitleAndPanelOpen();
  zoomMapIn();
  highlightDistrict(pathElement);

  state.selectedDistrict = districtName;
  state.selectedMunicipio = "";
  state.selectedFuel = "";
  state.selectedBrand = "";

  ui.cityTitle.textContent = districtName;
  ui.municipiosTitle.textContent = "Cities";
  ui.fuelsTitle.textContent = "Fuel Type(s)";
  ui.brandTitle.textContent = "Brand";

  state.districtPosts = state.allPosts.filter((post) =>
    sameText(post.district, districtName)
  );

  refreshFilteredView();
}

function resetMapAndPanel(pathElement) {
  animateTitleAndPanelClose();
  zoomMapOut();

  state.selectedDistrict = "";
  state.selectedMunicipio = "";
  state.selectedFuel = "";
  state.selectedBrand = "";
  state.districtPosts = [];
  state.filteredPosts = [];

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
}

function refreshFilteredView() {
  if (!state.selectedDistrict) {
    return;
  }

  const filtered = state.districtPosts.filter((post) => {
    const municipioMatch =
      !state.selectedMunicipio || sameText(post.municipio, state.selectedMunicipio);
    const fuelMatch = !state.selectedFuel || sameText(post.fuel, state.selectedFuel);
    const brandMatch = !state.selectedBrand || sameText(post.brand, state.selectedBrand);
    return municipioMatch && fuelMatch && brandMatch;
  });

  filtered.sort((a, b) => {
    const valueA = Number.isFinite(a.priceValue) ? a.priceValue : Number.POSITIVE_INFINITY;
    const valueB = Number.isFinite(b.priceValue) ? b.priceValue : Number.POSITIVE_INFINITY;
    return state.sortOrder === "desc" ? valueB - valueA : valueA - valueB;
  });

  state.filteredPosts = filtered;
  renderFilterGroups();
  renderPosts();
  renderSummary();

  if (ui.sortBox) {
    ui.sortBox.style.display = "flex";
  }
}

function renderFilterGroups() {
  const fuelsBase = state.districtPosts.filter((post) => {
    return !state.selectedMunicipio || sameText(post.municipio, state.selectedMunicipio);
  });

  const brandsBase = fuelsBase.filter((post) => {
    return !state.selectedFuel || sameText(post.fuel, state.selectedFuel);
  });

  const municipios = buildGroupedOptions(state.districtPosts, "municipio");
  const fuels = buildGroupedOptions(fuelsBase, "fuel");
  const brands = buildGroupedOptions(brandsBase, "brand");

  renderFilterButtons({
    container: ui.municipiosContainer,
    options: municipios,
    selectedValue: state.selectedMunicipio,
    allLabel: "All cities",
    onClick: (value) => {
      state.selectedMunicipio = value;
      state.selectedFuel = "";
      state.selectedBrand = "";
      refreshFilteredView();
    },
  });

  renderFilterButtons({
    container: ui.fuelContainer,
    options: fuels,
    selectedValue: state.selectedFuel,
    allLabel: "All fuel types",
    onClick: (value) => {
      state.selectedFuel = value;
      state.selectedBrand = "";
      refreshFilteredView();
    },
  });

  renderFilterButtons({
    container: ui.brandContainer,
    options: brands,
    selectedValue: state.selectedBrand,
    allLabel: "All brands",
    onClick: (value) => {
      state.selectedBrand = value;
      refreshFilteredView();
    },
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

function renderFilterButtons({ container, options, selectedValue, allLabel, onClick }) {
  container.innerHTML = "";

  const allButton = createFilterButton(`${allLabel} (${state.districtPosts.length})`, !selectedValue);
  allButton.addEventListener("click", () => onClick(""));
  container.appendChild(allButton);

  options.forEach((option) => {
    const isActive = sameText(option.value, selectedValue);
    const button = createFilterButton(`${option.value} (${option.count})`, isActive);
    button.addEventListener("click", () => onClick(option.value));
    container.appendChild(button);
  });
}

function createFilterButton(text, isActive) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.className = isActive ? "municipio-button-active" : "municipio-button";
  return button;
}

function renderPosts() {
  ui.info.innerHTML = "";

  if (!state.filteredPosts.length) {
    ui.info.innerHTML = '<p class="no-results">Sem resultados para os filtros selecionados.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  state.filteredPosts.forEach((post) => {
    const card = document.createElement("article");
    card.className = "posto-info";

    const mapsUrl =
      Number.isFinite(post.latitude) && Number.isFinite(post.longitude)
        ? `https://www.google.com/maps?q=${post.latitude},${post.longitude}`
        : "";

    card.innerHTML = `
      <h3>${escapeHtml(post.name)}</h3>
      <p><strong>Preco:</strong> ${formatPrice(post)}</p>
      <p><strong>Combustivel:</strong> ${escapeHtml(post.fuel)}</p>
      <p><strong>Marca:</strong> ${escapeHtml(post.brand)}</p>
      <p><strong>Municipio:</strong> ${escapeHtml(post.municipio)}</p>
      <p><strong>Morada:</strong> ${escapeHtml(post.address)}</p>
      <p><strong>Atualizacao:</strong> ${escapeHtml(post.updatedAt || "N/A")}</p>
      ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noreferrer">Ver no mapa</a>` : ""}
    `;

    fragment.appendChild(card);
  });

  ui.info.appendChild(fragment);
}

function renderSummary() {
  ui.priceSummary.innerHTML = "";

  if (!state.filteredPosts.length) {
    ui.priceSummary.innerHTML = '<p class="summary-title">No data</p>';
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
    <p class="summary-title">Distrito: ${escapeHtml(state.selectedDistrict)}</p>
    <p class="summary-item">Postos visiveis: <strong>${state.filteredPosts.length}</strong></p>
    <p class="summary-item">Preco medio: <strong>${formatPriceValue(avgPrice)}</strong></p>
    <p class="summary-item">Preco minimo: <strong>${formatPriceValue(minPrice)}</strong></p>
    <p class="summary-item">Preco maximo: <strong>${formatPriceValue(maxPrice)}</strong></p>
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
  if (ui.title) {
    ui.title.style.animation = "ir forwards ease-in-out 0.5s";
  }

  if (ui.form) {
    ui.form.style.display = "block";
    ui.form.style.animation = "voltar2 forwards ease-in-out 1s";
  }
}

function animateTitleAndPanelClose() {
  if (ui.title) {
    ui.title.style.removeProperty("animation");
    ui.title.style.animation = "voltar forwards ease-in-out 1.5s";
  }

  if (ui.form) {
    ui.form.style.removeProperty("animation");
    ui.form.style.animation = "ir2 forwards ease-in-out 1s";
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
  animateViewBox(ui.svg, initialViewBoxX, initialViewBoxY, initialViewBoxWidth, initialViewBoxHeight);
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
      `${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`
    );

    frame += 1;
    if (frame < totalFrames) {
      requestAnimationFrame(step);
    } else {
      svg.setAttribute("viewBox", `${targetX} ${targetY} ${targetWidth} ${targetHeight}`);
    }
  }

  step();
}

