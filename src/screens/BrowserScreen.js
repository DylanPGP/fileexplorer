import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator, Alert, BackHandler, FlatList, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import {FS} from '../fs';
import {useTheme} from '../theme';
import {useToast} from '../components/Toast';
import ActionSheet from '../components/ActionSheet';
import PromptModal from '../components/PromptModal';
import FileIcon from '../components/FileIcon';
import {CopyIcon, MoreIcon, SearchIcon} from '../components/Icons';
import {
  breadcrumbs, formatDate, formatSize, kindOf, parentPath, sortEntries,
} from '../utils';

const THEME_LABEL = {system: 'Automático', light: 'Claro', dark: 'Oscuro'};
const NEXT_THEME = {system: 'light', light: 'dark', dark: 'system'};

export default function BrowserScreen({
  active, settings, updateSettings, onOpenViewer, refreshSignal,
}) {
  const t = useTheme();
  const toast = useToast();

  const [roots, setRoots] = useState([]);
  const [path, setPath] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [initError, setInitError] = useState(null);
  const [clip, setClip] = useState(null); // {path, name, mode: 'copy' | 'move'}
  const [busy, setBusy] = useState(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchTick, setSearchTick] = useState(0);
  const [menu, setMenu] = useState(null);
  const [prompt, setPrompt] = useState(null);

  const reqRef = useRef(0);
  const listRef = useRef(null);
  const crumbRef = useRef(null);
  const latest = useRef({});

  // ---------------------------------------------------------------- carga

  async function init() {
    setInitError(null);
    setLoading(true);
    try {
      const r = await FS.getRoots();
      setRoots(r);
      const list = await FS.list(r[0].path);
      setEntries(list);
      setPath(r[0].path);
    } catch (e) {
      setInitError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    init();
  }, []);

  async function openDir(p) {
    setLoading(true);
    try {
      const list = await FS.list(p);
      setEntries(list);
      setPath(p);
      setSearching(false);
      setQuery('');
      setResults(null);
      if (listRef.current) {
        listRef.current.scrollToOffset({offset: 0, animated: false});
      }
    } catch (e) {
      toast.show(e.message, null, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function reload() {
    if (!path) {
      return;
    }
    try {
      setEntries(await FS.list(path));
    } catch (e) {
      toast.show(e.message, null, 'error');
    }
  }

  async function afterChange() {
    await reload();
    if (searching) {
      setSearchTick(x => x + 1);
    }
  }

  latest.current = {afterChange};
  const firstSignal = useRef(true);
  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    if (latest.current.afterChange) {
      latest.current.afterChange();
    }
  }, [refreshSignal]);

  // ---------------------------------------------------------------- búsqueda

  useEffect(() => {
    if (!searching || !path) {
      return undefined;
    }
    const q = query.trim();
    const my = ++reqRef.current;
    if (!q) {
      FS.cancelSearch();
      setResults(null);
      setSearchBusy(false);
      return undefined;
    }
    setSearchBusy(true);
    const timer = setTimeout(async () => {
      try {
        const r = await FS.search(path, q);
        if (reqRef.current === my && !r.cancelled) {
          setResults(r);
        }
      } catch (e) {
        if (reqRef.current === my) {
          toast.show(e.message, null, 'error');
        }
      } finally {
        if (reqRef.current === my) {
          setSearchBusy(false);
        }
      }
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searching, path, searchTick]);

  function exitSearch() {
    reqRef.current++;
    FS.cancelSearch();
    setSearching(false);
    setQuery('');
    setResults(null);
    setSearchBusy(false);
  }

  // ---------------------------------------------------------------- atrás

  const isRoot = !!path && roots.some(r => r.path === path);
  latest.current.back = () => {
    if (searching) {
      exitSearch();
      return true;
    }
    if (path && !isRoot) {
      openDir(parentPath(path));
      return true;
    }
    return false;
  };
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () =>
      latest.current.back(),
    );
    return () => sub.remove();
  }, [active]);

  // ---------------------------------------------------------------- datos derivados

  const crumbs = useMemo(() => breadcrumbs(path, roots), [path, roots]);

  const shown = useMemo(() => {
    if (searching) {
      return results ? results.items : [];
    }
    let list = entries;
    if (!settings.showHidden) {
      list = list.filter(e => !e.name.startsWith('.'));
    }
    return sortEntries(list, settings.sortBy);
  }, [searching, results, entries, settings.showHidden, settings.sortBy]);

  // ---------------------------------------------------------------- acciones

  async function copyPath(p, message) {
    try {
      await FS.setClipboard(p);
      toast.show(message, p);
    } catch (e) {
      toast.show(e.message, null, 'error');
    }
  }

  async function openExternal(e) {
    try {
      await FS.openExternal(e.path);
    } catch (err) {
      toast.show(err.message, null, 'error');
    }
  }

  function openAsText(e) {
    onOpenViewer({type: 'editor', path: e.path});
  }

  function openFile(e) {
    const k = kindOf(e);
    if (k === 'text') {
      openAsText(e);
    } else if (k === 'image') {
      onOpenViewer({type: 'image', path: e.path});
    } else if (k === 'pdf') {
      onOpenViewer({type: 'pdf', path: e.path});
    } else {
      Alert.alert(
        e.name,
        'Este tipo de archivo no tiene visor integrado. ¿Qué quieres hacer?',
        [
          {text: 'Abrir como texto', onPress: () => openAsText(e)},
          {text: 'Abrir con otra app', onPress: () => openExternal(e)},
          {text: 'Cancelar', style: 'cancel'},
        ],
      );
    }
  }

  function pressItem(e) {
    if (e.isDirectory) {
      openDir(e.path);
    } else {
      openFile(e);
    }
  }

  function startClip(e, mode) {
    setClip({path: e.path, name: e.name, mode});
    toast.show(
      mode === 'copy' ? 'Listo para copiar' : 'Listo para mover',
      'Abre la carpeta de destino y pulsa «Pegar aquí»',
    );
  }

  async function paste() {
    if (!clip || !path) {
      return;
    }
    const verb = clip.mode === 'copy' ? 'Copiando' : 'Moviendo';
    setBusy(verb + '…');
    try {
      const fn = clip.mode === 'copy' ? FS.copy : FS.move;
      const np = await fn(clip.path, path);
      toast.show(clip.mode === 'copy' ? 'Copiado' : 'Movido', np);
      if (clip.mode === 'move') {
        setClip(null);
      }
      await afterChange();
    } catch (e) {
      toast.show(e.message, null, 'error');
    } finally {
      setBusy(null);
    }
  }

  function askDelete(e) {
    Alert.alert(
      'Eliminar',
      '¿Eliminar «' + e.name + '»' +
        (e.isDirectory ? ' y todo su contenido' : '') +
        '? Esta acción no se puede deshacer.',
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setBusy('Eliminando…');
            try {
              await FS.remove(e.path);
              if (clip && (clip.path === e.path || clip.path.startsWith(e.path + '/'))) {
                setClip(null);
              }
              toast.show('Eliminado', e.name);
              await afterChange();
            } catch (err) {
              toast.show(err.message, null, 'error');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  function showInfo(e) {
    const kind = e.isDirectory ? 'Carpeta' : 'Archivo';
    const lines = [
      'Tipo: ' + kind,
      'Ruta: ' + e.path,
      e.isDirectory ? null : 'Tamaño: ' + formatSize(e.size) + ' (' + e.size + ' bytes)',
      'Modificado: ' + formatDate(e.modified),
    ].filter(Boolean);
    Alert.alert(e.name, lines.join('\n'));
  }

  async function handlePrompt(value) {
    const p = prompt;
    setPrompt(null);
    try {
      if (p.kind === 'newFolder') {
        await FS.createFolder(path, value);
        toast.show('Carpeta creada', value);
      } else if (p.kind === 'newFile') {
        await FS.createFile(path, value);
        toast.show('Archivo creado', value);
      } else if (p.kind === 'rename') {
        await FS.rename(p.entry.path, value);
        toast.show('Renombrado', value);
      }
      await afterChange();
    } catch (e) {
      toast.show(e.message, null, 'error');
    }
  }

  // ---------------------------------------------------------------- menús

  function buildSheet() {
    if (!menu) {
      return null;
    }
    if (menu.kind === 'item') {
      const e = menu.entry;
      const isText = kindOf(e) === 'text';
      const actions = [
        {
          label: e.isDirectory ? 'Abrir carpeta' : 'Abrir',
          onPress: () => pressItem(e),
        },
        {
          label: 'Copiar ruta',
          onPress: () =>
            copyPath(
              e.path,
              e.isDirectory ? 'Ruta de la carpeta copiada' : 'Ruta del archivo copiada',
            ),
        },
        {label: 'Copiar elemento', onPress: () => startClip(e, 'copy')},
        {label: 'Mover elemento', onPress: () => startClip(e, 'move')},
        {
          label: 'Renombrar',
          onPress: () =>
            setPrompt({
              kind: 'rename',
              entry: e,
              title: 'Renombrar',
              initial: e.name,
              confirmLabel: 'Renombrar',
            }),
        },
      ];
      if (!e.isDirectory && !isText) {
        actions.push({label: 'Abrir como texto', onPress: () => openAsText(e)});
      }
      if (!e.isDirectory) {
        actions.push({label: 'Abrir con otra app', onPress: () => openExternal(e)});
      }
      actions.push({label: 'Información', onPress: () => showInfo(e)});
      actions.push({label: 'Eliminar', danger: true, onPress: () => askDelete(e)});
      return {title: e.name, subtitle: e.path, actions};
    }
    if (menu.kind === 'fab') {
      return {
        title: 'Crear en esta carpeta',
        subtitle: path,
        actions: [
          {
            label: 'Nueva carpeta',
            onPress: () =>
              setPrompt({kind: 'newFolder', title: 'Nueva carpeta', confirmLabel: 'Crear'}),
          },
          {
            label: 'Nuevo archivo',
            onPress: () =>
              setPrompt({
                kind: 'newFile',
                title: 'Nuevo archivo',
                message: 'Escribe el nombre con su extensión, p. ej. notas.txt',
                confirmLabel: 'Crear',
              }),
          },
        ],
      };
    }
    if (menu.kind === 'sort') {
      const opt = (label, key) => ({
        label,
        checked: settings.sortBy === key,
        onPress: () => updateSettings({sortBy: key}),
      });
      return {
        title: 'Ordenar por',
        actions: [
          opt('Nombre', 'name'),
          opt('Fecha de modificación', 'date'),
          opt('Tamaño', 'size'),
        ],
      };
    }
    if (menu.kind === 'roots') {
      return {
        title: 'Almacenamiento',
        actions: roots.map(r => ({
          label: r.label,
          checked: path === r.path || (path || '').startsWith(r.path + '/'),
          onPress: () => openDir(r.path),
        })),
      };
    }
    // menú principal
    const actions = [];
    if (roots.length > 1) {
      actions.push({
        label: 'Cambiar de almacenamiento',
        onPress: () => setMenu({kind: 'roots'}),
      });
    }
    actions.push({label: 'Ordenar por…', onPress: () => setMenu({kind: 'sort'})});
    actions.push({
      label: settings.showHidden ? 'Ocultar archivos ocultos' : 'Mostrar archivos ocultos',
      onPress: () => updateSettings({showHidden: !settings.showHidden}),
    });
    actions.push({
      label: 'Tema: ' + THEME_LABEL[settings.theme] + ' (cambiar)',
      onPress: () => updateSettings({theme: NEXT_THEME[settings.theme]}),
    });
    actions.push({label: 'Actualizar', onPress: () => reload()});
    actions.push({
      label: 'Permisos y ayuda',
      onPress: () =>
        Alert.alert(
          'Permisos',
          'La app usa el acceso a todos los archivos que concediste en los ajustes de Android. ' +
            'Android bloquea Android/data y Android/obb de otras apps; no se puede evitar sin root, Shizuku o ADB. ' +
            'La app no tiene permiso de internet y todo se procesa en tu dispositivo.',
          [
            {text: 'Cerrar', style: 'cancel'},
            {text: 'Abrir ajustes', onPress: () => FS.openAppSettings()},
          ],
        ),
    });
    return {actions};
  }

  const sheet = buildSheet();
  const folderName = crumbs.length ? crumbs[crumbs.length - 1].label : 'Archivos';

  // ---------------------------------------------------------------- render

  function renderItem({item}) {
    const kind = kindOf(item);
    let sub;
    if (searching) {
      const rel = parentPath(item.path).slice(path.length).replace(/^\//, '');
      sub = 'en ' + (rel || folderName) + (item.isDirectory ? '' : ' · ' + formatSize(item.size));
    } else {
      sub =
        (item.isDirectory ? 'Carpeta' : formatSize(item.size)) +
        ' · ' + formatDate(item.modified);
    }
    return (
      <Pressable
        android_ripple={{color: t.border}}
        onPress={() => pressItem(item)}
        onLongPress={() => setMenu({kind: 'item', entry: item})}
        style={styles.row}>
        <FileIcon kind={kind} name={item.name} />
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={[styles.name, {color: t.text}]}>
            {item.name}
          </Text>
          <Text numberOfLines={1} style={[styles.meta, {color: t.textDim}]}>
            {sub}
          </Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => setMenu({kind: 'item', entry: item})}
          style={styles.rowMenu}>
          <MoreIcon color={t.textDim} size={20} />
        </Pressable>
      </Pressable>
    );
  }

  if (initError) {
    return (
      <View style={[styles.center, {backgroundColor: t.bg}]}>
        <Text style={[styles.emptyTitle, {color: t.text}]}>
          No se pudo leer el almacenamiento
        </Text>
        <Text style={[styles.emptyText, {color: t.textDim}]}>{initError}</Text>
        <Pressable
          onPress={init}
          style={[styles.retry, {backgroundColor: t.primary}]}>
          <Text style={{color: t.onPrimary, fontWeight: '700'}}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  let empty = null;
  if (!loading) {
    if (searching) {
      if (!query.trim()) {
        empty = 'Escribe para buscar en «' + folderName + '» y sus subcarpetas';
      } else if (!searchBusy) {
        empty = 'Sin resultados para «' + query.trim() + '»';
      }
    } else {
      empty = 'Esta carpeta está vacía';
    }
  }

  return (
    <View style={[styles.root, {backgroundColor: t.bg}]}>
      {/* Barra superior */}
      <View style={[styles.header, {backgroundColor: t.surface, borderColor: t.border}]}>
        {searching ? (
          <>
            <Pressable onPress={exitSearch} hitSlop={8} style={styles.hBtn}>
              <Text style={{color: t.text, fontSize: 24}}>←</Text>
            </Pressable>
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => setSearchTick(x => x + 1)}
              placeholder="Buscar en esta carpeta…"
              placeholderTextColor={t.textDim}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              underlineColorAndroid="transparent"
              style={[styles.searchInput, {color: t.text}]}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.hBtn}>
                <Text style={{color: t.textDim, fontSize: 18}}>✕</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Text numberOfLines={1} style={[styles.title, {color: t.text}]}>
              {folderName}
            </Text>
            <Pressable onPress={() => setSearching(true)} hitSlop={8} style={styles.hBtn}>
              <SearchIcon color={t.text} />
            </Pressable>
            <Pressable onPress={() => setMenu({kind: 'more'})} hitSlop={8} style={styles.hBtn}>
              <MoreIcon color={t.text} />
            </Pressable>
          </>
        )}
      </View>

      {/* Ruta actual + copiar */}
      <View style={[styles.pathBox, {backgroundColor: t.surface, borderColor: t.border}]}>
        <View style={styles.pathRow}>
          <ScrollView
            ref={crumbRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={() =>
              crumbRef.current && crumbRef.current.scrollToEnd({animated: false})
            }
            style={{flex: 1}}
            contentContainerStyle={styles.crumbs}>
            {crumbs.map((c, i) => (
              <React.Fragment key={c.path}>
                {i > 0 ? <Text style={{color: t.textDim}}>  ›  </Text> : null}
                <Pressable onPress={() => openDir(c.path)} hitSlop={6}>
                  <Text
                    style={{
                      color: i === crumbs.length - 1 ? t.primary : t.textDim,
                      fontWeight: i === crumbs.length - 1 ? '700' : '500',
                      fontSize: 14,
                    }}>
                    {c.label}
                  </Text>
                </Pressable>
              </React.Fragment>
            ))}
          </ScrollView>
          <Pressable
            onPress={() => copyPath(path, 'Ruta de la carpeta copiada')}
            style={[styles.copyBtn, {backgroundColor: t.surfaceAlt}]}>
            <CopyIcon color={t.text} bg={t.surfaceAlt} />
            <Text style={[styles.copyText, {color: t.text}]}>Copiar ruta</Text>
          </Pressable>
        </View>
        <Text
          numberOfLines={1}
          ellipsizeMode="middle"
          style={[styles.fullPath, {color: t.textDim}]}>
          {path}
        </Text>
      </View>

      {searching && query.trim() ? (
        <View style={[styles.searchInfo, {borderColor: t.border}]}>
          {searchBusy ? <ActivityIndicator size="small" color={t.primary} /> : null}
          <Text style={{color: t.textDim, fontSize: 12, marginLeft: searchBusy ? 8 : 0}}>
            {searchBusy
              ? 'Buscando…'
              : results
              ? results.items.length + ' resultado(s)' +
                (results.truncated ? ' · límite alcanzado, afina la búsqueda' : '')
              : ''}
          </Text>
        </View>
      ) : null}

      {/* Lista */}
      <FlatList
        ref={listRef}
        data={shown}
        keyExtractor={e => e.path}
        renderItem={renderItem}
        refreshing={pulling}
        onRefresh={async () => {
          setPulling(true);
          await reload();
          setPulling(false);
        }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        contentContainerStyle={{paddingBottom: clip ? 170 : 100}}
        ListEmptyComponent={
          empty ? (
            <Text style={[styles.emptyText, {color: t.textDim, marginTop: 60}]}>
              {empty}
            </Text>
          ) : null
        }
      />

      {loading && !pulling ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={t.primary} />
        </View>
      ) : null}

      {/* Botón crear */}
      {!searching && path ? (
        <Pressable
          onPress={() => setMenu({kind: 'fab'})}
          style={[styles.fab, {backgroundColor: t.primary, bottom: clip ? 96 : 24}]}>
          <Text style={{color: t.onPrimary, fontSize: 30, marginTop: -2}}>+</Text>
        </Pressable>
      ) : null}

      {/* Barra de pegar */}
      {clip ? (
        <View style={[styles.pasteBar, {backgroundColor: t.surface, borderColor: t.border}]}>
          <View style={{flex: 1}}>
            <Text style={{color: t.textDim, fontSize: 12}}>
              {clip.mode === 'copy' ? 'Copiar' : 'Mover'}
            </Text>
            <Text numberOfLines={1} style={{color: t.text, fontWeight: '600'}}>
              {clip.name}
            </Text>
          </View>
          <Pressable onPress={() => setClip(null)} style={styles.pasteBtn}>
            <Text style={{color: t.textDim, fontWeight: '600'}}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={paste}
            style={[styles.pasteBtn, {backgroundColor: t.primary, borderRadius: 10}]}>
            <Text style={{color: t.onPrimary, fontWeight: '700'}}>Pegar aquí</Text>
          </Pressable>
        </View>
      ) : null}

      {busy ? (
        <View style={[styles.busy, {backgroundColor: t.overlay}]}>
          <View style={[styles.busyCard, {backgroundColor: t.surface}]}>
            <ActivityIndicator color={t.primary} />
            <Text style={{color: t.text, marginLeft: 14, fontSize: 15}}>{busy}</Text>
          </View>
        </View>
      ) : null}

      <ActionSheet
        visible={!!sheet}
        title={sheet ? sheet.title : null}
        subtitle={sheet ? sheet.subtitle : null}
        actions={sheet ? sheet.actions : []}
        onClose={() => setMenu(null)}
      />
      <PromptModal
        visible={!!prompt}
        config={prompt}
        onSubmit={handlePrompt}
        onCancel={() => setPrompt(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28},
  header: {
    height: 58, flexDirection: 'row', alignItems: 'center',
    paddingLeft: 18, paddingRight: 6, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {flex: 1, fontSize: 20, fontWeight: '700'},
  hBtn: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  searchInput: {flex: 1, fontSize: 17, paddingVertical: 8},
  pathBox: {
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pathRow: {flexDirection: 'row', alignItems: 'center'},
  crumbs: {alignItems: 'center', paddingRight: 10},
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    height: 34, borderRadius: 10,
  },
  copyText: {fontSize: 13, fontWeight: '600', marginLeft: 6},
  fullPath: {fontSize: 11, marginTop: 5, fontFamily: 'monospace'},
  searchInfo: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingLeft: 16,
    paddingRight: 4, height: 66,
  },
  rowText: {flex: 1, marginLeft: 14, marginRight: 6},
  name: {fontSize: 15.5, fontWeight: '500'},
  meta: {fontSize: 12, marginTop: 3},
  rowMenu: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  emptyTitle: {fontSize: 18, fontWeight: '700', textAlign: 'center'},
  emptyText: {fontSize: 14, textAlign: 'center', paddingHorizontal: 30, marginTop: 8},
  retry: {marginTop: 20, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 12},
  loading: {position: 'absolute', top: 170, left: 0, right: 0, alignItems: 'center'},
  fab: {
    position: 'absolute', right: 20, width: 58, height: 58, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', elevation: 6,
  },
  pasteBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 72,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth, elevation: 10,
  },
  pasteBtn: {paddingHorizontal: 14, paddingVertical: 10, marginLeft: 4},
  busy: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center',
    justifyContent: 'center',
  },
  busyCard: {
    flexDirection: 'row', alignItems: 'center', padding: 22, borderRadius: 16,
  },
});
