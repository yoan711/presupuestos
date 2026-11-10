/* =========================================================
   Genera el presupuesto en formato Word (.docx) para poder
   cambiarlo a mano en Word o Google Docs.
   Usa las funciones de app.js (euros, fechaLegible, etc.).
   ========================================================= */
'use strict';

async function generarWord(p) {
  const e = datos.empresa;
  const AZUL = '1F5F8B';
  const GRIS = '5A5A5A';
  const ANCHO = 10205; // ancho útil A4 con márgenes de 1,5 cm (en twips)

  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Un trozo de texto. Los saltos de línea se respetan.
  function run(texto, o = {}) {
    const props = [
      o.negrita ? '<w:b/>' : '',
      o.cursiva ? '<w:i/>' : '',
      o.color ? `<w:color w:val="${o.color}"/>` : '',
      o.tam ? `<w:sz w:val="${o.tam * 2}"/><w:szCs w:val="${o.tam * 2}"/>` : '',
    ].join('');
    const partes = String(texto ?? '').split('\n');
    return partes.map((t, i) =>
      `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`
    ).join('');
  }

  function parrafo(contenido, o = {}) {
    const props = [
      o.alin ? `<w:jc w:val="${o.alin}"/>` : '',
      `<w:spacing w:before="${o.antes || 0}" w:after="${o.despues ?? 0}"/>`,
    ].join('');
    return `<w:p><w:pPr>${props}</w:pPr>${contenido}</w:p>`;
  }

  function celda(contenido, ancho, o = {}) {
    const bordes = o.bordes === false
      ? '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>'
      : (o.bordeArriba ? '<w:tcBorders><w:top w:val="single" w:sz="6" w:color="969696"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>' : '');
    return `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/>${bordes}` +
      `${o.fondo ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fondo}"/>` : ''}` +
      `<w:vAlign w:val="${o.vAlin || 'center'}"/></w:tcPr>${contenido}</w:tc>`;
  }

  function tabla(filas, anchos, o = {}) {
    const borde = o.sinBordes
      ? '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
      : '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D2D2D2"/><w:left w:val="single" w:sz="4" w:color="D2D2D2"/><w:bottom w:val="single" w:sz="4" w:color="D2D2D2"/><w:right w:val="single" w:sz="4" w:color="D2D2D2"/><w:insideH w:val="single" w:sz="4" w:color="D2D2D2"/><w:insideV w:val="single" w:sz="4" w:color="D2D2D2"/></w:tblBorders>';
    const total = anchos.reduce((a, b) => a + b, 0);
    return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${o.alin ? `<w:jc w:val="${o.alin}"/>` : ''}${borde}` +
      `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
      `<w:tblGrid>${anchos.map((a) => `<w:gridCol w:w="${a}"/>`).join('')}</w:tblGrid>${filas.join('')}</w:tbl>`;
  }

  const fila = (celdas, cabecera) => `<w:tr>${cabecera ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${celdas.join('')}</w:tr>`;

  // ---------- Logo ----------
  let logoXml = '';
  let logoBytes = null;
  if (e.logo) {
    try {
      const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = e.logo; });
      const EMU_MM = 36000;
      let alto = 24 * EMU_MM;
      let ancho = alto * img.width / img.height;
      if (ancho > 55 * EMU_MM) { ancho = 55 * EMU_MM; alto = ancho * img.height / img.width; }
      ancho = Math.round(ancho); alto = Math.round(alto);
      logoBytes = Uint8Array.from(atob(e.logo.split(',')[1]), (c) => c.charCodeAt(0));
      logoXml = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${ancho}" cy="${alto}"/>` +
        `<wp:docPr id="1" name="Logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:nvPicPr><pic:cNvPr id="1" name="logo.jpg"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${ancho}" cy="${alto}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
        `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    } catch (err) { logoXml = ''; logoBytes = null; }
  }

  // ---------- Cabecera: empresa (izquierda) y datos del presupuesto (derecha) ----------
  const lineasEmpresa = [
    e.responsable,
    e.nif ? 'NIF: ' + e.nif : '',
    e.direccion,
    e.poblacion,
    [e.telefono ? 'Tel.: ' + e.telefono : '', e.email].filter(Boolean).join('  ·  '),
  ].filter(Boolean);

  let izq = '';
  if (logoXml) izq += parrafo(logoXml, { despues: 80 });
  izq += parrafo(run(e.nombre || '', { negrita: true, color: AZUL, tam: 16 }), { despues: 60 });
  for (const l of lineasEmpresa) izq += parrafo(run(l, { color: GRIS, tam: 9 }));

  const validez = parseInt(e.validez, 10);
  let der = parrafo(run('PRESUPUESTO', { negrita: true, color: AZUL, tam: 22 }), { alin: 'right', despues: 120 });
  const datosDoc = [['Nº: ', p.numero], ['Fecha: ', fechaLegible(p.fecha)]];
  if (validez > 0 && p.fecha) datosDoc.push(['Válido hasta: ', fechaLegible(sumarDias(p.fecha, validez))]);
  for (const [k, v] of datosDoc) der += parrafo(run(k, { negrita: true }) + run(v), { alin: 'right' });

  let cuerpo = tabla([fila([
    celda(izq, 6205, { bordes: false, vAlin: 'top' }),
    celda(der, 4000, { bordes: false, vAlin: 'top' }),
  ])], [6205, 4000], { sinBordes: true });

  // línea azul
  cuerpo += `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="${AZUL}"/></w:pBdr><w:spacing w:after="240"/></w:pPr></w:p>`;

  // ---------- Cliente ----------
  const c = p.cliente;
  const filasCliente = [
    ['Cliente:', c.nombre], ['DNI / NIF:', c.nif], ['Dirección:', c.direccion],
    ['Teléfono:', c.telefono], ['Lugar de la obra:', c.obra],
  ].filter(([, v]) => v && v.trim());
  if (filasCliente.length) {
    let caja = parrafo(run('DATOS DEL CLIENTE', { negrita: true, color: AZUL, tam: 8.5 }), { despues: 80 });
    for (const [k, v] of filasCliente) {
      caja += parrafo(run(k + '  ', { negrita: true, color: GRIS }) + run(v.trim()), { despues: 30 });
    }
    cuerpo += tabla([fila([celda(caja, ANCHO, { fondo: 'F2F5F8' })])], [ANCHO]);
    cuerpo += parrafo('', { despues: 200 });
  }

  // ---------- Tabla de trabajos ----------
  const anchos = [5205, 1100, 800, 1500, 1600];
  const cab = ['Descripción del trabajo', 'Cantidad', 'Ud.', 'Precio', 'Importe'];
  const filas = [fila(cab.map((t, i) =>
    celda(parrafo(run(t, { negrita: true, color: 'FFFFFF' }), { alin: 'center' }), anchos[i], { fondo: AZUL })
  ), true)];
  p.partidas.filter(partidaTieneContenido).forEach((x, n) => {
    const precio = leerNumero(x.precio);
    const fondo = n % 2 ? 'F8F8F6' : undefined;
    const valores = [
      [x.desc.trim(), 'left'],
      [formatoCantidad(cantidadDe(x)), 'right'],
      [x.unidad, 'center'],
      [isNaN(precio) ? '' : euros(precio), 'right'],
      [euros(importeDe(x)), 'right'],
    ];
    filas.push(fila(valores.map(([t, alin], i) =>
      celda(parrafo(run(t, { negrita: i === 4 }), { alin }), anchos[i], { fondo })
    )));
  });
  cuerpo += tabla(filas, anchos);
  cuerpo += parrafo('', { despues: 200 });

  // ---------- Totales ----------
  const t = calcularTotales(p);
  const filasTot = [['Base imponible', euros(t.base)]];
  if (Number(p.iva)) filasTot.push([`IVA (${p.iva} %)`, euros(t.iva)]);
  // misma anchura que la tabla de trabajos: una columna vacía a la izquierda
  const anchosTot = [ANCHO - 4536, 2700, 1836];
  const hueco = () => celda(parrafo(''), anchosTot[0], { bordes: false });
  const tot = filasTot.map(([k, v]) => fila([
    hueco(),
    celda(parrafo(run(k, { color: GRIS })), anchosTot[1], { bordes: false }),
    celda(parrafo(run(v), { alin: 'right' }), anchosTot[2], { bordes: false }),
  ]));
  tot.push(fila([
    hueco(),
    celda(parrafo(run(Number(p.iva) ? 'TOTAL (IVA incl.)' : 'TOTAL', { negrita: true, color: 'FFFFFF', tam: 13 })), anchosTot[1], { fondo: AZUL, bordes: false }),
    celda(parrafo(run(euros(t.total), { negrita: true, color: 'FFFFFF', tam: 13 }), { alin: 'right' }), anchosTot[2], { fondo: AZUL, bordes: false }),
  ]));
  cuerpo += tabla(tot, anchosTot, { sinBordes: true });

  // ---------- Notas ----------
  const notas = [p.notas, e.notas].map((s) => (s || '').trim()).filter(Boolean).join('\n\n');
  if (notas) {
    cuerpo += parrafo(run('OBSERVACIONES Y CONDICIONES', { negrita: true, color: AZUL }), { antes: 360, despues: 80 });
    cuerpo += parrafo(run(notas, { tam: 9.5 }));
  }

  // ---------- Firmas ----------
  cuerpo += parrafo('', { antes: 900 });
  cuerpo += tabla([fila([
    celda(parrafo(run('Conforme del cliente', { color: GRIS, tam: 9 }), { alin: 'center' }), 4000, { bordeArriba: true }),
    celda(parrafo(''), 2205, { bordes: false }),
    celda(parrafo(run('Firma de la empresa', { color: GRIS, tam: 9 }), { alin: 'center' }), 4000, { bordeArriba: true }),
  ])], [4000, 2205, 4000], { sinBordes: true });

  // ---------- Pie de página ----------
  const pie = [e.nombre, e.telefono, e.email].filter(Boolean).join('  ·  ');
  const pieXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${ANCHO}"/></w:tabs></w:pPr>${run(pie, { color: '8C8C8C', tam: 8 })}<w:r><w:rPr><w:color w:val="8C8C8C"/><w:sz w:val="16"/></w:rPr><w:tab/><w:t xml:space="preserve">Presupuesto ${esc(p.numero)}</w:t></w:r></w:p>
</w:ftr>`;

  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${cuerpo}<w:p/>
<w:sectPr><w:footerReference w:type="default" r:id="rIdPie"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;

  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="191919"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpg" ContentType="image/jpeg"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdPie" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
${logoBytes ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.jpg"/>' : ''}
</Relationships>`);
  zip.file('word/document.xml', documento);
  zip.file('word/styles.xml', estilos);
  zip.file('word/footer1.xml', pieXml);
  if (logoBytes) zip.file('word/media/logo.jpg', logoBytes);

  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

async function descargarWord(p) {
  const blob = await generarWord(p);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombreArchivo(p).replace(/\.pdf$/, '.docx');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
