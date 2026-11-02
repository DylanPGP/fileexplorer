import {NativeModules, PermissionsAndroid, Platform} from 'react-native';

const Native = NativeModules.FileTools;

if (!Native) {
  throw new Error(
    'No se encontró el módulo nativo FileTools. Recompila la app Android.',
  );
}

const meta = m => [m.encoding, m.bom, m.crlf];

/** Capa fina sobre el módulo nativo. Todas las rutas son rutas reales del sistema. */
export const FS = {
  getRoots: () => Native.getRoots(),
  list: path => Native.list(path),
  createFolder: (parent, name) => Native.createFolder(parent, name),
  createFile: (parent, name) => Native.createFile(parent, name),
  rename: (path, newName) => Native.rename(path, newName),
  copy: (src, destDir) => Native.copy(src, destDir),
  move: (src, destDir) => Native.move(src, destDir),
  remove: path => Native.remove(path),
  search: (root, query) => Native.search(root, query),
  cancelSearch: () => Native.cancelSearch(),
  readText: path => Native.readText(path),
  writeText: (path, text, m) => Native.writeText(path, text, ...meta(m)),
  saveTextAs: (dir, name, text, m) =>
    Native.saveTextAs(dir, name, text, ...meta(m)),
  setClipboard: text => Native.setClipboard(text),
  getClipboard: () => Native.getClipboard(),
  openExternal: path => Native.openExternal(path),
  hasAllFilesAccess: () => Native.hasAllFilesAccess(),
  requestAllFilesAccess: () => Native.requestAllFilesAccess(),
  openAppSettings: () => Native.openAppSettings(),
  getPref: key => Native.getPref(key),
  setPref: (key, value) => Native.setPref(key, value),
  pdfPageCount: path => Native.pdfPageCount(path),
  pdfRenderPage: (path, index, width) =>
    Native.pdfRenderPage(path, index, width),
  clearPdfCache: () => Native.clearPdfCache(),
};

/**
 * Solicita acceso al almacenamiento compartido.
 * - Android 11+: abre la pantalla oficial "Acceso a todos los archivos".
 *   El resultado se comprueba al volver a la app.
 * - Android 10 o anterior: diálogo estándar de permisos.
 * Devuelve true si el acceso ya está concedido al terminar.
 */
export async function requestStorageAccess() {
  if (Platform.OS !== 'android') {
    return false;
  }
  if (Platform.Version >= 30) {
    await FS.requestAllFilesAccess();
    return FS.hasAllFilesAccess();
  }
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  ]);
  const values = Object.values(result);
  if (values.includes(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
    await FS.openAppSettings();
  }
  return FS.hasAllFilesAccess();
}
