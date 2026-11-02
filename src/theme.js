import {createContext, useContext} from 'react';

export const lightTheme = {
  dark: false,
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F4',
  text: '#14171C',
  textDim: '#6B7280',
  border: '#E3E6EB',
  primary: '#2563EB',
  onPrimary: '#FFFFFF',
  danger: '#DC2626',
  folder: '#F5B301',
  folderDark: '#D99A00',
  overlay: 'rgba(0,0,0,0.45)',
};

export const darkTheme = {
  dark: true,
  bg: '#0E1013',
  surface: '#171A1F',
  surfaceAlt: '#232830',
  text: '#ECEEF1',
  textDim: '#9AA1AC',
  border: '#272C33',
  primary: '#6EA0FF',
  onPrimary: '#0B1220',
  danger: '#F87171',
  folder: '#F5B301',
  folderDark: '#C98E00',
  overlay: 'rgba(0,0,0,0.6)',
};

export const ThemeContext = createContext(lightTheme);
export const useTheme = () => useContext(ThemeContext);
