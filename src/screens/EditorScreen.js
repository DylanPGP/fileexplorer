import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator, Alert, BackHandler, Pressable, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import {FS} from '../fs';
import {useTheme} from '../theme';
import {useToast} from '../components/Toast';
import ActionSheet from '../components/ActionSheet';
import PromptModal from '../components/PromptModal';
import ViewerHeader from '../components/ViewerHeader';
import {MoreIcon} from '../components/Icons';
import {baseName, formatSize, parentPath} from '../utils';

export default function EditorScreen({path: initialPath, onClose}) {
  const t = useTheme();
  const toast = useToast();

  const [path, setPath] = useState(initialPath);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [meta, setMeta] = useState({encoding: 'UTF-8', bom: false, crlf: false, size: 0});
  const [fontSize, setFontSize] = useState(14);
  const [menu, setMenu] = useState(false);
  const [askName, setAskName] = useState(false);
  const [forcedSel, setForcedSel] = useState(undefined);
  const selRef = useRef({start: 0, end: 0});

  const dirty = status === 'ready' && text !== saved;
  const lines = useMemo(() => text.split('\n').length, [text]);

  // ---------------------------------------------------------------- carga

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await FS.readText(initialPath);
        if (!alive) {
          return;
        }
        setText(r.text);
        setSaved(r.text);
        setMeta({encoding: r.encoding, bom: r.bom, crlf: r.crlf, size: r.size});
        setStatus('ready');
      } catch (e) {
        if (alive) {
          setError(e.message);
          setStatus('error');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialPath]);

  // ---------------------------------------------------------------- guardar

  async function save() {
    try {
      const r = await FS.writeText(path, text, meta);
      setSaved(text);
      setMeta(m => ({...m, encoding: r.encoding, size: r.size}));
      toast.show('Guardado', path);
      return true;
    } catch (e) {
      toast.show(e.message, null, 'error');
      return false;
    }
  }

  async function saveAs(name) {
    setAskName(false);
    try {
      const r = await FS.saveTextAs(parentPath(path), name, text, meta);
      setPath(r.path);
      setSaved(text);
      setMeta(m => ({...m, encoding: r.encoding, size: r.size}));
      toast.show('Copia guardada', r.path);
    } catch (e) {
      toast.show(e.message, null, 'error');
    }
  }

  // ---------------------------------------------------------------- salir

  const live = useRef({});
  live.current = {dirty, save, onClose};

  function requestClose() {
    const s = live.current;
    if (!s.dirty) {
      s.onClose();
      return;
    }
    Alert.alert('Cambios sin guardar', 'Has modificado el archivo. ¿Qué quieres hacer?', [
      {text: 'Seguir editando', style: 'cancel'},
      {text: 'Descartar', style: 'destructive', onPress: s.onClose},
      {
        text: 'Guardar',
        onPress: async () => {
          if (await live.current.save()) {
            live.current.onClose();
          }
        },
      },
    ]);
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      requestClose();
      return true;
    });
    return () => sub.remove();
  }, []);

  // ---------------------------------------------------------------- portapapeles

  async function copyAll() {
    try {
      await FS.setClipboard(text);
      toast.show('Texto copiado', text.length + ' caracteres');
    } catch (e) {
      toast.show(e.message, null, 'error');
    }
  }

  async function paste() {
    try {
      const clip = await FS.getClipboard();
      if (!clip) {
        toast.show('El portapapeles está vacío');
        return;
      }
      const {start, end} = selRef.current;
      const a = Math.min(start, end);
      const b = Math.max(start, end);
      setText(text.slice(0, a) + clip + text.slice(b));
      const pos = a + clip.length;
      selRef.current = {start: pos, end: pos};
      setForcedSel({start: pos, end: pos});
    } catch (e) {
      toast.show(e.message, null, 'error');
    }
  }

  async function copyPath() {
    try {
      await FS.setClipboard(path);
      toast.show('Ruta del archivo copiada', path);
    } catch (e) {
      toast.show(e.message, null, 'error');
    }
  }

  async function openExternal() {
    try {
      await FS.openExternal(path);
    } catch (e) {
      toast.show(e.message, null, 'error');
    }
  }

  // ---------------------------------------------------------------- render

  const name = baseName(path);
  const actions = [
    {label: 'Guardar como…', onPress: () => setAskName(true)},
    {label: 'Copiar ruta del archivo', onPress: copyPath},
    {label: 'Abrir con otra app', onPress: openExternal},
  ];

  return (
    <View style={[styles.root, {backgroundColor: t.bg}]}>
      <ViewerHeader
        title={(dirty ? '● ' : '') + name}
        subtitle={
          status === 'ready'
            ? meta.encoding + ' · ' + formatSize(meta.size) + (dirty ? ' · sin guardar' : '')
            : null
        }
        onBack={requestClose}>
        {status === 'ready' ? (
          <>
            <Pressable
              onPress={save}
              disabled={!dirty}
              style={[
                styles.saveBtn,
                {backgroundColor: dirty ? t.primary : t.surfaceAlt},
              ]}>
              <Text
                style={{
                  color: dirty ? t.onPrimary : t.textDim,
                  fontWeight: '700',
                  fontSize: 14,
                }}>
                Guardar
              </Text>
            </Pressable>
            <Pressable onPress={() => setMenu(true)} hitSlop={8} style={styles.moreBtn}>
              <MoreIcon color={t.text} />
            </Pressable>
          </>
        ) : null}
      </ViewerHeader>

      {status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.center}>
          <Text style={[styles.errTitle, {color: t.text}]}>No se puede abrir como texto</Text>
          <Text style={[styles.errText, {color: t.textDim}]}>{error}</Text>
          <Pressable
            onPress={openExternal}
            style={[styles.errBtn, {backgroundColor: t.primary}]}>
            <Text style={{color: t.onPrimary, fontWeight: '700'}}>Abrir con otra app</Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'ready' ? (
        <>
          <TextInput
            multiline
            value={text}
            onChangeText={setText}
            selection={forcedSel}
            onSelectionChange={e => {
              selRef.current = e.nativeEvent.selection;
              if (forcedSel) {
                setForcedSel(undefined);
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="no"
            underlineColorAndroid="transparent"
            textAlignVertical="top"
            placeholder="Archivo vacío"
            placeholderTextColor={t.textDim}
            style={[
              styles.input,
              {color: t.text, backgroundColor: t.surface, fontSize},
            ]}
          />
          <View style={[styles.toolbar, {backgroundColor: t.surface, borderColor: t.border}]}>
            <ToolBtn label="Copiar todo" onPress={copyAll} />
            <ToolBtn label="Pegar" onPress={paste} />
            <ToolBtn label="A−" onPress={() => setFontSize(s => Math.max(10, s - 1))} />
            <ToolBtn label="A+" onPress={() => setFontSize(s => Math.min(26, s + 1))} />
            <Text style={[styles.count, {color: t.textDim}]}>{lines} líneas</Text>
          </View>
        </>
      ) : null}

      <ActionSheet
        visible={menu}
        title={name}
        subtitle={path}
        actions={actions}
        onClose={() => setMenu(false)}
      />
      <PromptModal
        visible={askName}
        config={{
          title: 'Guardar copia como',
          message: 'Se guardará en la misma carpeta con el nombre que indiques.',
          initial: name,
          confirmLabel: 'Guardar',
        }}
        onSubmit={saveAs}
        onCancel={() => setAskName(false)}
      />
    </View>
  );
}

function ToolBtn({label, onPress}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tool, {backgroundColor: t.surfaceAlt}]}>
      <Text style={{color: t.text, fontSize: 13, fontWeight: '600'}}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {...StyleSheet.absoluteFillObject},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28},
  errTitle: {fontSize: 18, fontWeight: '700', textAlign: 'center'},
  errText: {fontSize: 14, textAlign: 'center', marginTop: 8},
  errBtn: {marginTop: 20, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12},
  saveBtn: {paddingHorizontal: 14, height: 36, borderRadius: 10, justifyContent: 'center'},
  moreBtn: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  input: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: 'monospace',
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth,
  },
  tool: {paddingHorizontal: 12, height: 34, borderRadius: 9, justifyContent: 'center', marginRight: 8},
  count: {flex: 1, textAlign: 'right', fontSize: 12},
});
