import React, {useEffect, useState} from 'react';
import {
  BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import {FS} from '../fs';
import {useTheme} from '../theme';
import {useToast} from '../components/Toast';
import ActionSheet from '../components/ActionSheet';
import ViewerHeader from '../components/ViewerHeader';
import {MoreIcon} from '../components/Icons';
import {baseName, toFileUri} from '../utils';

const ZOOMS = [1, 2, 3, 4, 6];

export default function ImageViewer({path, onClose}) {
  const t = useTheme();
  const toast = useToast();
  const [zoomIdx, setZoomIdx] = useState(0);
  const [box, setBox] = useState({width: 0, height: 0});
  const [dim, setDim] = useState(null);
  const [failed, setFailed] = useState(false);
  const [menu, setMenu] = useState(false);
  const uri = toFileUri(path);
  const zoom = ZOOMS[zoomIdx];

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => setDim({w, h}),
      () => setFailed(true),
    );
  }, [uri]);

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

  return (
    <View style={styles.root}>
      <ViewerHeader
        title={baseName(path)}
        subtitle={dim ? dim.w + ' × ' + dim.h + ' px · zoom ' + zoom + '×' : null}
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

      <View style={styles.stage} onLayout={e => setBox(e.nativeEvent.layout)}>
        {failed ? (
          <View style={styles.fail}>
            <Text style={{color: '#FFFFFF'}}>No se pudo cargar la imagen</Text>
          </View>
        ) : box.width > 0 ? (
          <ScrollView
            nestedScrollEnabled
            contentContainerStyle={{minHeight: box.height}}>
            <ScrollView
              horizontal
              nestedScrollEnabled
              contentContainerStyle={{minWidth: box.width}}>
              <Image
                source={{uri}}
                resizeMode="contain"
                fadeDuration={0}
                onError={() => setFailed(true)}
                style={{width: box.width * zoom, height: box.height * zoom}}
              />
            </ScrollView>
          </ScrollView>
        ) : null}
      </View>

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

const styles = StyleSheet.create({
  root: {...StyleSheet.absoluteFillObject, backgroundColor: '#0B0B0C'},
  stage: {flex: 1},
  fail: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  zoomBtn: {
    width: 38, height: 36, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', marginLeft: 6,
  },
  moreBtn: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
});
