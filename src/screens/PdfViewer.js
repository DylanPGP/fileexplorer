import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator, BackHandler, FlatList, Image, PixelRatio, Pressable,
  ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import {FS} from '../fs';
import {useTheme} from '../theme';
import {useToast} from '../components/Toast';
import ActionSheet from '../components/ActionSheet';
import ViewerHeader from '../components/ViewerHeader';
import {MoreIcon} from '../components/Icons';
import {baseName, toFileUri} from '../utils';

const ZOOMS = [1, 1.5, 2, 2.5];

export default function PdfViewer({path, onClose}) {
  const t = useTheme();
  const toast = useToast();
  const {width: winW} = useWindowDimensions();
  const [count, setCount] = useState(null);
  const [error, setError] = useState(null);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [aspect, setAspect] = useState(1.414);
  const [menu, setMenu] = useState(false);
  const zoom = ZOOMS[zoomIdx];
  const pageW = winW * zoom;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    FS.pdfPageCount(path)
      .then(n => alive && setCount(n))
      .catch(e => alive && setError(e.message));
    return () => {
      alive = false;
      FS.clearPdfCache();
    };
  }, [path]);

  const actions = [
    {
      label: 'Copiar ruta del archivo',
      onPress: async () => {
        try {
          await FS.setClipboard(path);
          toast.show('Ruta del archivo copiada', path);
        } catch (e) {
          toast.show(e.message, null, 'error');
        }
      },
    },
    {
      label: 'Abrir con otra app',
      onPress: async () => {
        try {
          await FS.openExternal(path);
        } catch (e) {
          toast.show(e.message, null, 'error');
        }
      },
    },
  ];

  const pages = count ? Array.from({length: count}, (_, i) => i) : [];

  return (
    <View style={[styles.root, {backgroundColor: t.bg}]}>
      <ViewerHeader
        title={baseName(path)}
        subtitle={count ? count + (count === 1 ? ' página' : ' páginas') + ' · zoom ' + zoom + '×' : null}
        onBack={onClose}>
        <Pressable
          onPress={() => setZoomIdx(i => Math.max(0, i - 1))}
          style={[styles.zoomBtn, {backgroundColor: t.surfaceAlt}]}>
          <Text style={{color: t.text, fontSize: 20}}>−</Text>
        </Pressable>
        <Pressable
          onPress={() => setZoomIdx(i => Math.min(ZOOMS.length - 1, i + 1))}
          style={[styles.zoomBtn, {backgroundColor: t.surfaceAlt}]}>
          <Text style={{color: t.text, fontSize: 20}}>+</Text>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} hitSlop={8} style={styles.moreBtn}>
          <MoreIcon color={t.text} />
        </Pressable>
      </ViewerHeader>

      {error ? (
        <View style={styles.center}>
          <Text style={[styles.errTitle, {color: t.text}]}>No se puede mostrar el PDF</Text>
          <Text style={[styles.errText, {color: t.textDim}]}>{error}</Text>
        </View>
      ) : count === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : (
        <ScrollView
          horizontal
          nestedScrollEnabled
          style={{flex: 1}}
          contentContainerStyle={{width: Math.max(pageW, winW)}}>
          <FlatList
            data={pages}
            keyExtractor={i => String(i)}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            nestedScrollEnabled
            contentContainerStyle={{paddingVertical: 8}}
            renderItem={({item}) => (
              <PdfPage
                path={path}
                index={item}
                width={pageW}
                aspect={aspect}
                onAspect={setAspect}
              />
            )}
          />
        </ScrollView>
      )}

      <ActionSheet
        visible={menu}
        title={baseName(path)}
        subtitle={path}
        actions={actions}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

function PdfPage({path, index, width, aspect, onAspect}) {
  const t = useTheme();
  const [page, setPage] = useState(null);
  const [err, setErr] = useState(false);
  const firstLoad = useRef(true);

  useEffect(() => {
    let alive = true;
    const px = Math.round(width * PixelRatio.get());
    FS.pdfRenderPage(path, index, px)
      .then(r => {
        if (!alive) {
          return;
        }
        setPage(r);
        if (index === 0 && firstLoad.current) {
          firstLoad.current = false;
          onAspect(r.height / r.width);
        }
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, index, width]);

  const height = page ? width * (page.height / page.width) : width * aspect;

  return (
    <View
      style={[
        styles.page,
        {width, height, backgroundColor: page ? '#FFFFFF' : t.surfaceAlt},
      ]}>
      {page ? (
        <Image
          source={{uri: toFileUri(page.path)}}
          resizeMode="contain"
          fadeDuration={0}
          style={{width, height}}
        />
      ) : err ? (
        <Text style={{color: t.textDim}}>No se pudo mostrar la página {index + 1}</Text>
      ) : (
        <ActivityIndicator color={t.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {...StyleSheet.absoluteFillObject},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28},
  errTitle: {fontSize: 18, fontWeight: '700', textAlign: 'center'},
  errText: {fontSize: 14, textAlign: 'center', marginTop: 8},
  page: {alignItems: 'center', justifyContent: 'center', marginBottom: 8},
  zoomBtn: {
    width: 38, height: 36, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', marginLeft: 6,
  },
  moreBtn: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
});
