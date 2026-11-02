import React from 'react';
import {Text, View} from 'react-native';
import {useTheme} from '../theme';
import {tileMeta} from '../utils';

export default function FileIcon({kind, name, size = 42}) {
  const t = useTheme();
  if (kind === 'folder') {
    return (
      <View style={{width: size, height: size, justifyContent: 'center'}}>
        <View
          style={{
            width: size * 0.44, height: size * 0.16, marginLeft: size * 0.06,
            backgroundColor: t.folderDark, borderTopLeftRadius: 5,
            borderTopRightRadius: 5,
          }}
        />
        <View
          style={{
            width: size * 0.88, height: size * 0.58,
            backgroundColor: t.folder, borderRadius: 6,
            borderTopLeftRadius: 2,
          }}
        />
      </View>
    );
  }
  const m = tileMeta(kind, name);
  return (
    <View
      style={{
        width: size, height: size, borderRadius: 10,
        backgroundColor: m.color, alignItems: 'center', justifyContent: 'center',
      }}>
      <Text
        numberOfLines={1}
        style={{
          color: '#FFFFFF', fontWeight: '700',
          fontSize: m.label.length > 3 ? 9 : 11,
        }}>
        {m.label}
      </Text>
    </View>
  );
}
