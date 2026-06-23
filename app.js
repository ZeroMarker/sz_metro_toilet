const state = {
  stations: [],
  selectedLine: "全部",
  selectedStationId: null,
  markers: new Map(),
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
};

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
  const response = await fetch("data/toilets.json");
  state.stations = await response.json();
  state.selectedStationId = state.stations[0]?.id ?? null;

  renderLineFilters();
  bindEvents();
  render();
}

function bindEvents() {
  els.searchInput.addEventListener("input", render);
  els.paidAreaOnly.addEventListener("change", render);
  els.accessibleOnly.addEventListener("change", render);
  els.babyCareOnly.addEventListener("change", render);
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

    return (
      (state.selectedLine === "全部" || station.lines.includes(state.selectedLine)) &&
      (!keyword || keywordTarget.includes(keyword)) &&
      (!els.paidAreaOnly.checked || station.paidArea) &&
      (!els.accessibleOnly.checked || station.accessible) &&
      (!els.babyCareOnly.checked || station.babyCare)
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
            <span class="line-badge">${station.lines.join(" / ")}</span>
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
    card.addEventListener("click", () => selectStation(card.dataset.id, true));
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

init().catch((error) => {
  els.stationList.innerHTML = '<div class="empty-state">数据加载失败，请检查 data/toilets.json</div>';
  console.error(error);
});
