import React, {
  createContext, useCallback, useContext, useMemo, useRef, useState,
} from 'react';
import {Animated, StyleSheet, Text} from 'react-native';
import {useTheme} from '../theme';

const ToastContext = createContext({show: () => {}});
export const useToast = () => useContext(ToastContext);

/** Aviso flotante en la parte superior. show(mensaje, detalle?, 'info' | 'error') */
export function ToastProvider({children}) {
  const t = useTheme();
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const show = useCallback(
    (message, detail, kind) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      setToast({message, detail, kind: kind || 'info'});
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1, duration: 160, useNativeDriver: true,
      }).start();
      timer.current = setTimeout(
        () => {
          Animated.timing(opacity, {
            toValue: 0, duration: 220, useNativeDriver: true,
          }).start(({finished}) => {
            if (finished) {
              setToast(null);
            }
          });
        },
        kind === 'error' ? 4500 : detail ? 3600 : 2600,
      );
    },
    [opacity],
  );

  const api = useMemo(() => ({show}), [show]);
  const isError = toast && toast.kind === 'error';
  const bg = isError ? t.danger : t.dark ? '#E8EAED' : '#1F2937';
  const fg = isError ? '#FFFFFF' : t.dark ? '#111418' : '#FFFFFF';

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, {backgroundColor: bg, opacity}]}>
          <Text style={[styles.msg, {color: fg}]}>{toast.message}</Text>
          {toast.detail ? (
            <Text numberOfLines={3} style={[styles.detail, {color: fg}]}>
              {toast.detail}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', top: 12, left: 16, right: 16, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, elevation: 12, zIndex: 100,
  },
  msg: {fontSize: 14, fontWeight: '600'},
  detail: {fontSize: 12, marginTop: 3, opacity: 0.85, fontFamily: 'monospace'},
});
