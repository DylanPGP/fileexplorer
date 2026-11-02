import React from 'react';
import {Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme';

export default function PermissionScreen({checking, onRequest}) {
  const t = useTheme();
  const modern = Platform.Version >= 30;

  return (
    <ScrollView
      style={{backgroundColor: t.bg}}
      contentContainerStyle={styles.content}>
      <View style={[styles.badge, {backgroundColor: t.primary}]}>
        <Text style={{color: t.onPrimary, fontSize: 30, fontWeight: '700'}}>
          ▤
        </Text>
      </View>
      <Text style={[styles.title, {color: t.text}]}>
        Acceso a tus archivos
      </Text>
      <Text style={[styles.p, {color: t.textDim}]}>
        Para explorar y editar archivos del almacenamiento compartido, Android
        exige tu autorización expresa.
      </Text>

      <View style={[styles.card, {backgroundColor: t.surface, borderColor: t.border}]}>
        <Text style={[styles.h, {color: t.text}]}>Qué ocurrirá</Text>
        <Text style={[styles.p, {color: t.textDim}]}>
          {modern
            ? 'Se abrirá la pantalla de ajustes «Acceso a todos los archivos». Activa el interruptor de esta app y vuelve atrás.'
            : 'Android mostrará un diálogo para permitir leer y modificar el almacenamiento.'}
        </Text>
        <Text style={[styles.h, {color: t.text, marginTop: 14}]}>
          Tu privacidad
        </Text>
        <Text style={[styles.p, {color: t.textDim}]}>
          La app no tiene permiso de internet, no usa cuentas ni rastreadores y
          procesa todo en tu dispositivo.
        </Text>
        <Text style={[styles.h, {color: t.text, marginTop: 14}]}>
          Carpetas protegidas
        </Text>
        <Text style={[styles.p, {color: t.textDim}]}>
          Android bloquea a las apps el acceso a Android/data y Android/obb de
          otras aplicaciones. Esta app respeta esa restricción: sin root,
          Shizuku ni ADB no es posible entrar en ellas.
        </Text>
      </View>

      <Pressable
        onPress={onRequest}
        disabled={checking}
        style={[styles.btn, {backgroundColor: t.primary, opacity: checking ? 0.6 : 1}]}>
        <Text style={[styles.btnText, {color: t.onPrimary}]}>
          Conceder acceso
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {padding: 24, paddingTop: 48},
  badge: {
    width: 64, height: 64, borderRadius: 18, alignItems: 'center',
    justifyContent: 'center', marginBottom: 20,
  },
  title: {fontSize: 26, fontWeight: '700', marginBottom: 8},
  card: {borderRadius: 16, borderWidth: 1, padding: 18, marginTop: 20},
  h: {fontSize: 15, fontWeight: '600', marginBottom: 4},
  p: {fontSize: 14, lineHeight: 20},
  btn: {
    marginTop: 24, height: 52, borderRadius: 14, alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {fontSize: 16, fontWeight: '700'},
});
