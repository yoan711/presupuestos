/* =========================================================
   Corrector automático de faltas habituales
   (acentos, ñ, b/v, h, z/s/c, g/j, letras dobles, "-tion")
   pensado para el vocabulario de obra y presupuestos.
   ========================================================= */
'use strict';

(function () {
  // Palabras bien escritas que conoce el corrector.
  // OJO: no poner palabras que sin acento también existen (esta/está, termino/término…).
  const PALABRAS = `
    albañil albañiles albañilería alicatado alicatados alicatar azulejo azulejos baldosa baldosas baldosín
    baño baños bañera bañeras bovedilla bovedillas viga vigas vigueta viguetas ladrillo ladrillos tabique tabiques
    tabiquería hormigón hormigonado hormigonar cemento mortero yeso escayola enlucido enfoscado enfoscar revoco
    solado solería pavimento pavimentos rodapié rodapiés gres porcelánico porcelánica cerámica cerámico mármol
    granito terrazo parqué tarima laminado pladur placa placas techo techos cubierta cubiertas tejado tejados teja tejas
    canalón canalones bajante bajantes impermeabilización impermeabilizar aislamiento aislante térmico térmica
    acústico acústica humedad humedades grieta grietas fisura fisuras demolición demoliciones derribo desescombro
    escombro escombros contenedor contenedores retirada transporte vertedero andamio andamios fachada fachadas
    muro muros pared paredes suelo suelos cimentación cimientos zapata zapatas forjado forjados pilar pilares
    columna columnas estructura estructural rampa escalera escaleras peldaño peldaños barandilla barandillas
    ventana ventanas puerta puertas marco marcos premarco premarcos persiana persianas cocina cocinas encimera
    fregadero lavabo lavabos inodoro inodoros bidé ducha duchas plato platos mampara mamparas grifería grifo grifos
    fontanería fontanero tubería tuberías tubo tubos desagüe desagües saneamiento arqueta arquetas alcantarillado
    electricidad eléctrico eléctrica eléctricos eléctricas instalación instalaciones enchufe enchufes interruptor
    interruptores cableado iluminación calefacción radiador radiadores caldera climatización ventilación
    pintura pinturas pintado plástica plástico esmalte barniz imprimación masilla lijado alisado gotelé empapelado
    limpieza nivelación nivelar autonivelante recrecido solera mallazo encofrado ferralla acero hierro aluminio
    madera vidrio cristal piedra arena grava árido áridos saco sacos palé palés material materiales mano obra obras
    reforma reformas rehabilitación reparación reparaciones colocación sustitución montaje desmontaje levantado
    picado raspado sellado rejuntado junta juntas silicona adhesivo trabajo trabajos servicio servicios
    presupuesto presupuestos cliente clientes vivienda viviendas garaje terraza terrazas balcón balcones patio patios
    jardín piscina trastero sótano buhardilla salón comedor habitación habitaciones dormitorio dormitorios pasillo
    vestíbulo recibidor galería azotea ático metro metros cuadrado cuadrados lineal lineales cúbico cúbicos unidad
    unidades horas día días semana semanas kilos precio precios incluido incluida incluidos incluidas incluye
    incluyen según también además después través aproximadamente aproximado máximo mínimo pequeño pequeña nuevo
    nueva nuevos nuevas existente existentes antiguo antigua superficie superficies espesor altura anchura longitud
    medición mediciones plazo garantía pago pagos transferencia efectivo factura validez válido condiciones
    observaciones aceptación inicio finalización ejecución móvil teléfono dirección calle avenida número código
    población valla vallado verter vertido vierteaguas vibrado visto bloque bloques boquilla bordillo bordillos
    barra revestimiento revestimientos revestir cubrir lavadero llave llaves válvula bomba vertical horizontal hueco
    huecos herramienta herramientas hilada hidrófugo mampostería celosía albardilla alféizar umbral jamba dintel
    viguería cerramiento cerramientos tabicón chapado aplacado zócalo zócalos encalado cal envejecido preparación
    protección colocado colocada sustituido reparado previa previo posterior aquí allí fácil difícil útil
    acabado acabados acabar mantenimiento revisión inspección urbanización comunidad propietario propietarios
    almacén nave oficina oficinas portal portales ascensor ascensores rampa accesibilidad adaptación aseo aseos
  `.trim().split(/\s+/);

  // Palabras correctas que NUNCA se tocan aunque se parezcan a otras
  const NO_TOCAR = new Set(`
    tuvo tuve vaya valla haya halla aya echo echa echar bello vello bienes vienes votar botar vasto basto
    rebelar revelar grabar gravar sabia savia cabo cavo baca vaca bobina bovina hierba hierva vacia vacio
    vano vanos ola ora olla hoya poyo pollo cien sien casa caza cocer coser abría habría ablando hablando
    bota vota boto voto bale vale baya bello hola hora horno sima cima ves vez
  `.trim().split(/\s+/));

  function sinAcentos(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Nivel 1: solo quita acentos y ñ
  function clave1(s) {
    return sinAcentos(s.toLowerCase());
  }

  // Nivel 2: además iguala letras que suenan igual
  function clave2(s) {
    return clave1(s)
      .replace(/ph/g, 'f')
      .replace(/([^c])h|^h/g, '$1')
      .replace(/w/g, 'b')
      .replace(/v/g, 'b')
      .replace(/tion/g, 'cion')
      .replace(/z/g, 's')
      .replace(/c(?=[ei])/g, 's')
      .replace(/g(?=[ei])/g, 'j')
      .replace(/k/g, 'c')
      .replace(/y$/g, 'i')
      .replace(/(.)\1+/g, '$1');
  }

  const exactas = new Set(PALABRAS.map((p) => p.toLowerCase()));
  const mapa1 = new Map();
  const mapa2 = new Map();
  function anadir(mapa, clave, palabra) {
    const lista = mapa.get(clave) || [];
    if (!lista.includes(palabra)) lista.push(palabra);
    mapa.set(clave, lista);
  }
  for (const p of PALABRAS) {
    anadir(mapa1, clave1(p), p);
    anadir(mapa2, clave2(p), p);
  }

  function mismoFormato(original, correcta) {
    if (original.length > 1 && original === original.toUpperCase()) return correcta.toUpperCase();
    if (original[0] === original[0].toUpperCase()) return correcta[0].toUpperCase() + correcta.slice(1);
    return correcta;
  }

  // Devuelve la palabra corregida, o null si no hay que cambiar nada
  function corregirPalabra(palabra) {
    if (!palabra || palabra.length < 4 || /\d/.test(palabra)) return null;
    const minus = palabra.toLowerCase();
    if (exactas.has(minus) || NO_TOCAR.has(minus)) return null;
    // las palabras con mayúsculas en medio (siglas, marcas) no se tocan
    if (/^.[^A-ZÁÉÍÓÚÑ]*[A-ZÁÉÍÓÚÑ]/.test(palabra) && palabra !== palabra.toUpperCase()) return null;

    let candidatas = mapa1.get(clave1(palabra));
    if (!candidatas) candidatas = mapa2.get(clave2(palabra));
    if (candidatas && candidatas.length === 1) return mismoFormato(palabra, candidatas[0]);

    // Regla general: las palabras acabadas en -cion / -sion llevan tilde (ubicacion → ubicación)
    if (candidatas === undefined && minus.length >= 6) {
      if (/[^aeiou]?cion$/.test(minus) || /sion$/.test(minus)) {
        return palabra.replace(/([cs])i([oO])([nN])$/, (m, a, o, n) => a + 'i' + (o === 'O' ? 'Ó' : 'ó') + n);
      }
      if (/tion$/.test(minus)) {
        // estilo francés: "ubication" → "ubicación"
        return palabra.slice(0, -4) + mismoFormato(palabra.slice(-4), 'ción');
      }
    }
    return null;
  }

  const LETRAS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ';
  const RE_PALABRA = new RegExp(`[${LETRAS}]+`, 'g');
  const RE_ULTIMA = new RegExp(`([${LETRAS}]+)$`);

  function corregirTexto(texto) {
    const cambios = [];
    const nuevo = texto.replace(RE_PALABRA, (p) => {
      const c = corregirPalabra(p);
      if (c && c !== p) { cambios.push([p, c]); return c; }
      return p;
    });
    return { texto: nuevo, cambios };
  }

  let activo = true;
  function avisarCambios(cambios) {
    if (cambios.length && typeof window.avisar === 'function') {
      window.avisar('✏️ Corregido: ' + cambios.map(([a, b]) => `${a} → ${b}`).join(', '), 3500);
    }
  }
  function notificar(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function activarCorrector(el) {
    if (el.dataset.corrector) return;
    el.dataset.corrector = '1';
    el.setAttribute('spellcheck', 'true');
    el.setAttribute('lang', 'es');

    // Al terminar cada palabra (espacio, coma, punto, salto de línea…)
    el.addEventListener('input', (e) => {
      if (!activo || !e.inputType) return;
      const separador = e.inputType === 'insertLineBreak' || (e.inputType === 'insertText' && /^[\s.,;:!?)\]]$/.test(e.data || ''));
      if (!separador) return;
      const fin = el.selectionStart;
      const antes = el.value.slice(0, fin - 1);
      const m = antes.match(RE_ULTIMA);
      if (!m) return;
      const correcta = corregirPalabra(m[1]);
      if (!correcta || correcta === m[1]) return;
      const inicio = antes.length - m[1].length;
      el.setRangeText(correcta, inicio, inicio + m[1].length, 'preserve');
      const nuevaPos = fin + (correcta.length - m[1].length);
      el.setSelectionRange(nuevaPos, nuevaPos);
      avisarCambios([[m[1], correcta]]);
      notificar(el);
    });

    // Al salir de la casilla, repasa todo el texto (por si la última palabra no llevaba espacio)
    el.addEventListener('blur', () => {
      if (!activo) return;
      const r = corregirTexto(el.value);
      if (r.cambios.length) {
        el.value = r.texto;
        avisarCambios(r.cambios);
        notificar(el);
      }
    });
  }

  const api = {
    corregirPalabra,
    corregirTexto,
    activarCorrector,
    setActivo: (v) => { activo = !!v; },
  };
  if (typeof window !== 'undefined') window.Corrector = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
