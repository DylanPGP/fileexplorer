import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, StatusBar, StyleSheet, useColorScheme, View} from 'react-native';
import {FS, requestStorageAccess} from './src/fs';
import {darkTheme, lightTheme, ThemeContext} from './src/theme';
import {ToastProvider} from './src/components/Toast';
import PermissionScreen from './src/screens/PermissionScreen';
import BrowserScreen from './src/screens/BrowserScreen';
import EditorScreen from './src/screens/EditorScreen';
import ImageViewer from './src/screens/ImageViewer';
import PdfViewer from './src/screens/PdfViewer';

const DEFAULT_SETTINGS = {theme: 'system', sortBy: 'name', showHidden: false};

export default function App() {
  const system = useColorScheme();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [access, setAccess] = useState(null); // null = comprobando
  const [viewer, setViewer] = useState(null); // {type: 'editor' | 'image' | 'pdf', path}
  const [refreshSignal, setRefreshSignal] = useState(0);
  const requesting = useRef(false);

  const dark = settings.theme === 'dark' || (settings.theme === 'system' && system === 'dark');
  const theme = dark ? darkTheme : lightTheme;

  // Ajustes guardados en el dispositivo
  useEffect(() => {
    (async () => {
      try {
        const raw = await FS.getPref('settings');
        if (raw) {
          setSettings({...DEFAULT_SETTINGS, ...JSON.parse(raw)});
        }
      } catch (e) {
        // se usan los valores por defecto
      }
      setSettingsReady(true);
    })();
  }, []);

  const updateSettings = useCallback(patch => {
    setSettings(prev => {
      const next = {...prev, ...patch};
      FS.setPref('settings', JSON.stringify(next));
      return next;
    });
  }, []);

  // Estado del permiso: al iniciar y cada vez que se vuelve a la app
  const checkAccess = useCallback(async () => {
    try {
      setAccess(await FS.hasAllFilesAccess());
    } catch (e) {
      setAccess(false);
    }
  }, []);

  useEffect(() => {
    checkAccess();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        checkAccess();
      }
    });
    return () => sub.remove();
  }, [checkAccess]);

  const askAccess = useCallback(async () => {
    if (requesting.current) {
      return;
    }
    requesting.current = true;
    try {
      setAccess(await requestStorageAccess());
    } catch (e) {
      setAccess(false);
    } finally {
      requesting.current = false;
    }
  }, []);

  const closeViewer = useCallback(() => {
    setViewer(null);
    setRefreshSignal(n => n + 1);
  }, []);

  let body = null;
  if (settingsReady && access !== null) {
    if (!access) {
      body = <PermissionScreen checking={false} onRequest={askAccess} />;
    } else {
      body = (
        <View style={styles.fill}>
          <BrowserScreen
            active={!viewer}
            settings={settings}
            updateSettings={updateSettings}
            onOpenViewer={setViewer}
            refreshSignal={refreshSignal}
          />
          {viewer && viewer.type === 'editor' ? (
            <EditorScreen key={viewer.path} path={viewer.path} onClose={closeViewer} />
          ) : null}
          {viewer && viewer.type === 'image' ? (
            <ImageViewer key={viewer.path} path={viewer.path} onClose={closeViewer} />
          ) : null}
          {viewer && viewer.type === 'pdf' ? (
            <PdfViewer key={viewer.path} path={viewer.path} onClose={closeViewer} />
          ) : null}
        </View>
      );
    }
  }

  return (
    <ThemeContext.Provider value={theme}>
      <ToastProvider>
        <View style={[styles.fill, {backgroundColor: theme.bg}]}>
          <StatusBar
            barStyle={dark ? 'light-content' : 'dark-content'}
            backgroundColor={theme.surface}
          />
          {body}
        </View>
      </ToastProvider>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
});
