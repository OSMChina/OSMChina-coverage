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
        { s: 0, r: 180, g: 0, b: 0 },    // 暗红 rgb(180, 0, 0)
        { s: 20, r: 255, g: 100, b: 0 }, // 橙色 rgb(255, 100, 0) 
        { s: 40, r: 200, g: 160, b: 0 }, // 琥珀 rgb(200, 160, 0) 
        { s: 60, r: 40, g: 140, b: 40 }, // 翠绿 rgb(40, 140, 40) 
        { s: 100, r: 0, g: 80, b: 200 }  // 亮蓝 rgb(0, 80, 200) 
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
    const base = 2.7;
    return base * (zoom - 3) / 2;
}

function renderBoundaryLink(boundary) {
    if (Number(boundary) === -1) {
        return '<span class="warning">边界不存在</span>';
    }

    return `<a href="https://www.openstreetmap.org/relation/${boundary}" target="_blank">查看边界</a>`;
}

function renderNodeLink(node, lat, lon) {
    if (Number(node) === -1) {
        return '<span class="warning">节点不存在</span>';
    }

    return `<a href="https://www.openstreetmap.org/node/${node}#map=13/${lat}/${lon}" target="_blank">查看节点</a>`;
}

function renderLatLonLink(lat, lon) {
    return `<a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=13/${lat}/${lon}" target="_blank">OSM坐标</a>`;
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
    总分：<b>${fmt1(p.score)}</b><br/>
    <br/>
    行政节点和边界：${fmt1(p.score_1)} / 20<br/>
    道路交通：${fmt1(p.score_2)} / 30<br/>
    公共和商业设施：${fmt1(p.score_3)} / 30<br/>
    建筑和土地利用：${fmt1(p.score_4)} / 20<br/>
    <br/>
    <p><b>数据来源：</b><a href="https://www.openstreetmap.org/user/Higashimado/diary/407990" target="_blank" rel="noopener noreferrer">2025 年中国大陆乡镇 OSM 要素完备度分析报告</a></p>
  `;
}

function getCheckboxFilters() {
    return {
        noNode: document.getElementById('filter-no-node').checked,
        noBoundary: document.getElementById('filter-no-boundary').checked,
        noRoad: document.getElementById('filter-no-road').checked,
        noBuilding: document.getElementById('filter-no-building').checked
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
    if (checkboxFilters.noBuilding && p.score_4 > 0) return false;

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
        'filter-no-building'
    ].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
}

loadAllCsvPoints().then(points => {
    const zoom = map.getZoom();

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
                得分：<b>${fmt1(p.score)}</b><br/>                    
                ${renderBoundaryLink(p.boundary)}｜${renderNodeLink(p.node, p.lat, p.lon)}｜${renderLatLonLink(p.lat, p.lon)}
            `).on('click', () => {
                    updateSidePanel(p);
                });

            markers.push({ marker, score: p.score, point: p });
        });

    normalizeAddresses(points);

    bindFilterEvents();
});

map.on('zoomend', () => {
    const zoom = map.getZoom();

    markers.forEach(({ marker, score }) => {
        marker.setRadius(getRadius(score, zoom));
    });
});

