import React, {useEffect, useRef, useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useTheme} from '../theme';

/** Diálogo con un campo de texto. config: {title, message?, initial?, confirmLabel?} */
export default function PromptModal({visible, config, onSubmit, onCancel}) {
  const t = useTheme();
  const last = useRef(config);
  if (config) {
    last.current = config;
  }
  const c = last.current || {};
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) {
      setValue(c.initial || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = () => {
    const v = value.trim();
    if (v) {
      onSubmit(v);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}>
      <View style={[styles.root, {backgroundColor: t.overlay}]}>
        <View style={[styles.card, {backgroundColor: t.surface}]}>
          <Text style={[styles.title, {color: t.text}]}>{c.title}</Text>
          {c.message ? (
            <Text style={[styles.msg, {color: t.textDim}]}>{c.message}</Text>
          ) : null}
          <TextInput
            autoFocus
            selectTextOnFocus
            value={value}
            onChangeText={setValue}
            onSubmitEditing={submit}
            autoCapitalize="none"
            autoCorrect={false}
            underlineColorAndroid="transparent"
            placeholderTextColor={t.textDim}
            style={[
              styles.input,
              {color: t.text, backgroundColor: t.surfaceAlt, borderColor: t.border},
            ]}
          />
          <View style={styles.buttons}>
            <Pressable onPress={onCancel} style={styles.btn}>
              <Text style={[styles.btnText, {color: t.textDim}]}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={submit} style={styles.btn}>
              <Text style={[styles.btnText, {color: t.primary}]}>
                {c.confirmLabel || 'Aceptar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, paddingTop: 110, paddingHorizontal: 24},
  card: {borderRadius: 18, padding: 20},
  title: {fontSize: 18, fontWeight: '600'},
  msg: {fontSize: 13, marginTop: 6},
  input: {
    marginTop: 14, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
  },
  buttons: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14},
  btn: {paddingHorizontal: 14, paddingVertical: 10},
  btnText: {fontSize: 15, fontWeight: '600'},
});
