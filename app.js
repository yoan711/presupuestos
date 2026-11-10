/* =========================================================
   Presupuestos – aplicación sencilla para hacer presupuestos
   Todo se guarda en este equipo (localStorage).
   ========================================================= */
'use strict';

const CLAVE_DATOS = 'presupuestos-datos-v1';

const UNIDADES = [
  { v: 'm²', t: 'm² (cuadrados)' },
  { v: 'ml', t: 'm (lineales)' },
  { v: 'm³', t: 'm³ (cúbicos)' },
  { v: 'ud', t: 'unidades' },
  { v: 'h', t: 'horas' },
  { v: 'kg', t: 'kilos' },
  { v: 'P.A.', t: 'precio cerrado' },
];

const $ = (id) => document.getElementById(id);

/* ---------------- Datos ---------------- */

let datos = cargarDatos();
let actual = null;          // presupuesto que se está editando
let temporizadorGuardar = null;

function cargarDatos() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_DATOS));
    if (d && Array.isArray(d.presupuestos)) {
      d.empresa = Object.assign(empresaVacia(), d.empresa || {});
      return d;
    }
  } catch (e) { /* datos dañados o inexistentes */ }
  return { empresa: empresaVacia(), presupuestos: [] };
}

function empresaVacia() {
  return { nombre: '', responsable: '', nif: '', telefono: '', direccion: '', poblacion: '', email: '', validez: 30, notas: '', logo: '', corrector: true };
}

function guardarDatos() {
  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos));
    return true;
  } catch (e) {
    preguntar('⚠️ No se ha podido guardar. Puede que el ordenador no tenga espacio.\nGuardad una copia de seguridad cuanto antes.', [{ texto: 'Entendido', clase: 'btn-azul' }]);
    return false;
  }
}

function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function siguienteNumero(fechaISO) {
  const anio = (fechaISO || hoyISO()).slice(0, 4);
  let max = 0;
  const patron = new RegExp('^' + anio + '-(\\d+)$');
  for (const p of datos.presupuestos) {
    const m = String(p.numero || '').trim().match(patron);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${anio}-${String(max + 1).padStart(3, '0')}`;
}

function partidaVacia() {
  return { desc: '', cant: '', unidad: 'ud', precio: '' };
}

/* ---------------- Números y fechas ---------------- */

// Acepta "12,5", "12.5", "1.234,50"...
function leerNumero(texto) {
  if (texto === null || texto === undefined) return NaN;
  let s = String(texto).trim().replace(/\s|€/g, '');
  if (s === '') return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

function redondear(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function formatoNumero(n, decimales) {
  const negativo = n < 0;
  const partes = Math.abs(n).toFixed(decimales).split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (negativo ? '-' : '') + partes.join(',');
}

function euros(n) { return formatoNumero(n || 0, 2) + ' €'; }

function formatoCantidad(n) {
  const s = formatoNumero(n, 2);
  return s.replace(/,00$/, '').replace(/(,\d)0$/, '$1');
}

function fechaLegible(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function sumarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

/* ---------------- Cálculos ---------------- */

function cantidadDe(partida) {
  const c = leerNumero(partida.cant);
  return isNaN(c) ? 1 : c;   // si no se pone cantidad, cuenta como 1
}

function importeDe(partida) {
  const precio = leerNumero(partida.precio);
  if (isNaN(precio)) return 0;
  return redondear(cantidadDe(partida) * precio);
}

function partidaTieneContenido(partida) {
  return partida.desc.trim() !== '' || !isNaN(leerNumero(partida.precio));
}

function calcularTotales(p) {
  const base = redondear(p.partidas.reduce((s, x) => s + importeDe(x), 0));
  const iva = redondear(base * (Number(p.iva) || 0) / 100);
  return { base, iva, total: redondear(base + iva) };
}

/* ---------------- Navegación entre pantallas ---------------- */

function mostrar(nombre) {
  for (const id of ['pantalla-inicio', 'pantalla-editor', 'pantalla-empresa']) {
    $(id).hidden = id !== 'pantalla-' + nombre;
  }
  window.scrollTo(0, 0);
}

function irA(nombre) {
  if (nombre !== 'inicio') history.pushState({ pantalla: nombre }, '');
  mostrar(nombre);
}

window.addEventListener('popstate', () => {
  // botón "atrás" del navegador: siempre vuelve al inicio
  salirDelEditor(false);
  mostrar('inicio');
  pintarLista();
});

/* ---------------- Pantalla de inicio ---------------- */

function pintarLista() {
  const filtro = $('buscar').value.trim().toLowerCase();
  const lista = $('lista');
  lista.innerHTML = '';

  const ordenados = [...datos.presupuestos].sort((a, b) => (b.modificado || 0) - (a.modificado || 0));
  const visibles = ordenados.filter((p) => {
    if (!filtro) return true;
    const texto = [p.numero, p.cliente.nombre, p.cliente.direccion, p.cliente.obra, p.cliente.telefono,
      ...p.partidas.map((x) => x.desc)].join(' ').toLowerCase();
    return texto.includes(filtro);
  });

  if (datos.presupuestos.length === 0) {
    lista.innerHTML = '<div class="vacio">Todavía no hay presupuestos.<br>Pulsa el botón verde para hacer el primero.</div>';
    return;
  }
  if (visibles.length === 0) {
    lista.innerHTML = '<div class="vacio">No se ha encontrado ningún presupuesto con esa búsqueda.</div>';
    return;
  }

  for (const p of visibles) {
    const div = document.createElement('div');
    div.className = 'item';
    div.tabIndex = 0;
    const lugar = p.cliente.obra || p.cliente.direccion || '';
    div.innerHTML = `
      <div class="item-info">
        <div class="item-cliente"></div>
        <div class="item-detalle"></div>
      </div>
      <div class="item-total"></div>
      <button class="btn btn-azul">Abrir</button>`;
    div.querySelector('.item-cliente').textContent = p.cliente.nombre || '(Sin nombre de cliente)';
    div.querySelector('.item-detalle').textContent = `Nº ${p.numero} · ${fechaLegible(p.fecha)}${lugar ? ' · ' + lugar : ''}`;
    div.querySelector('.item-total').textContent = euros(calcularTotales(p).total);
    const abrir = () => abrirPresupuesto(p.id);
    div.addEventListener('click', abrir);
    div.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(); });
    lista.appendChild(div);
  }
}

$('buscar').addEventListener('input', pintarLista);

$('btn-nuevo').addEventListener('click', () => {
  const fecha = hoyISO();
  const p = {
    id: nuevoId(),
    numero: siguienteNumero(fecha),
    fecha,
    cliente: { nombre: '', telefono: '', nif: '', direccion: '', obra: '' },
    partidas: [partidaVacia()],
    iva: 21,
    notas: '',
    creado: Date.now(),
    modificado: Date.now(),
  };
  datos.presupuestos.push(p);
  guardarDatos();
  abrirPresupuesto(p.id, true);
});

/* ---------------- Editor ---------------- */

const camposEditor = {
  'p-numero': (p) => [p, 'numero'],
  'p-fecha': (p) => [p, 'fecha'],
  'c-nombre': (p) => [p.cliente, 'nombre'],
  'c-telefono': (p) => [p.cliente, 'telefono'],
  'c-nif': (p) => [p.cliente, 'nif'],
  'c-direccion': (p) => [p.cliente, 'direccion'],
  'c-obra': (p) => [p.cliente, 'obra'],
  'p-iva': (p) => [p, 'iva'],
  'p-notas': (p) => [p, 'notas'],
};

for (const id of Object.keys(camposEditor)) {
  const evento = $(id).tagName === 'SELECT' || $(id).type === 'date' ? 'change' : 'input';
  $(id).addEventListener(evento, () => {
    if (!actual) return;
    const [obj, clave] = camposEditor[id](actual);
    obj[clave] = clave === 'iva' ? Number($(id).value) : $(id).value;
    if (clave === 'iva') recalcular();
    if (clave === 'nombre' || clave === 'numero') pintarTitulo();
    cambiosPendientes();
  });
}

function abrirPresupuesto(id, esNuevo) {
  actual = datos.presupuestos.find((p) => p.id === id);
  if (!actual) return;
  if (!actual.partidas.length) actual.partidas.push(partidaVacia());
  for (const idCampo of Object.keys(camposEditor)) {
    const [obj, clave] = camposEditor[idCampo](actual);
    $(idCampo).value = obj[clave] ?? '';
  }
  pintarTitulo();
  pintarPartidas();
  recalcular();
  $('estado-guardado').textContent = '✓ Guardado';
  irA('editor');
  if (esNuevo) setTimeout(() => $('c-nombre').focus(), 50);
}

function pintarTitulo() {
  $('titulo-editor').textContent = actual.cliente.nombre ? `Presupuesto de ${actual.cliente.nombre}` : 'Presupuesto nuevo';
  pintarResumen();
}

function pintarPartidas() {
  const cont = $('partidas');
  cont.innerHTML = '';
  actual.partidas.forEach((partida, i) => {
    const div = document.createElement('div');
    div.className = 'partida';
    div.innerHTML = `
      <span class="partida-num">${i + 1}</span>
      <label class="c-desc"><span class="etq">¿Qué trabajo es?</span>
        <textarea rows="1" data-campo="desc" placeholder="Ej.: Alicatado de paredes del baño"></textarea>
      </label>
      <label class="c-cant"><span class="etq">Cantidad</span>
        <input type="text" inputmode="decimal" data-campo="cant" placeholder="25">
      </label>
      <label class="c-ud"><span class="etq">Medida</span>
        <select data-campo="unidad">${UNIDADES.map((u) => `<option value="${u.v}">${u.t}</option>`).join('')}</select>
      </label>
      <label class="c-precio"><span class="etq">Precio (€)</span>
        <input type="text" inputmode="decimal" data-campo="precio" placeholder="18,50">
      </label>
      <div class="c-imp"><span class="etq">Importe</span><strong data-importe></strong></div>
      <button class="btn-quitar" data-accion="quitar" title="Quitar este trabajo" aria-label="Quitar este trabajo">🗑️</button>`;

    const ta = div.querySelector('[data-campo="desc"]');
    ta.value = partida.desc;
    div.querySelector('[data-campo="cant"]').value = partida.cant;
    const sel = div.querySelector('[data-campo="unidad"]');
    if (!UNIDADES.some((u) => u.v === partida.unidad)) {
      sel.insertAdjacentHTML('beforeend', `<option></option>`);
      sel.lastElementChild.value = partida.unidad;
      sel.lastElementChild.textContent = partida.unidad;
    }
    sel.value = partida.unidad;
    div.querySelector('[data-campo="precio"]').value = partida.precio;
    div.querySelector('[data-importe]').textContent = euros(importeDe(partida));

    div.querySelectorAll('[data-campo]').forEach((el) => {
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
        partida[el.dataset.campo] = el.value;
        if (el.tagName === 'TEXTAREA') ajustarAltura(el);
        div.querySelector('[data-importe]').textContent = euros(importeDe(partida));
        recalcular();
        cambiosPendientes();
      });
    });

    div.querySelector('[data-accion="quitar"]').addEventListener('click', async () => {
      if (partidaTieneContenido(partida)) {
        const ok = await preguntar(`¿Quitar el trabajo ${i + 1}?\n"${partida.desc.trim() || 'sin descripción'}"`, [
          { texto: 'Sí, quitarlo', clase: 'btn-rojo-lleno', valor: true },
          { texto: 'No, dejarlo', clase: 'btn-gris', valor: false },
        ]);
        if (!ok) return;
      }
      actual.partidas.splice(i, 1);
      if (!actual.partidas.length) actual.partidas.push(partidaVacia());
      pintarPartidas();
      recalcular();
      cambiosPendientes();
    });

    Corrector.activarCorrector(ta);
    cont.appendChild(div);
    requestAnimationFrame(() => ajustarAltura(ta));
  });
}

function ajustarAltura(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.max(ta.scrollHeight + 4, 44) + 'px';
}

function anadirPartida(datosPartida) {
  actual.partidas.push(Object.assign(partidaVacia(), datosPartida || {}));
  pintarPartidas();
  recalcular();
  cambiosPendientes();
  const ultima = $('partidas').lastElementChild;
  ultima.scrollIntoView({ behavior: 'smooth', block: 'center' });
  ultima.querySelector(datosPartida ? '[data-campo="cant"]' : 'textarea').focus({ preventScroll: true });
}

$('btn-anadir').addEventListener('click', () => anadirPartida());

// Trabajos típicos que vienen ya escritos (sin precio)
const CATALOGO = [
  ['Demolición de alicatado existente y retirada de escombros', 'm²'],
  ['Demolición de solado existente y retirada de escombros', 'm²'],
  ['Demolición de tabique de ladrillo', 'm²'],
  ['Contenedor de escombros y transporte a vertedero', 'ud'],
  ['Alicatado de paredes con azulejo', 'm²'],
  ['Solado de suelo con gres porcelánico', 'm²'],
  ['Colocación de rodapié', 'ml'],
  ['Levantamiento de tabique de ladrillo', 'm²'],
  ['Tabique de pladur con aislamiento', 'm²'],
  ['Falso techo de pladur', 'm²'],
  ['Falso techo de escayola', 'm²'],
  ['Enfoscado de paredes con mortero de cemento', 'm²'],
  ['Enlucido de yeso en paredes y techos', 'm²'],
  ['Alisado de paredes (quitar gotelé)', 'm²'],
  ['Pintura plástica en paredes y techos', 'm²'],
  ['Recrecido y nivelación de suelo con mortero', 'm²'],
  ['Solera de hormigón con mallazo', 'm²'],
  ['Muro de bloque de hormigón', 'm²'],
  ['Impermeabilización de terraza', 'm²'],
  ['Impermeabilización de cubierta', 'm²'],
  ['Reparación de tejado y sustitución de tejas rotas', 'm²'],
  ['Colocación de canalón', 'ml'],
  ['Colocación de bajante', 'ml'],
  ['Arqueta de saneamiento', 'ud'],
  ['Instalación de plato de ducha', 'ud'],
  ['Instalación de mampara de ducha', 'ud'],
  ['Instalación de bañera', 'ud'],
  ['Colocación de inodoro', 'ud'],
  ['Colocación de lavabo con mueble', 'ud'],
  ['Instalación de fontanería del baño', 'P.A.'],
  ['Instalación de fontanería de la cocina', 'P.A.'],
  ['Instalación eléctrica', 'P.A.'],
  ['Colocación de premarco', 'ud'],
  ['Colocación de puerta de paso', 'ud'],
  ['Colocación de ventana', 'ud'],
  ['Rejuntado y sellado con silicona', 'P.A.'],
  ['Limpieza final de obra', 'P.A.'],
  ['Materiales', 'P.A.'],
  ['Mano de obra', 'h'],
  ['Mano de obra de oficial de primera', 'h'],
  ['Mano de obra de ayudante', 'h'],
];

function elegirTrabajo() {
  // Primero los trabajos ya usados (con su precio), después los de la lista típica
  const vistos = new Map();
  const ordenados = [...datos.presupuestos].sort((a, b) => (b.modificado || 0) - (a.modificado || 0));
  for (const p of ordenados) {
    if (actual && p.id === actual.id) continue;   // no repetir lo que ya está en este presupuesto
    for (const x of p.partidas) {
      const clave = x.desc.trim().toLowerCase();
      if (clave && !vistos.has(clave)) vistos.set(clave, { ...x, usado: true });
    }
  }
  for (const [desc, unidad] of CATALOGO) {
    const clave = desc.toLowerCase();
    if (!vistos.has(clave)) vistos.set(clave, { desc, unidad, precio: '', cant: '' });
  }
  const todos = [...vistos.values()];
  const normal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/v/g, 'b').replace(/h/g, '');

  return new Promise((resolver) => {
    const cerrar = abrirDialogo('Elige el trabajo que quieras añadir:', resolver);
    const cont = $('dialogo-botones');
    const buscar = document.createElement('input');
    buscar.type = 'search';
    buscar.className = 'dialogo-buscar';
    buscar.placeholder = '🔍 Escribe para buscar (ej.: baño, techo, pintura…)';
    $('dialogo-extra').appendChild(buscar);   // el buscador se queda fijo arriba
    const lista = document.createElement('div');
    lista.className = 'dialogo-botones';
    const cancelar = document.createElement('button');
    cancelar.className = 'btn btn-rojo';
    cancelar.textContent = 'Cancelar';
    cont.append(lista, cancelar);
    cancelar.addEventListener('click', () => cerrar(null));

    const pintar = () => {
      const palabras = normal(buscar.value).split(/\s+/).filter(Boolean);
      const visibles = todos.filter((x) => palabras.every((w) => normal(x.desc).includes(w))).slice(0, 80);
      lista.innerHTML = '';
      if (!visibles.length) lista.innerHTML = '<p class="vacio">No hay ningún trabajo con esas palabras.</p>';
      for (const x of visibles) {
        const b = document.createElement('button');
        b.className = 'btn btn-gris opcion-trabajo';
        b.textContent = x.desc.trim().split('\n')[0];
        const detalle = document.createElement('small');
        detalle.textContent = x.precio ? `${x.precio} € / ${x.unidad}` : x.unidad;
        b.appendChild(detalle);
        b.addEventListener('click', () => cerrar(x));
        lista.appendChild(b);
      }
    };
    buscar.addEventListener('input', () => {
      pintar();
      $('dialogo-fondo').querySelector('.dialogo').scrollTop = 0;
    });
    pintar();
    buscar.focus();
  });
}

$('btn-habituales').addEventListener('click', async () => {
  const elegido = await elegirTrabajo();
  if (!elegido) return;
  // si el último trabajo está vacío, lo reutilizamos
  const ultima = actual.partidas[actual.partidas.length - 1];
  if (ultima && !partidaTieneContenido(ultima) && !ultima.cant) actual.partidas.pop();
  anadirPartida({ desc: elegido.desc, unidad: elegido.unidad, precio: elegido.precio, cant: '' });
});

function irAPartida(i) {
  const tarjeta = $('partidas').children[i];
  if (!tarjeta) return;
  tarjeta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  tarjeta.classList.add('resaltada');
  setTimeout(() => tarjeta.classList.remove('resaltada'), 1500);
  tarjeta.querySelector('textarea').focus({ preventScroll: true });
}

function pintarResumen() {
  if (!actual) return;
  const c = actual.cliente;
  $('r-cliente').textContent = `Nº ${actual.numero}${c.nombre ? ' · ' + c.nombre : ''}`;
  $('r-titulo-trabajos').textContent = `Trabajos (${actual.partidas.length})`;
  const lista = $('r-lista');
  lista.innerHTML = '';
  actual.partidas.forEach((x, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.title = 'Ir a este trabajo';
    b.innerHTML = '<span class="resumen-num"></span><span class="resumen-desc"></span><span class="resumen-imp"></span>';
    b.querySelector('.resumen-num').textContent = (i + 1) + '.';
    const desc = b.querySelector('.resumen-desc');
    desc.textContent = x.desc.trim() || 'sin escribir todavía';
    desc.classList.toggle('vacia', !x.desc.trim());
    b.querySelector('.resumen-imp').textContent = euros(importeDe(x));
    b.addEventListener('click', () => irAPartida(i));
    li.appendChild(b);
    lista.appendChild(li);
  });
  const t = calcularTotales(actual);
  $('r-base').textContent = euros(t.base);
  $('r-iva-texto').textContent = Number(actual.iva) ? `IVA ${actual.iva} %` : 'IVA';
  $('r-iva').textContent = euros(t.iva);
  $('r-total').textContent = euros(t.total);
}

$('r-anadir').addEventListener('click', () => anadirPartida());

function recalcular() {
  pintarResumen();
  const t = calcularTotales(actual);
  $('t-base').textContent = euros(t.base);
  $('t-iva-texto').textContent = Number(actual.iva) ? `IVA ${actual.iva} %` : 'IVA';
  $('t-iva').textContent = euros(t.iva);
  $('t-total').textContent = euros(t.total);
}

function cambiosPendientes() {
  $('estado-guardado').textContent = 'Guardando…';
  clearTimeout(temporizadorGuardar);
  temporizadorGuardar = setTimeout(guardarAhora, 600);
}

function guardarAhora() {
  clearTimeout(temporizadorGuardar);
  temporizadorGuardar = null;
  if (!actual) return;
  actual.modificado = Date.now();
  if (guardarDatos()) $('estado-guardado').textContent = '✓ Guardado';
}

function presupuestoVacio(p) {
  const c = p.cliente;
  return !c.nombre && !c.telefono && !c.nif && !c.direccion && !c.obra && !p.notas &&
    p.partidas.every((x) => !partidaTieneContenido(x) && !x.cant);
}

// Sale del editor guardando; si el presupuesto está totalmente vacío lo descarta
function salirDelEditor() {
  if (!actual) return;
  if (temporizadorGuardar) guardarAhora();
  if (presupuestoVacio(actual)) {
    datos.presupuestos = datos.presupuestos.filter((p) => p.id !== actual.id);
    guardarDatos();
  }
  actual = null;
}

$('btn-volver').addEventListener('click', () => history.back());

$('btn-mas').addEventListener('click', async () => {
  const accion = await preguntar('¿Qué quieres hacer con este presupuesto?', [
    { texto: '📝 Descargar en Word (para cambiarlo a mano)', clase: 'btn-verde', valor: 'word' },
    { texto: '📄 Hacer una copia (para otro cliente parecido)', clase: 'btn-azul', valor: 'copiar' },
    { texto: '🗑️ Borrar este presupuesto', clase: 'btn-rojo', valor: 'borrar' },
    { texto: 'Cancelar', clase: 'btn-gris', valor: null },
  ]);
  if (accion === 'word') {
    if (!(await comprobarAntesDePDF())) return;
    guardarAhora();
    try {
      await descargarWord(actual);
      avisar('✓ Documento Word descargado en «Descargas». Ábrelo para cambiarlo e imprimirlo.', 6000);
    } catch (err) {
      console.error(err);
      preguntar('Ha habido un problema al crear el documento Word.\n(' + err.message + ')', [{ texto: 'Entendido', clase: 'btn-azul' }]);
    }
  } else if (accion === 'copiar') {
    guardarAhora();
    const copia = JSON.parse(JSON.stringify(actual));
    copia.id = nuevoId();
    copia.fecha = hoyISO();
    copia.numero = siguienteNumero(copia.fecha);
    copia.creado = copia.modificado = Date.now();
    datos.presupuestos.push(copia);
    guardarDatos();
    actual = null;
    history.replaceState({ pantalla: 'editor' }, '');
    abrirPresupuestoSinHistorial(copia.id);
    avisar('Copia creada. Ahora estás en la copia (Nº ' + copia.numero + ').');
  } else if (accion === 'borrar') {
    const seguro = await preguntar(`¿Seguro que quieres BORRAR el presupuesto Nº ${actual.numero}${actual.cliente.nombre ? ' de ' + actual.cliente.nombre : ''}?\n\nNo se puede deshacer.`, [
      { texto: 'Sí, borrarlo', clase: 'btn-rojo-lleno', valor: true },
      { texto: 'No, volver', clase: 'btn-gris', valor: false },
    ]);
    if (!seguro) return;
    clearTimeout(temporizadorGuardar);
    temporizadorGuardar = null;
    datos.presupuestos = datos.presupuestos.filter((p) => p.id !== actual.id);
    guardarDatos();
    actual = null;
    history.back();
    avisar('Presupuesto borrado');
  }
});

function abrirPresupuestoSinHistorial(id) {
  const push = history.pushState;
  history.pushState = () => {};
  try { abrirPresupuesto(id); } finally { history.pushState = push; }
}

/* ---------------- PDF ---------------- */

function comprobarAntesDePDF() {
  if (!actual.partidas.some(partidaTieneContenido)) {
    preguntar('Todavía no hay ningún trabajo escrito.\nAñade al menos un trabajo antes de sacar el PDF.', [{ texto: 'Entendido', clase: 'btn-azul' }]);
    return Promise.resolve(false);
  }
  if (!actual.cliente.nombre.trim()) {
    return preguntar('No has puesto el nombre del cliente.\n¿Quieres seguir igualmente?', [
      { texto: 'Sí, seguir', clase: 'btn-azul', valor: true },
      { texto: 'No, voy a ponerlo', clase: 'btn-gris', valor: false },
    ]).then((ok) => {
      if (!ok) $('c-nombre').focus();
      return ok;
    });
  }
  return Promise.resolve(true);
}

function nombreArchivo(p) {
  const limpio = (s) => s.replace(/[\\/:*?"<>|]+/g, '').trim();
  return limpio(`Presupuesto ${p.numero}${p.cliente.nombre ? ' - ' + p.cliente.nombre : ''}`) + '.pdf';
}

function generarPDF(p) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const e = datos.empresa;
  const AZUL = [31, 95, 139];
  const GRIS = [90, 90, 90];
  const ANCHO = 210, MARGEN = 15, DERECHA = ANCHO - MARGEN;
  let y = MARGEN;

  doc.setProperties({ title: nombreArchivo(p).replace(/\.pdf$/, ''), creator: e.nombre || 'Presupuestos' });

  // --- Logo y datos de la empresa ---
  let xTexto = MARGEN;
  if (e.logo) {
    try {
      const props = doc.getImageProperties(e.logo);
      const alto = 24;
      const ancho = Math.min(alto * props.width / props.height, 55);
      doc.addImage(e.logo, 'JPEG', MARGEN, y, ancho, ancho * props.height / props.width);
      xTexto = MARGEN + ancho + 5;
    } catch (err) { /* logo no válido: se ignora */ }
  }

  doc.setTextColor(...AZUL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(e.nombre || '', xTexto, y + 6, { maxWidth: 105 - (xTexto - MARGEN) });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GRIS);
  const lineasEmpresa = [
    e.responsable,
    e.nif ? 'NIF: ' + e.nif : '',
    e.direccion,
    e.poblacion,
    [e.telefono ? 'Tel.: ' + e.telefono : '', e.email].filter(Boolean).join('  ·  '),
  ].filter(Boolean);
  let yEmp = y + 12;
  for (const l of lineasEmpresa) { doc.text(l, xTexto, yEmp); yEmp += 4.5; }

  // --- Título y número ---
  doc.setTextColor(...AZUL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('PRESUPUESTO', DERECHA, y + 7, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  const datosDoc = [['Nº:', p.numero], ['Fecha:', fechaLegible(p.fecha)]];
  const validez = parseInt(e.validez, 10);
  if (validez > 0 && p.fecha) datosDoc.push(['Válido hasta:', fechaLegible(sumarDias(p.fecha, validez))]);
  let yDoc = y + 14;
  for (const [k, v] of datosDoc) {
    doc.setFont('helvetica', 'bold');
    doc.text(k, DERECHA - 32, yDoc, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(String(v || ''), DERECHA, yDoc, { align: 'right' });
    yDoc += 5;
  }

  y = Math.max(yEmp, yDoc, e.logo ? y + 26 : 0) + 4;
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, y, DERECHA, y);
  y += 6;

  // --- Cliente ---
  const c = p.cliente;
  const filasCliente = [
    ['Cliente:', c.nombre],
    ['DNI / NIF:', c.nif],
    ['Dirección:', c.direccion],
    ['Teléfono:', c.telefono],
    ['Lugar de la obra:', c.obra],
  ].filter(([, v]) => v && v.trim());
  if (filasCliente.length) {
    const altoCaja = 8 + filasCliente.length * 5.5;
    doc.setFillColor(242, 245, 248);
    doc.setDrawColor(210, 218, 226);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGEN, y, ANCHO - 2 * MARGEN, altoCaja, 2, 2, 'FD');
    doc.setFontSize(8.5);
    doc.setTextColor(...AZUL);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', MARGEN + 4, y + 5);
    doc.setFontSize(10);
    let yc = y + 10.5;
    for (const [k, v] of filasCliente) {
      doc.setTextColor(...GRIS);
      doc.setFont('helvetica', 'bold');
      doc.text(k, MARGEN + 4, yc);
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'normal');
      doc.text(v.trim(), MARGEN + 36, yc, { maxWidth: ANCHO - 2 * MARGEN - 40 });
      yc += 5.5;
    }
    y += altoCaja + 7;
  }

  // --- Tabla de trabajos ---
  const filas = p.partidas.filter(partidaTieneContenido).map((x) => {
    const precio = leerNumero(x.precio);
    return [
      x.desc.trim(),
      formatoCantidad(cantidadDe(x)),
      x.unidad,
      isNaN(precio) ? '' : euros(precio),
      euros(importeDe(x)),
    ];
  });

  doc.autoTable({
    startY: y,
    head: [['Descripción del trabajo', 'Cantidad', 'Ud.', 'Precio', 'Importe']],
    body: filas,
    theme: 'grid',
    margin: { left: MARGEN, right: MARGEN, bottom: 22 },
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.5, textColor: [25, 25, 25], lineColor: [210, 210, 210], lineWidth: 0.2, valign: 'middle' },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 248, 246] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
  });
  y = doc.lastAutoTable.finalY + 6;

  // --- Totales ---
  const t = calcularTotales(p);
  const filasTotales = [['Base imponible', euros(t.base)]];
  if (Number(p.iva)) filasTotales.push([`IVA (${p.iva} %)`, euros(t.iva)]);
  const altoTotales = filasTotales.length * 7 + 13;
  if (y + altoTotales > 297 - 25) { doc.addPage(); y = MARGEN; }
  const xT = DERECHA - 80;
  doc.setFontSize(10.5);
  for (const [k, v] of filasTotales) {
    doc.setTextColor(...GRIS);
    doc.setFont('helvetica', 'normal');
    doc.text(k, xT + 3, y + 4.5);
    doc.setTextColor(20, 20, 20);
    doc.text(v, DERECHA - 3, y + 4.5, { align: 'right' });
    y += 7;
  }
  doc.setFillColor(...AZUL);
  doc.roundedRect(xT, y, 80, 11, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(Number(p.iva) ? 'TOTAL (IVA incl.)' : 'TOTAL', xT + 3, y + 7.4);
  doc.text(euros(t.total), DERECHA - 3, y + 7.4, { align: 'right' });
  y += 19;

  // --- Notas ---
  const notas = [p.notas, e.notas].map((s) => (s || '').trim()).filter(Boolean).join('\n\n');
  if (notas) {
    doc.setFontSize(9.5);
    const lineas = doc.splitTextToSize(notas, ANCHO - 2 * MARGEN);
    if (y + 8 + lineas.length * 4.5 > 297 - 25) { doc.addPage(); y = MARGEN; }
    doc.setTextColor(...AZUL);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVACIONES Y CONDICIONES', MARGEN, y);
    y += 5;
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    for (const l of lineas) {
      if (y > 297 - 25) { doc.addPage(); y = MARGEN; }
      doc.text(l, MARGEN, y);
      y += 4.5;
    }
    y += 6;
  }

  // --- Firmas ---
  if (y + 30 > 297 - 22) { doc.addPage(); y = MARGEN + 5; }
  y += 18;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(MARGEN, y, MARGEN + 70, y);
  doc.line(DERECHA - 70, y, DERECHA, y);
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.setFont('helvetica', 'normal');
  doc.text('Conforme del cliente', MARGEN + 35, y + 5, { align: 'center' });
  doc.text('Firma de la empresa', DERECHA - 35, y + 5, { align: 'center' });

  // --- Pie de página ---
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.setFont('helvetica', 'normal');
    const pie = [e.nombre, e.telefono, e.email].filter(Boolean).join('  ·  ');
    doc.text(pie, MARGEN, 297 - 10);
    doc.text(`Presupuesto ${p.numero}  ·  Página ${i} de ${paginas}`, DERECHA, 297 - 10, { align: 'right' });
  }

  return doc;
}

$('btn-descargar').addEventListener('click', async () => {
  if (!(await comprobarAntesDePDF())) return;
  guardarAhora();
  try {
    generarPDF(actual).save(nombreArchivo(actual));
    avisar('✓ PDF descargado. Lo encontrarás en la carpeta «Descargas».', 5000);
  } catch (err) {
    console.error(err);
    preguntar('Ha habido un problema al crear el PDF.\n(' + err.message + ')', [{ texto: 'Entendido', clase: 'btn-azul' }]);
  }
});

$('btn-imprimir').addEventListener('click', async () => {
  if (!(await comprobarAntesDePDF())) return;
  guardarAhora();
  try {
    const doc = generarPDF(actual);
    doc.autoPrint();
    const url = doc.output('bloburl');
    const ventana = window.open(url, '_blank');
    if (!ventana) {
      // si el navegador bloquea la ventana, al menos se descarga
      doc.save(nombreArchivo(actual));
      avisar('Se ha descargado el PDF. Ábrelo desde «Descargas» para imprimirlo.', 6000);
    }
  } catch (err) {
    console.error(err);
    preguntar('Ha habido un problema al preparar la impresión.\n(' + err.message + ')', [{ texto: 'Entendido', clase: 'btn-azul' }]);
  }
});

/* ---------------- Datos de la empresa ---------------- */

const camposEmpresa = ['nombre', 'responsable', 'nif', 'telefono', 'direccion', 'poblacion', 'email', 'validez', 'notas'];
let logoTemporal = '';

function abrirEmpresa(primeraVez) {
  for (const k of camposEmpresa) $('e-' + k).value = datos.empresa[k] ?? '';
  $('e-corrector').checked = datos.empresa.corrector !== false;
  logoTemporal = datos.empresa.logo || '';
  pintarLogo();
  $('aviso-primera-vez').hidden = !primeraVez;
  $('btn-volver-empresa').hidden = !!primeraVez;
  irA('empresa');
}

function pintarLogo() {
  $('logo-vista').hidden = !logoTemporal;
  $('btn-quitar-logo').hidden = !logoTemporal;
  if (logoTemporal) $('logo-vista').src = logoTemporal;
}

$('btn-empresa').addEventListener('click', () => abrirEmpresa(false));
$('btn-volver-empresa').addEventListener('click', () => history.back());

$('btn-guardar-empresa').addEventListener('click', () => {
  if (!$('e-nombre').value.trim()) {
    preguntar('Escribe al menos el nombre de la empresa.', [{ texto: 'Entendido', clase: 'btn-azul' }])
      .then(() => $('e-nombre').focus());
    return;
  }
  for (const k of camposEmpresa) datos.empresa[k] = $('e-' + k).value.trim();
  datos.empresa.validez = parseInt(datos.empresa.validez, 10) || 0;
  datos.empresa.logo = logoTemporal;
  datos.empresa.corrector = $('e-corrector').checked;
  Corrector.setActivo(datos.empresa.corrector);
  if (guardarDatos()) {
    avisar('✓ Datos de la empresa guardados');
    if (history.state && history.state.pantalla === 'empresa') history.back();
    else { mostrar('inicio'); pintarLista(); }
  }
});

$('btn-logo').addEventListener('click', () => $('archivo-logo').click());
$('btn-quitar-logo').addEventListener('click', () => { logoTemporal = ''; pintarLogo(); });

$('archivo-logo').addEventListener('change', (ev) => {
  const archivo = ev.target.files[0];
  ev.target.value = '';
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = () => {
    const img = new Image();
    img.onload = () => {
      // reducimos la imagen para que ocupe poco
      const max = 500;
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      logoTemporal = canvas.toDataURL('image/jpeg', 0.9);
      pintarLogo();
    };
    img.onerror = () => avisar('Esa imagen no se puede usar. Prueba con otra.');
    img.src = lector.result;
  };
  lector.readAsDataURL(archivo);
});

/* ---------------- Copias de seguridad ---------------- */

$('btn-exportar').addEventListener('click', () => {
  const contenido = JSON.stringify({ app: 'presupuestos', version: 1, fecha: new Date().toISOString(), ...datos }, null, 1);
  const blob = new Blob([contenido], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Copia presupuestos ${fechaLegible(hoyISO()).replace(/\//g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  avisar('✓ Copia guardada en «Descargas»', 5000);
});

$('btn-importar').addEventListener('click', () => $('archivo-importar').click());

$('archivo-importar').addEventListener('change', (ev) => {
  const archivo = ev.target.files[0];
  ev.target.value = '';
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = async () => {
    let copia;
    try {
      copia = JSON.parse(lector.result);
      if (!copia || !Array.isArray(copia.presupuestos)) throw new Error('formato');
    } catch (e) {
      preguntar('Ese archivo no es una copia de seguridad válida.', [{ texto: 'Entendido', clase: 'btn-azul' }]);
      return;
    }
    const ok = await preguntar(`La copia tiene ${copia.presupuestos.length} presupuesto(s).\nSe añadirán a los que ya hay (no se borra nada).\n¿Seguir?`, [
      { texto: 'Sí, recuperar', clase: 'btn-verde', valor: true },
      { texto: 'Cancelar', clase: 'btn-gris', valor: false },
    ]);
    if (!ok) return;
    let nuevos = 0;
    for (const p of copia.presupuestos) {
      if (!p || !p.id || !p.cliente || !Array.isArray(p.partidas)) continue;
      const i = datos.presupuestos.findIndex((x) => x.id === p.id);
      if (i === -1) { datos.presupuestos.push(p); nuevos++; }
      else if ((p.modificado || 0) > (datos.presupuestos[i].modificado || 0)) datos.presupuestos[i] = p;
    }
    if (!datos.empresa.nombre && copia.empresa) datos.empresa = Object.assign(empresaVacia(), copia.empresa);
    guardarDatos();
    pintarLista();
    avisar(`✓ Copia recuperada (${nuevos} presupuesto(s) nuevos)`, 5000);
  };
  lector.readAsText(archivo);
});

/* ---------------- Mensajes ---------------- */

// Abre la ventana de mensajes. Devuelve la función para cerrarla con un valor.
let cerrarDialogo = null;
function abrirDialogo(texto, resolver) {
  if (cerrarDialogo) cerrarDialogo(undefined);
  $('dialogo-texto').textContent = texto;
  $('dialogo-extra').innerHTML = '';
  $('dialogo-botones').innerHTML = '';
  const cerrar = (valor) => {
    if (cerrarDialogo !== cerrar) return;
    cerrarDialogo = null;
    $('dialogo-fondo').hidden = true;
    resolver(valor);
  };
  cerrarDialogo = cerrar;
  $('dialogo-fondo').hidden = false;
  $('dialogo-fondo').querySelector('.dialogo').scrollTop = 0;
  return cerrar;
}

// La ✕, la tecla Escape o pulsar fuera de la ventana la cierran sin hacer nada
$('dialogo-cerrar').addEventListener('click', () => { if (cerrarDialogo) cerrarDialogo(undefined); });
$('dialogo-fondo').addEventListener('click', (e) => {
  if (e.target === $('dialogo-fondo') && cerrarDialogo) cerrarDialogo(undefined);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cerrarDialogo) cerrarDialogo(undefined);
});

function preguntar(texto, botones) {
  return new Promise((resolver) => {
    const cerrar = abrirDialogo(texto, resolver);
    const cont = $('dialogo-botones');
    for (const b of botones) {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.clase || 'btn-gris');
      btn.textContent = b.texto;
      btn.addEventListener('click', () => cerrar(b.valor));
      cont.appendChild(btn);
    }
    cont.firstElementChild.focus();
  });
}

let temporizadorAviso = null;
function avisar(texto, ms = 3000) {
  const el = $('aviso-flotante');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { el.hidden = true; }, ms);
}

/* ---------------- Arranque ---------------- */

window.addEventListener('beforeunload', () => { if (temporizadorGuardar) guardarAhora(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && temporizadorGuardar) guardarAhora(); });

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

Corrector.setActivo(datos.empresa.corrector !== false);
for (const id of ['p-notas', 'c-direccion', 'c-obra', 'e-notas']) Corrector.activarCorrector($(id));

history.replaceState({ pantalla: 'inicio' }, '');
mostrar('inicio');
pintarLista();
if (!datos.empresa.nombre) abrirEmpresa(true);
