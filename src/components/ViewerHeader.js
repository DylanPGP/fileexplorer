import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme';

/** Cabecera común de los visores: volver, título y acciones a la derecha. */
export default function ViewerHeader({title, subtitle, onBack, children}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.bar,
        {backgroundColor: t.surface, borderColor: t.border},
      ]}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.back}>
        <Text style={{color: t.text, fontSize: 24}}>←</Text>
      </Pressable>
      <View style={styles.titleBox}>
        <Text numberOfLines={1} style={[styles.title, {color: t.text}]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.sub, {color: t.textDim}]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 58, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  titleBox: {flex: 1, paddingHorizontal: 4},
  title: {fontSize: 16, fontWeight: '600'},
  sub: {fontSize: 12, marginTop: 1},
});
