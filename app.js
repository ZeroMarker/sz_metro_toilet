const state = {
  stations: [],
  selectedLine: "全部",
  selectedStationId: null,
  markers: new Map(),
  isLoading: true,
  favorites: JSON.parse(localStorage.getItem("favorites") || "[]"),
  userLocation: null,
};

const els = {
  searchInput: document.querySelector("#searchInput"),
  lineFilters: document.querySelector("#lineFilters"),
  paidAreaOnly: document.querySelector("#paidAreaOnly"),
  accessibleOnly: document.querySelector("#accessibleOnly"),
  babyCareOnly: document.querySelector("#babyCareOnly"),
  resultCount: document.querySelector("#resultCount"),
  stationList: document.querySelector("#stationList"),
  detailCard: document.querySelector("#detailCard"),
  loadingState: document.querySelector("#loadingState"),
  locateBtn: document.querySelector("#locateBtn"),
  showFavOnly: document.querySelector("#showFavOnly"),
};

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function toggleFavorite(id) {
  const idx = state.favorites.indexOf(id);
  if (idx === -1) {
    state.favorites.push(id);
  } else {
    state.favorites.splice(idx, 1);
  }
  localStorage.setItem("favorites", JSON.stringify(state.favorites));
  render();
}

const map = L.map("map", {
  zoomControl: false,
}).setView([22.5431, 114.0579], 11);

L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

const markerIcon = L.divIcon({
  className: "",
  html: '<div class="toilet-marker">厕</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

async function init() {
  try {
    const response = await fetch("data/toilets.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.stations = await response.json();
    state.selectedStationId = state.stations[0]?.id ?? null;
  } catch (error) {
    els.stationList.innerHTML = '<div class="empty-state">数据加载失败，请检查 data/toilets.json</div>';
    console.error(error);
    return;
  } finally {
    state.isLoading = false;
    if (els.loadingState) els.loadingState.style.display = "none";
  }

  renderLineFilters();
  bindEvents();
  render();
}

function bindEvents() {
  const debouncedRender = debounce(render, 250);
  els.searchInput.addEventListener("input", debouncedRender);
  els.paidAreaOnly.addEventListener("change", render);
  els.accessibleOnly.addEventListener("change", render);
  els.babyCareOnly.addEventListener("change", render);

  if (els.locateBtn) {
    els.locateBtn.addEventListener("click", locateUser);
  }
  if (els.showFavOnly) {
    els.showFavOnly.addEventListener("change", render);
  }
}

function renderLineFilters() {
  const lines = ["全部", ...new Set(state.stations.flatMap((station) => station.lines))];

  els.lineFilters.innerHTML = lines
    .map(
      (line) => `
        <button class="line-chip${line === state.selectedLine ? " is-active" : ""}" type="button" data-line="${line}">
          ${line}
        </button>
      `,
    )
    .join("");

  els.lineFilters.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedLine = button.dataset.line;
      renderLineFilters();
      render();
    });
  });
}

function getFilteredStations() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const showFavOnly = els.showFavOnly?.checked;

  return state.stations.filter((station) => {
    const keywordTarget = [
      station.name,
      station.lines.join(" "),
      station.location,
      station.exit,
      station.note,
    ]
      .join(" ")
      .toLowerCase();

    const keywordChars = keyword.split("");
    const fuzzyMatch = keywordChars.every((char) => keywordTarget.includes(char));

    return (
      (state.selectedLine === "全部" || station.lines.includes(state.selectedLine)) &&
      (!keyword || fuzzyMatch) &&
      (!els.paidAreaOnly.checked || station.paidArea) &&
      (!els.accessibleOnly.checked || station.accessible) &&
      (!els.babyCareOnly.checked || station.babyCare) &&
      (!showFavOnly || state.favorites.includes(station.id))
    );
  });
}

function render() {
  const stations = getFilteredStations();

  if (!stations.some((station) => station.id === state.selectedStationId)) {
    state.selectedStationId = stations[0]?.id ?? null;
  }

  els.resultCount.textContent = String(stations.length);
  renderStationList(stations);
  renderMarkers(stations);
  renderDetail();
}

function renderStationList(stations) {
  if (stations.length === 0) {
    els.stationList.innerHTML = '<div class="empty-state">没有找到匹配站点</div>';
    return;
  }

  els.stationList.innerHTML = stations
    .map(
      (station) => `
        <button class="station-card${station.id === state.selectedStationId ? " is-selected" : ""}" type="button" data-id="${station.id}">
          <div class="station-title">
            <span class="station-name">${station.name}</span>
            <div class="station-actions">
              <span class="line-badge">${station.lines.join(" / ")}</span>
              <button class="fav-btn${state.favorites.includes(station.id) ? " is-fav" : ""}" data-fav="${station.id}" title="收藏">
                ${state.favorites.includes(station.id) ? "★" : "☆"}
              </button>
            </div>
          </div>
          <p class="station-location">${station.location}</p>
          <div class="tag-row">
            <span class="tag">${station.paidArea ? "站内" : "站外/非付费区"}</span>
            ${station.accessible ? '<span class="tag green">无障碍</span>' : ""}
            ${station.babyCare ? '<span class="tag green">母婴室</span>' : ""}
          </div>
        </button>
      `,
    )
    .join("");

  els.stationList.querySelectorAll(".station-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (!e.target.closest(".fav-btn")) {
        selectStation(card.dataset.id, true);
      }
    });
  });

  els.stationList.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.fav);
    });
  });
}

function renderMarkers(stations) {
  state.markers.forEach((marker) => marker.remove());
  state.markers.clear();

  stations.forEach((station) => {
    const marker = L.marker([station.lat, station.lng], { icon: markerIcon })
      .addTo(map)
      .on("click", () => selectStation(station.id, false));

    state.markers.set(station.id, marker);
  });

  if (stations.length > 0) {
    const bounds = L.latLngBounds(stations.map((station) => [station.lat, station.lng]));
    map.fitBounds(bounds.pad(0.18), { maxZoom: 14 });
  }
}

function renderDetail() {
  const station = state.stations.find((item) => item.id === state.selectedStationId);

  if (!station) {
    els.detailCard.innerHTML = "";
    return;
  }

  els.detailCard.innerHTML = `
    <h2>${station.name}</h2>
    <div class="tag-row">
      ${station.lines.map((line) => `<span class="tag">${line}</span>`).join("")}
      <span class="tag">${station.paidArea ? "站内厕所" : "非付费区厕所"}</span>
      ${station.accessible ? '<span class="tag green">无障碍厕所</span>' : ""}
      ${station.babyCare ? '<span class="tag green">母婴室</span>' : ""}
    </div>
    <p><strong>位置：</strong>${station.location}</p>
    <p><strong>临近出口：</strong>${station.exit}</p>
    <p><strong>备注：</strong>${station.note}</p>
    <p><strong>更新时间：</strong>${station.updatedAt}</p>
  `;
}

function selectStation(id, panToMarker) {
  state.selectedStationId = id;
  const station = state.stations.find((item) => item.id === id);

  if (station && panToMarker) {
    map.setView([station.lat, station.lng], Math.max(map.getZoom(), 14));
  }

  render();
}

function locateUser() {
  if (!navigator.geolocation) {
    alert("浏览器不支持定位功能");
    return;
  }

  if (els.locateBtn) els.locateBtn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (els.locateBtn) {
        els.locateBtn.disabled = false;
        els.locateBtn.textContent = "已定位";
      }
      sortStationsByDistance();
      render();
    },
    (err) => {
      if (els.locateBtn) els.locateBtn.disabled = false;
      alert("定位失败：" + err.message);
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sortStationsByDistance() {
  if (!state.userLocation) return;

  state.stations.sort((a, b) => {
    const distA = getDistance(state.userLocation.lat, state.userLocation.lng, a.lat, a.lng);
    const distB = getDistance(state.userLocation.lat, state.userLocation.lng, b.lat, b.lng);
    return distA - distB;
  });
}

init();
