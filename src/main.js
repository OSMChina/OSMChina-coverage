import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

import { loadAllCsvPoints, normalizeAddresses } from './loadCsv';

// Map
const map = L.map('map').setView([35.0, 105.0], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Number formatting
function fmt1(value) {
    const num = Number(value);
    if (isNaN(num)) return value;
    return num.toFixed(1);
}

// Color by score
function getColor(score) {

    const stops = [
        { s: 0, r: 150, g: 40, b: 30 },   // 红 rgb(150, 40, 30)
        { s: 20, r: 210, g: 50, b: 40 },  // 红 rgb(210, 50, 40)
        { s: 50, r: 240, g: 180, b: 20 }, // 黄 rgb(240, 180, 20) 
        { s: 80, r: 40, g: 140, b: 40 },  // 绿 rgb(40, 140, 40) 
        { s: 90, r: 30, g: 110, b: 220 }, // 蓝 rgb(30, 110, 220) 
        { s: 100, r: 0, g: 80, b: 200 }   // 蓝 rgb(0, 80, 200) 
    ];

    let c1, c2;
    for (let i = 0; i < stops.length - 1; i++) {
        if (score >= stops[i].s && score <= stops[i + 1].s) {
            c1 = stops[i];
            c2 = stops[i + 1];
            break;
        }
    }

    const t = (score - c1.s) / (c2.s - c1.s);
    const r = Math.round(c1.r + t * (c2.r - c1.r));
    const g = Math.round(c1.g + t * (c2.g - c1.g));
    const b = Math.round(c1.b + t * (c2.b - c1.b));

    return `rgb(${r},${g},${b})`;
}

function getRadius(score, zoom) {
    const base = 4;
    return base * (zoom - 3) / 3;
}

function renderBoundaryLink(boundary) {
    if (Number(boundary) === -1) {
        return '<span class="warning">边界不存在</span>';
    }

    return `<a href="https://www.openstreetmap.org/relation/${boundary}" target="_blank">查看边界</a>`;
}

function renderNodeLink(node, lat, lon) {
    if (Number(node) < 0) {
        return '<span class="warning">节点不存在</span>';
    }

    return `<a href="https://www.openstreetmap.org/node/${node}#map=13/${lat}/${lon}" target="_blank">查看节点</a>`;
}

function renderLatLonLink(lat, lon) {
    return `<a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=13/${lat}/${lon}" target="_blank">OSM 坐标</a>`;
}

function renderTotalScore(p) {
  return `
    <div class="score-section">
      <div class="score-header-static">
        总分：${fmt1(p.score)} / 100
      </div>
    </div>
  `;
}

function renderScoreSection(title, score, maxScore, tableHTML) {
  return `
    <div class="score-section">
      <div class="score-header">
        <span class="score-arrow">▶</span>
        <span>${title}：${fmt1(score)} / ${maxScore}</span>
      </div>
      <div class="score-content">
        ${tableHTML}
      </div>
    </div>
  `;
}

function renderScore1Table(p) {
  const e_node = Number(p.node) === -2 ? "标记不当" : (Number(p.node) > 0 ? "存在" : (Number(p.boundary) > 0 ? "留空" : "不存在"));
  const s_node = (e_node === "存在" || e_node === "留空") ? 7 : 0;
  const s_boundary = Number(p.boundary) > 0 ? 8 : 0;
  
  return `
    <table class="score-table">
      <thead>
        <tr>
          <th>项目</th>
          <th>1 km</th>
          <th>3 km</th>
          <th>得分</th>
          <th>上限</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>行政节点</td>
          <td colspan="2">${e_node}</td>
          <td>${fmt1(s_node)}</td>
          <td>7</td>
        </tr>
        <tr>
          <td>行政边界</td>
          <td colspan="2">${s_boundary > 0 ? "存在" : "不存在"}</td>
          <td>${fmt1(s_boundary)}</td>
          <td>8</td>
        </tr>
        <tr>
          <td>其他地名/个</td>
          <td>${p.n_place_1km || 0}</td>
          <td>${p.n_place_3km || 0}</td>
          <td>${fmt1(Math.min(p.n_place_3km, 5))}</td>
          <td>5</td>
        </tr>
        <tr>
          <td>总计</td>
          <td></td>
          <td></td>
          <td>${fmt1(p.score_1)}</td>
          <td>20</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderScore2Table(p) {
  const s_road_pri = Math.min(5, (p.n_road_tru_3km + p.n_road_pri_3km + p.n_road_sec_3km) * 5);
  const s_road_ter = Math.min(5, p.n_road_ter_3km * 1);
  const s_road_res = Math.min(20 - s_road_pri - s_road_ter, p.n_road_res_1km * 0.3 + p.n_road_res_3km * 0.2);
  const s_road_typ = Math.min(4, p.n_road_typ_3km * 1);

  return `
    <table class="score-table">
      <thead>
        <tr>
          <th>项目</th>
          <th>1 km</th>
          <th>3 km</th>
          <th>得分</th>
          <th>上限</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>干线道路/条</td>
          <td>${p.n_road_tru_1km || 0}</td>
          <td>${p.n_road_tru_3km || 0}</td>
          <td rowspan="3">${fmt1(s_road_pri)}</td>
          <td rowspan="5">20</td>
        </tr>
        <tr>
          <td>主要道路/条</td>
          <td>${p.n_road_pri_1km || 0}</td>
          <td>${p.n_road_pri_3km || 0}</td>
        </tr>
        <tr>
          <td>次级道路/条</td>
          <td>${p.n_road_sec_1km || 0}</td>
          <td>${p.n_road_sec_3km || 0}</td>
        </tr>
        <tr>
          <td>三级道路/条</td>
          <td>${p.n_road_ter_1km || 0}</td>
          <td>${p.n_road_ter_3km || 0}</td>
            <td>${fmt1(s_road_ter)}</td>
        </tr>
        <tr>
          <td>小型道路/条</td>
          <td>${p.n_road_res_1km || 0}</td>
          <td>${p.n_road_res_3km || 0}</td>
            <td>${fmt1(s_road_res)}</td>
        </tr>
        <tr>
          <td>公交站/个</td>
          <td>${p.n_bus_1km || 0}</td>
          <td>${p.n_bus_3km || 0}</td>
          <td>${fmt1(p.n_bus_3km > 0 ? 2 : 0)}</td>
          <td>2</td>
        </tr>
        <tr>
          <td>停车场/个</td>
          <td>${p.n_prk_1km || 0}</td>
          <td>${p.n_prk_3km || 0}</td>
          <td>${fmt1(p.n_prk_3km > 0 ? 2 : 0)}</td>
          <td>2</td>
        </tr>
        <tr>
          <td>加油站/个</td>
          <td>${p.n_ful_1km || 0}</td>
          <td>${p.n_ful_3km || 0}</td>
          <td>${fmt1(p.n_ful_3km > 0 ? 2 : 0)}</td>
          <td>2</td>
        </tr>
        <tr>
          <td>道路类型/种</td>
          <td>${p.n_road_typ_1km || 0}</td>
          <td>${p.n_road_typ_3km || 0}</td>
          <td>${fmt1(s_road_typ)}</td>
          <td>4</td>
        </tr>
        <tr>
          <td>总计</td>
          <td></td>
          <td></td>
          <td>${fmt1(p.score_2)}</td>
          <td>30</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderScore3Table(p) {

  return `
    <table class="score-table">
      <thead>
        <tr>
          <th>项目</th>
          <th>1 km</th>
          <th>3 km</th>
          <th>得分</th>
          <th>上限</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>政府机关/个</td>
          <td>${p.n_gov_1km || 0}</td>
          <td>${p.n_gov_3km || 0}</td>
          <td>${fmt1(p.n_gov_3km > 0 ? 5 : 0)}</td>
          <td>5</td>
        </tr>
        <tr>
          <td>医院/个</td>
          <td>${p.n_hlt_1km || 0}</td>
          <td>${p.n_hlt_3km || 0}</td>
          <td>${fmt1(p.n_hlt_1km > 0 ? 5 : 0)}</td>
          <td>5</td>
        </tr>
        <tr>
          <td>学校/个</td>
          <td>${p.n_sch_1km || 0}</td>
          <td>${p.n_sch_3km || 0}</td>
          <td>${fmt1(p.n_sch_1km > 0 ? 5 : 0)}</td>
          <td>5</td>
        </tr>
        <tr>
          <td>派出所/个</td>
          <td>${p.n_plc_1km || 0}</td>
          <td>${p.n_plc_3km || 0}</td>
          <td>${fmt1(p.n_plc_1km > 0 ? 5 : 0)}</td>
          <td>5</td>
        </tr>
        <tr>
          <td>邮局/个</td>
          <td>${p.n_pst_1km || 0}</td>
          <td>${p.n_pst_3km || 0}</td>
          <td>${fmt1(p.n_pst_1km > 0 ? 2 : 0)}</td>
          <td>2</td>
        </tr>
        <tr>
          <td>银行/个</td>
          <td>${p.n_bnk_1km || 0}</td>
          <td>${p.n_bnk_3km || 0}</td>
          <td>${fmt1(p.n_bnk_1km > 0 ? 2 : 0)}</td>
          <td>2</td>
        </tr>
        <tr>
          <td>生活消费设施/个</td>
          <td>${p.n_shp_1km || 0}</td>
          <td>${p.n_shp_3km || 0}</td>
          <td>${fmt1(Math.min(p.n_shp_1km, 6))}</td>
          <td>6</td>
        </tr>
        <tr>
          <td>总计</td>
          <td></td>
          <td></td>
          <td>${fmt1(p.score_3)}</td>
          <td>30</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderScore4Table(p) {
  const s_building = Math.min(12, (p.n_bul_3km + p.n_bul_1km) * 0.1);
  const s_land_typ = Math.min(8, p.n_land_typ_3km * 1);

  return `
    <table class="score-table">
      <thead>
        <tr>
          <th>项目</th>
          <th>1 km</th>
          <th>3 km</th>
          <th>得分</th>
          <th>上限</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>建筑或人造物/个</td>
          <td>${p.n_bul_1km || 0}</td>
          <td>${p.n_bul_3km || 0}</td>
          <td>${fmt1(s_building)}</td>
          <td>12</td>
        </tr>
        <tr>
          <td>土地利用类型/种</td>
          <td>${p.n_land_typ_1km || 0}</td>
          <td>${p.n_land_typ_3km || 0}</td>
          <td>${fmt1(s_land_typ)}</td>
          <td>8</td>
        </tr>
        <tr>
          <td>总计</td>
          <td></td>
          <td></td>
          <td>${fmt1(p.score_4)}</td>
          <td>20</td>
        </tr>
      </tbody>
    </table>
  `;
}

function bindAccordion() {
  document.querySelectorAll('.score-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.parentElement;
      section.classList.toggle('expanded');
    });
  });
}

function updateSidePanel(p) {
  const panel = document.getElementById('panel-content');

  panel.innerHTML = `

    <h2>${p.addr2 || ''}${p.addr3 || ''}${p.addr4 || ''}</h2>
    ${renderBoundaryLink(p.boundary)}
    ｜ 
    ${renderNodeLink(p.node)}
    ｜
    ${renderLatLonLink(p.lat, p.lon)}
    <br/><br/>

    ${renderTotalScore(p)}

    ${renderScoreSection(
      "行政节点和边界",
      p.score_1,
      20,
      renderScore1Table(p)
    )}

    ${renderScoreSection(
      "道路交通",
      p.score_2,
      30,
      renderScore2Table(p)
    )}

    ${renderScoreSection(
      "公共和商业设施",
      p.score_3,
      30,
      renderScore3Table(p)
    )}

    ${renderScoreSection(
      "建筑和土地利用",
      p.score_4,
      20,
      renderScore4Table(p)
    )}

    <p><b>数据来源：</b>
      <a href="https://www.openstreetmap.org/user/Higashimado/diary/407990"
         target="_blank" rel="noopener noreferrer">
         2025 年中国大陆乡镇 OSM 要素完备度分析报告
      </a>
    </p>
  `;

  bindAccordion();
}

function getCheckboxFilters() {
    return {
        noNode: document.getElementById('filter-no-node').checked,
        noBoundary: document.getElementById('filter-no-boundary').checked,
        noRoad: document.getElementById('filter-no-road').checked,
        noBuilding: document.getElementById('filter-no-building').checked,
        noGov: document.getElementById('filter-no-gov').checked,
        noShop: document.getElementById('filter-no-shop').checked,
        noSchool: document.getElementById('filter-no-school').checked,
        noHealth: document.getElementById('filter-no-health').checked,
    };
}

const markers = [];

function getScoreFilterValues() {
    const ranges = [0, 1, 2, 3, 4].map((i) => {
        const minEl = document.getElementById(`score${i}-min`);
        const maxEl = document.getElementById(`score${i}-max`);
        const minText = document.getElementById(`score${i}-min-text`);
        const maxText = document.getElementById(`score${i}-max-text`);
        const slider = document.getElementById(`score${i}-slider`);
        const sliderTrack = slider.querySelector('.slider-track');
        const sliderMax = Number(minEl.max) || 100;

        let min = Number(minEl.value);
        let max = Number(maxEl.value);

        if (min > max) {
            const tmp = min;
            min = max;
            max = tmp;
            minEl.value = String(min);
            maxEl.value = String(max);
        }

        minText.textContent = String(min);
        maxText.textContent = String(max);

        const minPercent = (min / sliderMax) * 100;
        const maxPercent = (max / sliderMax) * 100;
        sliderTrack.style.background = `linear-gradient(to right, #dadae5 ${minPercent}% , #3264fe ${minPercent}% , #3264fe ${maxPercent}%, #dadae5 ${maxPercent}%)`;

        return { min, max };
    });

    return {
        score0: ranges[0],
        score1: ranges[1],
        score2: ranges[2],
        score3: ranges[3],
        score4: ranges[4],
    };
}

function matchesFilters(p, filters, checkboxFilters) {

    const scoreMatch =
        p.score >= filters.score0.min && p.score <= filters.score0.max &&
        p.score_1 >= filters.score1.min && p.score_1 <= filters.score1.max &&
        p.score_2 >= filters.score2.min && p.score_2 <= filters.score2.max &&
        p.score_3 >= filters.score3.min && p.score_3 <= filters.score3.max &&
        p.score_4 >= filters.score4.min && p.score_4 <= filters.score4.max;

    if (!scoreMatch) return false;

    if (checkboxFilters.noNode && Number(p.node) !== -1) return false;
    if (checkboxFilters.noBoundary && Number(p.boundary) !== -1) return false;
    if (checkboxFilters.noRoad && p.score_2 > 0) return false;
    if (checkboxFilters.noGov && p.n_gov_3km > 0) return false;
    if (checkboxFilters.noShop && p.n_shp_1km > 0) return false;
    if (checkboxFilters.noBuilding && p.n_bul_3km > 0) return false;
    if (checkboxFilters.noSchool && p.n_sch_1km > 0) return false;
    if (checkboxFilters.noHealth && p.n_hlt_1km > 0) return false;

    return true;
}

function applyFilters() {
    const filters = getScoreFilterValues();
    const checkboxFilters = getCheckboxFilters();

    markers.forEach(({ marker, point }) => {
        const visible = matchesFilters(point, filters, checkboxFilters);
        const isOnMap = map.hasLayer(marker);

        if (visible && !isOnMap) {
            marker.addTo(map);
        } else if (!visible && isOnMap) {
            marker.removeFrom(map);
        }
    });
}

function bindFilterEvents() {
    [0, 1, 2, 3, 4].forEach((i) => {
        const minEl = document.getElementById(`score${i}-min`);
        const maxEl = document.getElementById(`score${i}-max`);
        const setActive = (activeEl, otherEl) => {
            activeEl.classList.add('thumb-active');
            otherEl.classList.remove('thumb-active');
        };

        minEl.addEventListener('input', applyFilters);
        maxEl.addEventListener('input', applyFilters);

        minEl.addEventListener('pointerdown', () => setActive(minEl, maxEl));
        maxEl.addEventListener('pointerdown', () => setActive(maxEl, minEl));
        minEl.addEventListener('touchstart', () => setActive(minEl, maxEl), { passive: true });
        maxEl.addEventListener('touchstart', () => setActive(maxEl, minEl), { passive: true });
    });

    ['filter-no-node',
        'filter-no-boundary',
        'filter-no-road',
        'filter-no-building',
        'filter-no-gov',
        'filter-no-shop',
        'filter-no-school',
        'filter-no-health'
    ].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
}

loadAllCsvPoints().then(points => {
    const zoom = map.getZoom();

    normalizeAddresses(points);

    points
        .sort((a, b) => a.score - b.score) // high score on top
        .forEach(p => {
            const marker = L.circleMarker([p.lat, p.lon], {
                radius: getRadius(p.score, zoom),
                fillColor: getColor(p.score),
                fillOpacity: 0.9,
                stroke: true,
                color: getColor(p.score),
                weight: 0.6,
                opacity: 1
            })
                .addTo(map)
                .bindPopup(`
                <b>${p.addr2}${p.addr3}${p.addr4}</b><br/>   
                <b>总分：${fmt1(p.score)}</b><br/>                    
                ${renderBoundaryLink(p.boundary)}｜${renderNodeLink(p.node, p.lat, p.lon)}｜${renderLatLonLink(p.lat, p.lon)}
            `).on('click', () => {
                    updateSidePanel(p);
                });

            markers.push({ marker, score: p.score, point: p });
        });

    bindFilterEvents();
});

map.on('zoomend', () => {
    const zoom = map.getZoom();

    markers.forEach(({ marker, score }) => {
        marker.setRadius(getRadius(score, zoom));
    });
});

