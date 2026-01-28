import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

import { loadAllCsvPoints } from './loadCsv';

// Map
const map = L.map('map').setView([35.0, 105.0], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Color by score
function getColor(score) {
    // Clamp score
    const s = Math.max(0, Math.min(100, score));

    // Define anchor colors
    const red = [255, 0, 0];
    const yellow = [255, 255, 0];
    const green = [0, 255, 0];

    let c1, c2, t;

    if (s <= 20) {
        return 'rgb(255,0,0)';
    }

    if (s >= 80) {
        return 'rgb(0,255,0)';
    }

    if (s <= 50) {
        // red -> yellow
        c1 = red;
        c2 = yellow;
        t = (s - 20) / (50 - 20);
    } else {
        // yellow -> green
        c1 = yellow;
        c2 = green;
        t = (s - 50) / (80 - 50);
    }

    const r = Math.round(c1[0] + t * (c2[0] - c1[0]));
    const g = Math.round(c1[1] + t * (c2[1] - c1[1]));
    const b = Math.round(c1[2] + t * (c2[2] - c1[2]));

    return `rgb(${r},${g},${b})`;
}

function getRadius(score, zoom) {
    const base = 1.5 ;
    return base * (zoom - 3) / 2;
}

function renderBoundaryLink(boundary) {
    if (Number(boundary) === -1) {
        return '<span class="warning">边界不存在</span>';
    }

    return `<a href="https://www.openstreetmap.org/relation/${boundary}" target="_blank">查看边界</a>`;
}

function renderNodeLink(node) {
    if (Number(node) === -1) {
        return '<span class="warning">节点不存在</span>';
    }

    return `<a href="https://www.openstreetmap.org/node/${node}" target="_blank">查看节点</a>`;
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
            总分：<b>${p.score}</b>
    <br/>
    <br/>
    行政节点和边界：${p.score_1} / 20<br/>
    道路交通：${p.score_2} / 30<br/>
    公共和商业设施：${p.score_3} / 30<br/>
    建筑和土地利用：${p.score_4} / 20
    <br/>
    <p>数据来源：<a href="https://www.openstreetmap.org/user/Higashimado/diary/407990" target="_blank" rel="noopener noreferrer">2025 年中国大陆乡镇 OSM 要素完备度分析报告</a></p>
  `;
}


const markers = [];

function getScoreFilterValues() {
    const ranges = [1, 2, 3, 4].map((i) => {
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
        score1: ranges[0],
        score2: ranges[1],
        score3: ranges[2],
        score4: ranges[3],
    };
}

function matchesFilters(p, filters) {
    return (
        p.score_1 >= filters.score1.min && p.score_1 <= filters.score1.max &&
        p.score_2 >= filters.score2.min && p.score_2 <= filters.score2.max &&
        p.score_3 >= filters.score3.min && p.score_3 <= filters.score3.max &&
        p.score_4 >= filters.score4.min && p.score_4 <= filters.score4.max
    );
}

function applyFilters() {
    const filters = getScoreFilterValues();

    markers.forEach(({ marker, point }) => {
        const visible = matchesFilters(point, filters);
        const isOnMap = map.hasLayer(marker);

        if (visible && !isOnMap) {
            marker.addTo(map);
        } else if (!visible && isOnMap) {
            marker.removeFrom(map);
        }
    });
}

function bindFilterEvents() {
    [1, 2, 3, 4].forEach((i) => {
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

    applyFilters();
}

loadAllCsvPoints().then(points => {
    const zoom = map.getZoom();

    points
        .sort((a, b) => b.score - a.score) // low score on top
        .forEach(p => {
            const marker = L.circleMarker([p.lat, p.lon], {
                radius: getRadius(p.score, zoom),
                fillColor: getColor(p.score),
                stroke: false,
                fillOpacity: 0.8,
            })
                .addTo(map)
                .bindPopup(`
          <b>${p.addr2}${p.addr3}${p.addr4}</b><br/>   
          得分：<b>${p.score}</b><br/>   
                    ${renderBoundaryLink(p.boundary)}｜${renderNodeLink(p.node)}｜${renderLatLonLink(p.lat, p.lon)}
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

