import React, {useRef} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme';

/**
 * Menú inferior. actions: [{label, onPress, danger?, checked?}]
 * Primero se cierra el menú y después se ejecuta la acción.
 */
export default function ActionSheet({visible, title, subtitle, actions, onClose}) {
  const t = useTheme();
  const last = useRef({title, subtitle, actions});
  if (visible) {
    last.current = {title, subtitle, actions};
  }
  const c = last.current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, {backgroundColor: t.overlay}]}
          onPress={onClose}
        />
        <View style={[styles.sheet, {backgroundColor: t.surface}]}>
          <View style={[styles.handle, {backgroundColor: t.border}]} />
          {c.title ? (
            <View style={styles.head}>
              <Text
                numberOfLines={1}
                ellipsizeMode="middle"
                style={[styles.title, {color: t.text}]}>
                {c.title}
              </Text>
              {c.subtitle ? (
                <Text
                  numberOfLines={2}
                  style={[styles.sub, {color: t.textDim}]}>
                  {c.subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          <ScrollView>
            {c.actions.map(a => (
              <Pressable
                key={a.label}
                android_ripple={{color: t.border}}
                onPress={() => {
                  onClose();
                  a.onPress();
                }}
                style={styles.row}>
                <Text
                  style={[
                    styles.label,
                    {color: a.danger ? t.danger : t.text},
                  ]}>
                  {a.label}
                </Text>
                {a.checked ? (
                  <Text style={{color: t.primary, fontSize: 18}}>✓</Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, justifyContent: 'flex-end'},
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 10,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    marginTop: 8, marginBottom: 6,
  },
  head: {paddingHorizontal: 20, paddingBottom: 10},
  title: {fontSize: 16, fontWeight: '600'},
  sub: {fontSize: 12, marginTop: 4, fontFamily: 'monospace'},
  row: {
    minHeight: 52, paddingHorizontal: 20, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  label: {fontSize: 16},
});
