# Archivos — explorador y editor ligero (React Native, Android)

Explorador de archivos con editor de texto, visor de imágenes y visor de PDF.
Sin anuncios, sin cuentas, sin servidores, sin rastreadores. **La versión release no
declara el permiso INTERNET**, así que la app no puede comunicarse con la red.

## Funciones

- Navegación por el almacenamiento interno y por tarjeta SD/USB (si existe), con migas de pan pulsables y la ruta real completa.
- Crear carpeta/archivo, renombrar, copiar, mover (con «Pegar aquí»), eliminar, buscar (recursivo, cancelable).
- **Copiar rutas**: botón «Copiar ruta» de la carpeta actual; «Copiar ruta» en el menú (⋮ o pulsación larga) de cualquier carpeta o archivo, sin entrar en ellos. Confirmación visible con la ruta copiada.
- Editor de texto (TXT, JSON, HTML, CSS, JS, XML, CSV, MD y muchos más; también cualquier archivo mediante «Abrir como texto»): guardar, guardar como, copiar todo, pegar en el cursor, tamaño de fuente. UTF-8 (con o sin BOM) y Latin-1; conserva saltos de línea CRLF.
- Visor de imágenes (PNG, JPG, GIF, WebP, BMP) con zoom y desplazamiento.
- Visor de PDF con el renderizador integrado de Android (`PdfRenderer`), con zoom.
- Tema claro/oscuro/automático, ordenar por nombre/fecha/tamaño, mostrar u ocultar archivos ocultos. Los ajustes se guardan en el dispositivo.
- «Abrir con otra app» para formatos sin visor integrado.

## Requisitos para compilar

- Node.js 18 o superior
- JDK 17
- Android Studio con Android SDK 34 (Build-Tools 34.0.0) y NDK 26.1.10909125 (Android Studio los descarga si faltan)

## Versiones de compilación (plantilla oficial de React Native 0.74.5)

| Componente | Versión |
|---|---|
| React Native / React | 0.74.5 / 18.2.0 |
| Gradle | 8.6 |
| Android Gradle Plugin | 8.2.1 (lo fija `@react-native/gradle-plugin` 0.74.87) |
| Kotlin | 1.9.24 |
| JDK | 17 |
| Autolinking | `native_modules.gradle` de `@react-native-community/cli-platform-android` (CLI 13) |

No se usan APIs de RN 0.75 o posteriores (`com.facebook.react.settings`, `autolinkLibrariesFromCommand`, `autolinkLibrariesWithApp`).

## Compilar

```bash
npm install
```

**Opción A – Android Studio:** abre la carpeta `android/`, espera la sincronización de Gradle
y usa *Build > Build APK(s)* o *Run*. Android Studio descarga Gradle 8.6 por sí solo.

**Opción B – línea de comandos:** este proyecto no incluye `gradle-wrapper.jar` (es un binario).
Con Gradle 8.6 instalado, genera el wrapper una sola vez:

```bash
cd android
gradle wrapper --gradle-version 8.6
./gradlew assembleRelease      # en Windows: gradlew assembleRelease
```

El APK queda en `android/app/build/outputs/apk/release/app-release.apk`. Es un APK **autónomo**
(el JavaScript va empaquetado), firmado con la clave de depuración que genera Android; para
publicarlo crea tu propio keystore y cámbialo en `android/app/build.gradle`.

**Opción C – GitHub Actions:** sube el proyecto a un repositorio de GitHub; el workflow
`.github/workflows/build-apk.yml` compila el APK en cada push (o manualmente desde la pestaña *Actions >
Compilar APK > Run workflow*). Descarga `archivos-apk` desde los artefactos de la ejecución.

Para desarrollo con recarga en caliente: `npm start` en una terminal y `npm run android` en otra
(requiere el wrapper de Gradle de la opción B y un dispositivo o emulador conectado).

## Permisos

| Permiso | Para qué |
|---|---|
| `MANAGE_EXTERNAL_STORAGE` (Android 11+) | Explorar y editar todo el almacenamiento compartido. Se concede en *Ajustes > Acceso a todos los archivos*. La app abre esa pantalla y explica por qué. |
| `READ_EXTERNAL_STORAGE` (hasta Android 12L) / `WRITE_EXTERNAL_STORAGE` (hasta Android 10) | Equivalente clásico en versiones antiguas, mediante el diálogo estándar. |

Restricciones que se respetan: Android 11+ impide a cualquier app (sin root, Shizuku ni ADB) leer
`Android/data` y `Android/obb` de otras aplicaciones. Al intentar entrar, la app muestra el aviso
de Android en lugar de fingir que funciona.

Nota: Google Play restringe `MANAGE_EXTERNAL_STORAGE`; este proyecto está pensado para instalación directa del APK.

## Límites conocidos

- El editor admite archivos de texto de hasta 1 MB y no tiene deshacer propio (el teclado puede ofrecerlo).
- Las líneas largas se ajustan al ancho de pantalla (sin desplazamiento horizontal).
- Visores de imagen y PDF con zoom por botones (+/−), no por pellizco.
- PDF protegidos con contraseña no se pueden abrir con el visor integrado.
- En Android 10 el acceso depende de `requestLegacyExternalStorage`; el comportamiento puede variar según el fabricante.

## Estructura

```
App.js                      Raíz: tema, permisos, navegación entre explorador y visores
src/fs.js                   Puente JS ↔ módulo nativo (todas las operaciones)
src/utils.js                Tipos de archivo, rutas, formato de tamaños y fechas
src/screens/                Permisos, explorador, editor, visor de imágenes, visor de PDF
src/components/             Menús, diálogos, avisos, iconos
android/.../FileToolsModule.kt   Operaciones de archivos, búsqueda, portapapeles, PDF, permisos
```
