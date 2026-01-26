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

const markers = [];

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
          <a href="https://www.openstreetmap.org/relation/${p.boundary}" target="_blank">查看边界</a>｜<a href="https://www.openstreetmap.org/node/${p.node}" target="_blank">查看节点</a>
        `);

            markers.push({ marker, score: p.score });
        });
});

map.on('zoomend', () => {
    const zoom = map.getZoom();

    markers.forEach(({ marker, score }) => {
        marker.setRadius(getRadius(score, zoom));
    });
});

