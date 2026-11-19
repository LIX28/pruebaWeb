'use strict';
/* ====== CONFIG ====== */
const ROTATE_MS = 6000;

let DATA = { categorias: [], etiquetasColores: {}, pois: [] };
const $ = (s, r = document) => r.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const catObj = id => DATA.categorias.find(c => c.id === id);
const catName = id => catObj(id)?.nombre ?? id;
const catColor = id => catObj(id)?.color ?? '#C8102E';
const tagColor = (tag, fallbackCatId) => DATA.etiquetasColores?.[tag] || catColor(fallbackCatId);
const linkify = t => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">receta/enlace</a>');

/* ====== Datos ====== */
async function init() {
  try {
    DATA = await (await fetch('data.json')).json();
  } catch (e) {
    document.body.insertAdjacentHTML('afterbegin', '<p style="padding:5rem 1rem">No se pudo cargar data.json. Sirve el sitio con un servidor local o GitHub Pages.</p>');
    return;
  }
  initHomeFilterAndRotator();
  renderSecciones();
  initPlan();
  route();
}

/* ====== Tarjeta ====== */
function card(p, withMore = true, highlightColor = null) {
  const cColor = highlightColor || catColor(p.categoria);
  const imgs = (p.imagenes || []).map(s => `<img src="${esc(s)}" alt="${esc(p.nombre)}" loading="lazy" onerror="this.remove()">`).join('');
  const osmUrl = `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=16/${p.lat}/${p.lng}`;
  const tagsHtml = [
    `<span class="tag" style="--pill-color:${esc(catColor(p.categoria))}">${esc(catName(p.categoria))}</span>`,
    ...(p.etiquetas || []).map(t => `<span class="tag" style="--pill-color:${esc(tagColor(t, p.categoria))}">${esc(t)}</span>`)
  ].join('');

  return `<article class="card" style="--card-color:${esc(cColor)}">
    ${imgs ? `<div class="imgs">${imgs}</div>` : ''}
    <div class="body">
      <div class="tags">${tagsHtml}</div>
      <h3>${esc(p.nombre)}</h3>
      ${p.cuando ? `<div class="when">${esc(p.cuando)}${p.repite ? ' · ' + esc(p.repite) : ''}</div>` : ''}
      <p class="desc">${linkify(p.descripcion)}</p>
      ${withMore ? '<button class="more" type="button">Ver más</button>' : ''}
      <div class="links"><a href="${osmUrl}" target="_blank" rel="noopener">Ver en mapa</a>${p.web ? `<a href="${esc(p.web)}" target="_blank" rel="noopener">Web oficial</a>` : ''}</div>
    </div></article>`;
}

document.addEventListener('click', e => {
  if (e.target.matches('.more')) {
    const d = e.target.previousElementSibling;
    const o = d.classList.toggle('open');
    e.target.textContent = o ? 'Ver menos' : 'Ver más';
  }
});

/* ====== Inicio: Etiquetas activas solo si hay POIs, rotación aleatoria y color ====== */
function getAvailableFilters() {
  if (!DATA.pois || DATA.pois.length === 0) return [];
  const map = new Map();

  DATA.pois.forEach(p => {
    const c = catObj(p.categoria);
    if (c && !map.has(`cat:${c.id}`)) {
      map.set(`cat:${c.id}`, {
        label: c.nombre,
        color: c.color || '#C8102E',
        filterFn: item => item.categoria === c.id
      });
    }
    (p.etiquetas || []).forEach(tag => {
      const key = `tag:${tag}`;
      if (!map.has(key)) {
        map.set(key, {
          label: tag,
          color: tagColor(tag, p.categoria),
          filterFn: item => (item.etiquetas || []).includes(tag)
        });
      }
    });
  });

  return Array.from(map.values());
}

function initHomeFilterAndRotator() {
  const wrap = $('#inicio-pois-wrap');
  const el = $('#rot');
  const previews = $('#previews');
  const filters = getAvailableFilters();

  if (!filters.length) {
    wrap.hidden = true;
    wrap.innerHTML = '';
    return;
  }

  wrap.hidden = false;
  let currentIdx = -1;

  const applyFilter = (idx) => {
    currentIdx = idx;
    const f = filters[idx];
    el.textContent = f.label.toLowerCase();
    el.style.setProperty('--tag-color', f.color);

    const matchingPois = DATA.pois.filter(f.filterFn).slice(0, 4);
    previews.innerHTML = `<div class="prev" style="--tag-color:${esc(f.color)}">
      <h3>${esc(f.label)}</h3>
      <div class="rail">${matchingPois.map(p => card(p, false, f.color)).join('')}</div>
    </div>`;
  };

  const pickRandomIndex = () => {
    if (filters.length === 1) return 0;
    let next;
    do {
      next = Math.floor(Math.random() * filters.length);
    } while (next === currentIdx);
    return next;
  };

  applyFilter(pickRandomIndex());

  if (filters.length > 1) {
    setInterval(() => {
      el.classList.add('out');
      setTimeout(() => {
        applyFilter(pickRandomIndex());
        el.classList.remove('out');
      }, 400);
    }, ROTATE_MS);
  }
}

/* ====== Conoce República Dominicana ====== */
function renderSecciones() {
  if (!DATA.pois || DATA.pois.length === 0) {
    $('#secciones').innerHTML = '';
    return;
  }
  $('#secciones').innerHTML = DATA.categorias.map(c => {
    const l = DATA.pois.filter(p => p.categoria === c.id);
    if (!l.length) return '';
    return `<section class="sec" id="${c.seccion}" style="--cat-color:${esc(c.color || '#C8102E')}">
      <h2>${esc(c.nombre)}</h2>
      <div class="grid">${l.map((p, i) => i < 3 ? card(p) : card(p).replace('<article', '<article hidden data-extra')).join('')}</div>
      ${l.length > 3 ? '<button class="btn alt show-more">Ver más</button>' : ''}
    </section>`;
  }).join('');

  $('#secciones').addEventListener('click', e => {
    if (!e.target.matches('.show-more')) return;
    const sec = e.target.closest('.sec');
    const hid = sec.querySelectorAll('[data-extra]');
    const open = e.target.dataset.open !== '1';
    hid.forEach(h => h.hidden = !open);
    e.target.dataset.open = open ? '1' : '';
    e.target.textContent = open ? 'Ver menos' : 'Ver más';
  });
}

/* ====== Planifica (Leaflet + OpenStreetMap) ====== */
let map, routeLayer, markers = {}, selected = new Set(), activeTags = new Set(), mapsReady = false;

function initPlan() {
  const usedCats = DATA.categorias.filter(c => DATA.pois.some(p => p.categoria === c.id));
  $('#chips').innerHTML = usedCats.map(c => `<button class="chip" data-c="${c.id}">${esc(c.nombre)}</button>`).join('');
  $('#chips').addEventListener('click', e => {
    if (!e.target.matches('.chip')) return;
    const c = e.target.dataset.c;
    activeTags.has(c) ? activeTags.delete(c) : activeTags.add(c);
    e.target.classList.toggle('on');
    renderLista();
  });
  $('#q').addEventListener('input', renderLista);
  $('#auto').onclick = () => {
    if (!activeTags.size) return alert('Elige al menos una etiqueta.');
    DATA.pois.filter(p => activeTags.has(p.categoria)).forEach(p => selected.add(p.id));
    renderLista();
    drawRoute();
  };
  $('#ruta').onclick = drawRoute;
  renderLista();
  loadMaps();
}

function filtered() {
  const q = $('#q').value.toLowerCase();
  return DATA.pois.filter(p => (!activeTags.size || activeTags.has(p.categoria)) &&
    (!q || [p.nombre, p.descripcion, ...(p.etiquetas || [])].join(' ').toLowerCase().includes(q)));
}

function renderLista() {
  $('#lista').innerHTML = filtered().map(p => `<li data-id="${p.id}">
    <input type="checkbox" ${selected.has(p.id) ? 'checked' : ''} aria-label="Añadir ${esc(p.nombre)}">
    ${p.imagenes?.[0] ? `<img src="${esc(p.imagenes[0])}" alt="" onerror="this.remove()">` : ''}
    <span><strong>${esc(p.nombre)}</strong><br><small>${esc(catName(p.categoria))}</small></span></li>`).join('') || '<li>Sin resultados.</li>';

  document.querySelectorAll('#lista li[data-id]').forEach(li => {
    const id = li.dataset.id;
    li.addEventListener('click', e => {
      if (e.target.type !== 'checkbox') {
        const cb = li.querySelector('input');
        cb.checked = !cb.checked;
      }
      selected[li.querySelector('input').checked ? 'add' : 'delete'](id);
    });
    li.addEventListener('mouseenter', () => {
      const p = DATA.pois.find(x => x.id === id);
      $('#info').textContent = p.descripcion;
      showInfo(id);
    });
  });
}

function loadMaps() {
  // Inyecta el CSS de Leaflet si no está ya en el HTML
  if (!document.querySelector('link[href*="leaflet.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  const setupLeaflet = () => {
    mapsReady = true;
    const mapEl = $('#map');
    mapEl.innerHTML = '';
    mapEl.style.display = 'block';
    mapEl.style.zIndex = '1';

    map = L.map(mapEl).setView([18.9, -70.2], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    routeLayer = L.layerGroup().addTo(map);

    DATA.pois.forEach(p => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 9,
        fillColor: catColor(p.categoria),
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 1
      }).addTo(map);

      marker.bindPopup(
        `<div style="max-width:240px;color:#2B2B2B">
          <strong>${esc(p.nombre)}</strong>
          <p style="margin:.3rem 0 0">${esc(p.descripcion)}</p>
        </div>`
      );

      marker.on('mouseover', () => marker.openPopup());
      marker.on('click', () => {
        selected.has(p.id) ? selected.delete(p.id) : selected.add(p.id);
        renderLista();
      });

      markers[p.id] = marker;
    });
  };

  if (window.L) {
    setupLeaflet();
  } else {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = setupLeaflet;
    s.onerror = () => {
      $('#mapmsg').textContent = 'No se pudo cargar el mapa de OpenStreetMap. Revisa tu conexión a internet.';
    };
    document.head.appendChild(s);
  }
}

function showInfo(id) {
  if (!mapsReady || !markers[id]) return;
  markers[id].openPopup();
}

async function drawRoute() {
  if (!mapsReady) return;
  const pts = DATA.pois.filter(p => selected.has(p.id));
  if (pts.length < 2) return alert('Elige al menos 2 lugares para trazar la ruta.');

  routeLayer.clearLayers();
  const coordsQuery = pts.map(p => `${p.lng},${p.lat}`).join(';');

  try {
    // Servicio público de rutas por carretera OSRM para OpenStreetMap
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes?.length) {
      const latLngs = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const polyline = L.polyline(latLngs, { color: '#1F4E9C', weight: 5, opacity: 0.85 }).addTo(routeLayer);
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    } else {
      throw new Error('Ruta no disponible');
    }
  } catch (_) {
    // Respaldo: trazar línea directa conectando los puntos si OSRM no encuentra carretera
    const latLngs = pts.map(p => [p.lat, p.lng]);
    const polyline = L.polyline(latLngs, { color: '#C8102E', weight: 4, dashArray: '8, 8' }).addTo(routeLayer);
    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
  }
}

/* ====== Vuelo (simulado) ====== */
$('#vueloForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const opciones = [['07:30', 549], ['13:10', 612], ['22:45', 478]].map(([h, pr]) => `<div class="res"><span><strong>${esc(f.get('o'))} → ${esc(f.get('d'))}</strong><br>${esc(f.get('i'))} · ${h}</span><strong>${pr * f.get('p')} €</strong></div>`).join('');
  $('#vueloRes').innerHTML = opciones;
});

/* ====== Router, menú y tema ====== */
const topbar = $('#topbar');
function route() {
  const v = (location.hash.slice(1) || 'inicio');
  const view = ['inicio', 'conoce', 'planifica', '