# Presupuestos — instrucciones

App para hacer, guardar, modificar, descargar en PDF e imprimir presupuestos.
Funciona sin internet una vez instalada. Los datos se guardan **en el propio Chromebook**.

## 1. Publicarla (una sola vez, la haces tú)

Para poder *instalarla* en el Chromebook, Chrome exige que la app esté en una dirección `https://`.
La forma gratuita más sencilla es **GitHub Pages**:

1. Crea una cuenta en https://github.com (si no la tienes).
2. Pulsa **New repository** → nombre: `presupuestos` → **Public** → *Create repository*.
3. En la página del repositorio: **uploading an existing file** → arrastra TODO el contenido
   de esta carpeta (`index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `sw.js`,
   y las carpetas `lib` e `icons`) → **Commit changes**.
4. Ve a **Settings → Pages** → *Source*: `Deploy from a branch` → Branch: `main` / `(root)` → **Save**.
5. En 1–2 minutos estará en: `https://TU-USUARIO.github.io/presupuestos/`

> Los presupuestos **no** se suben a internet: solo se publica la app vacía.
> Cada equipo guarda sus propios datos.

## 2. Instalarla en el Chromebook

1. Abre Chrome y entra en la dirección `https://TU-USUARIO.github.io/presupuestos/`.
2. Pulsa el icono de **instalar** que aparece a la derecha de la barra de direcciones
   (una pantallita con una flecha), o menú ⋮ → **Transmitir, guardar y compartir → Instalar página como aplicación**.
3. Aparecerá **"Presupuestos"** en el menú de aplicaciones. Clic derecho → **Fijar** para tenerla en la barra de abajo.

## 3. Uso (para tus padres)

- **La primera vez** pide los datos de la empresa (nombre, NIF, teléfono, logo…). Solo una vez.
- **Botón verde "Hacer un presupuesto nuevo"** → rellenar cliente, trabajos y elegir IVA.
  Se guarda solo, no hay que darle a guardar.
- **Modificar uno**: en la pantalla de inicio, pulsar sobre el presupuesto (o buscarlo por nombre).
- **Descargar PDF**: va a la carpeta *Descargas* del Chromebook (desde ahí se puede mandar por WhatsApp o correo).
- **Imprimir**: abre el presupuesto y la ventana de impresión directamente.
- **"Más…"**: hacer una copia (para un trabajo parecido) o borrar.
- **"Elegir de la lista de trabajos"**: trabajos típicos ya escritos + los ya usados con su último precio, con buscador.
- **Corrector automático**: al terminar cada palabra corrige acentos, ñ, b/v, h, z/s… (bano → baño,
  ormigon → hormigón). Se puede desactivar en "Datos de mi empresa".
- **Subrayado rojo de Chrome** en el Chromebook: Configuración → Avanzado → Idiomas y entrada → Idiomas →
  añadir **Español** y activar el **Corrector ortográfico** para Español. Clic derecho sobre la palabra subrayada → elegir la correcta.
- **Copia de seguridad** (abajo en el inicio): guarda un archivo con todo. Recomendado una vez al mes,
  guardarlo en Google Drive. Si se cambia de ordenador o se borra Chrome, con ese archivo se recupera todo.

## Actualizar la app

Si cambias algún archivo, súbelo de nuevo a GitHub y cambia `presupuestos-v1` por `presupuestos-v2`
en `sw.js`. Los Chromebooks recibirán la versión nueva al abrir la app con internet.
