# proHS · Sitio de presentación

Sitio estático (HTML, CSS y JavaScript, sin dependencias ni instalación) que muestra todo lo que puede hacer **proHS**, el sistema de seguridad e higiene para obras de construcción.

## Publicarlo en GitHub Pages

1. Creá un repositorio nuevo en GitHub (por ejemplo `prohs`).
2. Subí **el contenido de esta carpeta** a la raíz del repositorio (`index.html`, `assets/`, `.nojekyll`, `README.md`). Para subir todo de una vez, con subcarpetas, usá la herramienta `Subir-a-GitHub.html`.
3. Entrá en **Settings → Pages**.
4. En *Build and deployment* elegí **Deploy from a branch**, rama `main` y carpeta `/ (root)`.
5. Guardá. En un par de minutos el sitio queda en `https://TU-USUARIO.github.io/prohs/`.

## Qué editar

- **Datos de contacto y presentación:** sección `#autor` y `#contacto` de `index.html` (email, WhatsApp, formación).
- **Foto:** reemplazá `assets/img/autor.jpg` (proporción vertical 2:3).
- **Módulos y capturas:** `assets/js/catalog.js`. Las capturas grandes están en `assets/img/full/` y las miniaturas en `assets/img/thumb/`.
- **Imagen al compartir en redes:** `assets/img/og.jpg`. Para que WhatsApp, LinkedIn y otras redes la muestren, cambiá en el `<head>` la ruta de `og:image` por la URL completa, por ejemplo `https://TU-USUARIO.github.io/prohs/assets/img/og.jpg`.

## Notas

- Las capturas y los informes usan datos ficticios del Modo demo.
- Probado en Chrome (pantalla de escritorio y de celular). Respeta la preferencia de "reducir movimiento" del sistema.
- Peso total aproximado: 35 MB (las capturas ampliables son las que más pesan).
