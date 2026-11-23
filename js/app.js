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
const PAGE = document.body.dataset.page;

// Gestión de favoritos en localStorage
function getFavs() {
  try { return JSON.parse(localStorage.getItem('rd_favs') || '[]'); } catch { return []; }
}
function toggleFav(id) {
  let favs = getFavs();
  if (favs.includes(id)) {
    favs = favs.filter(item => item !== id);
  } else {
    favs.push(id);
  }
  localStorage.setItem('rd_favs', JSON.stringify(favs));
  document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach(btn => {
    btn.textContent = favs.includes(id) ? '⭐' : '☆';
  });
  if (PAGE === 'planifica') renderLista();
}

/* ====== Arranque ====== */
document.addEventListener('DOMContentLoaded', async () => {
  initUI();

  try {
    const res = await fetch('./data.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  } catch (e) {
    console.error('Error cargando data.json:', e);
    $('main')?.insertAdjacentHTML('afterbegin',
      '<p class="wrap">No se pudo cargar data.json. Comprueba que está en la raíz del repositorio.</p>');
    return;
  }

  if (PAGE === 'inicio') initHomeFilterAndRotator();
  if (PAGE === 'conoce') initConoce();
  if (PAGE === 'planifica') initPlan();
});

/* ====== Tema, menú, botones y barra superior ====== */
function initUI() {
  const root = document.documentElement;
  const themeBtn = $('#theme');
  
  // Sol en claro (☀️), Luna en oscuro (🌙)
  const paintIcon = () => { if (themeBtn) themeBtn.textContent = root.dataset.theme === 'dark' ? '🌙' : '☀️'; };
  paintIcon();
  
  themeBtn?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', root.dataset.theme);
    paintIcon();
    if (window.map?.invalidateSize) window.map.invalidateSize();
  });

  // Logo cambia paleta rojo <-> azul
  $('#logo')?.addEventListener('click', () => {
    root.dataset.palette = root.dataset.palette === 'blue' ? 'red' : 'blue';
    localStorage.setItem('palette', root.dataset.palette);
  });

  document.querySelectorAll('#menu a[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === PAGE));

  // Menú hamburguesa funcional con cierre al pulsar enlaces y scrim
  const menu = $('#menu'), scrim = $('#scrim'), burger = $('#burger');
  const toggleMenu = open => { 
    menu?.classList.toggle('open', open); 
    scrim?.classList.toggle('on', open); 
  };
  burger?.addEventListener('click', e => { e.stopPropagation(); toggleMenu(!menu.classList.contains('open')); });
  scrim?.addEventListener('click', () => toggleMenu(false));
  menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => toggleMenu(false)));

  // Buscador desplegable móvil en planifica
  const toggleSidebar = $('#toggle-sidebar');
  const sidebar = $('#sidebar-plan');
  toggleSidebar?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
  });

  const topbar = $('#topbar');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    if (!topbar) return;
    topbar.classList.toggle('hidden', scrollY > lastY && scrollY > 120 && !menu?.classList.contains('open'));
    lastY = scrollY;
  }, { passive: true });

  document.addEventListener('click', e => {
    if (e.target.matches('.more')) {
      const d = e.target.previousElementSibling;
      const o = d.classList.toggle('open');
      e.target.textContent = o ? 'Ver menos' : 'Ver más';
    }
  });
}

/* ====== Tarjeta ====== */
/* ====== Tarjeta ====== */
function card(p, withMore = true, highlightColor = null) {
  const cColor = highlightColor || catColor(p.categoria);
  const imgs = (p.imagenes || []).map(s => `<img src="${esc(s)}" alt="${esc(p.nombre)}" loading="lazy" onerror="this.remove()">`).join('');
  const osmUrl = `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=16/${p.lat}/${p.lng}`;
  const favs = getFavs();
  const isFav = favs.includes(p.id);

  const tagsHtml = [
    `<span class="tag" style="--pill-color:${esc(catColor(p.categoria))}">${esc(catName(p.categoria))}</span>`,
    ...(p.etiquetas || []).map(t => `<span class="tag" style="--pill-color:${esc(tagColor(t, p.categoria))}">${esc(t)}</span>`)
  ].join('');

  return `<article class="card" style="--card-color:${esc(cColor)}">
    ${imgs ? `<div class="imgs">${imgs}</div>` : ''}
    <header class="card-header">
      <div class="tags">${tagsHtml}</div>
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
        <h3>${esc(p.nombre)}</h3>
        <button class="fav-btn" type="button" data-id="${esc(p.id)}" onclick="toggleFav('${esc(p.id)}')">${isFav ? '⭐' : '☆'}</button>
      </div>
    </header>
    <div class="body">
      ${p.ciudad ? `<div class="city">📍 ${esc(p.ciudad)}</div>` : ''}
      ${p.cuando ? `<div class="when">${esc(p.cuando)}${p.repite ? ' · ' + esc(p.repite) : ''}</div>` : ''}
      <p class="desc">${linkify(p.descripcion)}</p>
      ${withMore ? '<button class="more" type="button">Ver más</button>' : ''}
      <div class="links">
        <a href="${osmUrl}" target="_blank" rel="noopener">Ver en mapa</a>
        ${p.web ? `<a href="${esc(encodeURI(decodeURI(p.web)))}" target="_blank" rel="noopener">Web oficial</a>` : ''}
      </div>
    </div></article>`;
}

/* ====== Inicio ====== */
function getAvailableFilters() {
  const map = new Map();
  (DATA.pois || []).forEach(p => {
    const c = catObj(p.categoria);
    if (c && !map.has(`cat:${c.id}`)) {
      map.set(`cat:${c.id}`, { label: c.nombre, color: c.color || '#C8102E', filterFn: i => i.categoria === c.id });
    }
    (p.etiquetas || []).forEach(tag => {
      if (!map.has(`tag:${tag}`)) {
        map.set(`tag:${tag}`, { label: tag, color: tagColor(tag, p.categoria), filterFn: i => (i.etiquetas || []).includes(tag) });
      }
    });
  });
  return [...map.values()];
}

function initHomeFilterAndRotator() {
  const wrap = $('#inicio-pois-wrap'), el = $('#rot'), previews = $('#previews');
  if (!wrap || !el || !previews) return;
  const filters = getAvailableFilters();
  if (!filters.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  let currentIdx = -1;

  const applyFilter = idx => {
    currentIdx = idx;
    const f = filters[idx];
    el.textContent = f.label.toLowerCase();
    el.style.setProperty('--tag-color', f.color);
    const matching = DATA.pois.filter(f.filterFn).slice(0, 4);
    previews.innerHTML = `<div class="prev" style="--tag-color:${esc(f.color)}">
      <h3>${esc(f.label)}</h3>
      <div class="rail">${matching.map(p => card(p, false, f.color)).join('')}</div>
    </div>`;
  };

  const pickRandomIndex = () => {
    if (filters.length === 1) return 0;
    let n;
    do { n = Math.floor(Math.random() * filters.length); } while (n === currentIdx);
    return n;
  };

  applyFilter(pickRandomIndex());
  if (filters.length > 1) {
    setInterval(() => {
      el.classList.add('out');
      setTimeout(() => { applyFilter(pickRandomIndex()); el.classList.remove('out'); }, 400);
    }, ROTATE_MS);
  }
}

/* ====== Conoce: lista infinita + buscador ====== */
const BATCH = 6;
const norm = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function initConoce() {
  const grid = $('#lista-conoce'), sentinel = $('#sentinel'), fin = $('#fin');
  if (!grid || !sentinel) return;

  const f = { q: '', tipo: '', ciudad: '', desde: '', hasta: '' };
  let results = [], shown = 0, io = null;

  const cats = DATA.categorias.filter(c => DATA.pois.some(p => p.categoria === c.id));
  $('#ftipo').insertAdjacentHTML('beforeend', cats.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join(''));
  const ciudades = [...new Set(DATA.pois.map(p => p.ciudad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  $('#fciudad').insertAdjacentHTML('beforeend', ciudades.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join(''));

  const hc = DATA.categorias.find(c => c.seccion === location.hash.slice(1));
  if (hc) { f.tipo = hc.id; $('#ftipo').value = hc.id; }

  const matches = p => {
    if (f.q && !norm(p.nombre).includes(f.q)) return false;
    if (f.tipo && p.categoria !== f.tipo) return false;
    if (f.ciudad && p.ciudad !== f.ciudad) return false;
    if (f.tipo === 'evento' && (f.desde || f.hasta)) {
      if (!p.fecha) return false;
      const finDate = p.fechaFin || p.fecha;
      if (f.desde && finDate < f.desde) return false;
      if (f.hasta && p.fecha > f.hasta) return false;
    }
    return true;
  };

  const more = () => {
    if (shown >= results.length) return;
    const next = results.slice(shown, shown + BATCH);
    grid.insertAdjacentHTML('beforeend', next.map(p => card(p)).join(''));
    shown += next.length;
    fin.textContent = shown >= results.length ? 'Has llegado al final de la lista.' : '';
    if (io) { io.unobserve(sentinel); if (shown < results.length) io.observe(sentinel); }
  };

  const syncDates = () => {
    const isEvent = f.tipo === 'evento';
    document.querySelectorAll('.f-fecha').forEach(l => l.hidden = !isEvent);
    if (!isEvent) { f.desde = f.hasta = ''; $('#fdesde').value = $('#fhasta').value = ''; }
  };

  const apply = () => {
    syncDates();
    results = DATA.pois.filter(matches);
    if (f.tipo === 'evento') results.sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'));
    shown = 0;
    grid.innerHTML = '';
    $('#fcount').textContent = `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`;
    if (!results.length) { fin.textContent = 'Sin resultados. Prueba con otros filtros.'; return; }
    fin.textContent = '';
    if (!('IntersectionObserver' in window)) { while (shown < results.length) more(); return; }
    if (!io) io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) more(); }, { rootMargin: '400px' });
    more();
  };

  $('#bq').addEventListener('input', e => { f.q = norm(e.target.value); apply(); });
  $('#ftipo').addEventListener('change', e => { f.tipo = e.target.value; apply(); });
  $('#fciudad').addEventListener('change', e => { f.ciudad = e.target.value; apply(); });
  $('#fdesde').addEventListener('change', e => { f.desde = e.target.value; apply(); });
  $('#fhasta').addEventListener('change', e => { f.hasta = e.target.value; apply(); });
  $('#fclear').addEventListener('click', () => {
    Object.assign(f, { q: '', tipo: '', ciudad: '', desde: '', hasta: '' });
    $('#bq').value = ''; $('#ftipo').value = ''; $('#fciudad').value = '';
    apply();
  });

  apply();
}

/* ====== Planifica (Leaflet + OpenStreetMap) ====== */
let map, routeLayer, markers = {}, selected = new Set();

/* ====== Planifica (Leaflet + OpenStreetMap) ====== */
function initPlan() {
  const selectTag = $('#fav-filter-select');
  const tags = [...new Set(DATA.pois.flatMap(p => p.etiquetas || []))].sort((a, b) => a.localeCompare(b, 'es'));
  
  // Poblar spinner solo con el nombre de la etiqueta
  tags.forEach(t => {
    const opt = document.createElement('option');
    opt.value = `tag:${t}`;
    opt.textContent = t; // Solo el nombre de la etiqueta
    selectTag.appendChild(opt);
  });

  selectTag.addEventListener('change', renderLista);
  $('#q').addEventListener('input', renderLista);
  $('#ruta').addEventListener('click', drawRoute);
  renderLista();
  setupMap();
}

function filtered() {
  const q = $('#q').value.toLowerCase();
  const filterVal = $('#fav-filter-select')?.value || '';
  const favs = getFavs();

  return DATA.pois.filter(p => {
    if (filterVal === 'solo-favs' && !favs.includes(p.id)) return false;
    if (filterVal.startsWith('tag:')) {
      const tag = filterVal.split(':')[1];
      if (!(p.etiquetas || []).includes(tag)) return false;
    }
    if (q && ![p.nombre, p.descripcion, ...(p.etiquetas || [])].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderLista() {
  const lista = $('#lista');
  const favs = getFavs();
  lista.innerHTML = filtered().map(p => {
    const isFav = favs.includes(p.id);
    return `<li data-id="${esc(p.id)}">
      <input type="checkbox" ${selected.has(p.id) ? 'checked' : ''} aria-label="Añadir ${esc(p.nombre)}">
      ${p.imagenes?.[0] ? `<img src="${esc(p.imagenes[0])}" alt="" onerror="this.remove()">` : ''}
      <span style="flex:1"><strong>${esc(p.nombre)}</strong> ${isFav ? '⭐' : ''}<br><small>${esc(catName(p.categoria))}</small></span>
    </li>`;
  }).join('') || '<li>Sin resultados.</li>';

  lista.querySelectorAll('li[data-id]').forEach(li => {
    const id = li.dataset.id;
    const cb = li.querySelector('input');
    li.addEventListener('click', e => {
      if (e.target !== cb) cb.checked = !cb.checked;
      cb.checked ? selected.add(id) : selected.delete(id);
    });
    li.addEventListener('mouseenter', () => {
      const p = DATA.pois.find(x => x.id === id);
      $('#info').textContent = p.descripcion;
      markers[id]?.openPopup();
    });
  });
}

function setupMap() {
  const mapEl = $('#map');
  if (!window.L) {
    $('#mapmsg').textContent = 'No se pudo cargar el mapa de OpenStreetMap.';
    return;
  }
  mapEl.innerHTML = '';
  map = L.map(mapEl).setView([18.9, -70.2], 8);
  window.map = map;

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  routeLayer = L.layerGroup().addTo(map);

  DATA.pois.forEach(p => {
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 9, fillColor: catColor(p.categoria), color: '#fff', weight: 2, opacity: 1, fillOpacity: 1
    }).addTo(map);
    marker.bindPopup(`<div style="max-width:240px;color:#2B2B2B"><strong>${esc(p.nombre)}</strong><p style="margin:.3rem 0 0">${esc(p.descripcion)}</p></div>`);
    marker.on('mouseover', () => marker.openPopup());
    marker.on('click', () => {
      selected.has(p.id) ? selected.delete(p.id) : selected.add(p.id);
      renderLista();
    });
    markers[p.id] = marker;
  });
}

async function drawRoute() {
  if (!map) return;
  const pts = DATA.pois.filter(p => selected.has(p.id));
  const resBox = $('#ruta-resultado');
  if (pts.length < 2) {
    if (resBox) resBox.hidden = true;
    return alert('Elige al menos 2 lugares para trazar la ruta.');
  }
  routeLayer.clearLayers();
  const coords = pts.map(p => `${p.lng},${p.lat}`).join(';');

  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error('Ruta no disponible');
    
    const route = data.routes[0];
    const latLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const line = L.polyline(latLngs, { color: '#1F4E9C', weight: 5, opacity: .85 }).addTo(routeLayer);
    map.fitBounds(line.getBounds(), { padding: [40, 40] });

    // Mostrar duración estimada e imagen resumen del trayecto
    const durationMin = Math.round(route.duration / 60);
    const hours = Math.floor(durationMin / 60);
    const mins = durationMin % 60;
    const timeStr = hours > 0 ? `${hours} h ${mins} min` : `${mins} min`;
    const firstImg = pts[0].imagenes?.[0] || './imagen/puntacana.jpg';

    if (resBox) {
      resBox.hidden = false;
      resBox.innerHTML = `
        <div style="display:flex; align-items:center; gap:1rem;">
          <img src="${esc(firstImg)}" alt="Trayecto">
          <div>
            <strong>🚗 Trayecto calculado (${pts.length} puntos)</strong>
            <p style="margin:0.2rem 0 0; font-size:0.95rem;">Duración estimada: <strong>${timeStr}</strong></p>
          </div>
        </div>
      `;
    }
  } catch (_) {
    const line = L.polyline(pts.map(p => [p.lat, p.lng]), { color: '#C8102E', weight: 4, dashArray: '8, 8' }).addTo(routeLayer);
    map.fitBounds(line.getBounds(), { padding: [40, 40] });
    if (resBox) {
      resBox.hidden = false;
      resBox.innerHTML = `<p style="margin:0"><strong>Ruta en línea recta trazada</strong> (${pts.length} puntos seleccionados)</p>`;
    }
  }
}