import React from 'react';
import {View} from 'react-native';

export function SearchIcon({color, size = 22}) {
  const r = size * 0.64;
  return (
    <View style={{width: size, height: size}}>
      <View
        style={{
          position: 'absolute', left: 1, top: 1, width: r, height: r,
          borderRadius: r / 2, borderWidth: 2, borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute', right: 1, bottom: size * 0.1,
          width: size * 0.4, height: 2.4, borderRadius: 1,
          backgroundColor: color, transform: [{rotate: '45deg'}],
        }}
      />
    </View>
  );
}

export function MoreIcon({color, size = 22}) {
  const dot = {width: 4, height: 4, borderRadius: 2, backgroundColor: color};
  return (
    <View
      style={{
        width: size, height: size, alignItems: 'center',
        justifyContent: 'space-between', paddingVertical: 3,
      }}>
      <View style={dot} />
      <View style={dot} />
      <View style={dot} />
    </View>
  );
}

export function CopyIcon({color, bg, size = 16}) {
  const s = size * 0.66;
  return (
    <View style={{width: size, height: size}}>
      <View
        style={{
          position: 'absolute', left: 0, top: 0, width: s, height: s,
          borderRadius: 3, borderWidth: 1.6, borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute', right: 0, bottom: 0, width: s, height: s,
          borderRadius: 3, borderWidth: 1.6, borderColor: color,
          backgroundColor: bg,
        }}
      />
    </View>
  );
}
