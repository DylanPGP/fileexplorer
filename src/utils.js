const TEXT_EXT = new Set([
  'txt', 'json', 'html', 'htm', 'css', 'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx',
  'xml', 'csv', 'tsv', 'md', 'markdown', 'log', 'ini', 'cfg', 'conf', 'yml',
  'yaml', 'toml', 'properties', 'sh', 'bat', 'cmd', 'py', 'java', 'kt', 'kts',
  'gradle', 'sql', 'svg', 'php', 'rb', 'go', 'rs', 'c', 'h', 'cpp', 'hpp',
  'cs', 'swift', 'lua', 'srt', 'vtt', 'env', 'gitignore', 'gitattributes',
  'editorconfig', 'rst', 'tex', 'bib', 'lrc', 'm3u', 'plist', 'vue', 'scss',
  'sass', 'less', 'dart', 'pl', 'r', 'json5', 'jsonc', 'geojson', 'gpx', 'kml',
]);
const TEXT_NAMES = new Set([
  'readme', 'license', 'licence', 'makefile', 'dockerfile', 'changelog',
  'authors', 'notice', 'copying', 'procfile', 'gemfile',
]);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);
const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'jar']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus']);
const VIDEO_EXT = new Set(['mp4', 'mkv', 'avi', 'mov', 'webm', '3gp']);

export function getExtension(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

/** folder | text | image | pdf | archive | audio | video | apk | other */
export function kindOf(entry) {
  if (entry.isDirectory) {
    return 'folder';
  }
  const lower = entry.name.toLowerCase();
  const ext = getExtension(entry.name);
  if (TEXT_EXT.has(ext) || TEXT_NAMES.has(lower)) {
    return 'text';
  }
  if (lower.startsWith('.') && ext === '' && TEXT_EXT.has(lower.slice(1))) {
    return 'text';
  }
  if (IMAGE_EXT.has(ext)) {
    return 'image';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (ARCHIVE_EXT.has(ext)) {
    return 'archive';
  }
  if (AUDIO_EXT.has(ext)) {
    return 'audio';
  }
  if (VIDEO_EXT.has(ext)) {
    return 'video';
  }
  if (ext === 'apk') {
    return 'apk';
  }
  return 'other';
}

const EXT_COLORS = {
  json: '#D97706', html: '#E34F26', htm: '#E34F26', css: '#2965F1',
  js: '#B7950B', jsx: '#B7950B', ts: '#3178C6', tsx: '#3178C6', xml: '#0E7490',
  csv: '#15803D', md: '#475569', markdown: '#475569', py: '#3776AB',
  kt: '#7F52FF', java: '#B45309', sh: '#334155', yml: '#9333EA', yaml: '#9333EA',
};
const KIND_COLORS = {
  text: '#64748B', image: '#0D9488', pdf: '#DC2626', archive: '#7C3AED',
  audio: '#DB2777', video: '#EA580C', apk: '#16A34A', other: '#6B7280',
};
const KIND_LABELS = {
  image: 'IMG', pdf: 'PDF', archive: 'ZIP', audio: 'AUD', video: 'VID',
  apk: 'APK', text: 'TXT', other: 'FILE',
};

export function tileMeta(kind, name) {
  const ext = getExtension(name);
  const label = ext ? ext.toUpperCase().slice(0, 4) : KIND_LABELS[kind];
  const color = EXT_COLORS[ext] || KIND_COLORS[kind] || KIND_COLORS.other;
  return {label, color};
}

export function joinPath(dir, name) {
  return dir.endsWith('/') ? dir + name : dir + '/' + name;
}

export function parentPath(p) {
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}

export function baseName(p) {
  return p.slice(p.lastIndexOf('/') + 1);
}

/** Migas de pan a partir del volumen al que pertenece la ruta. */
export function breadcrumbs(path, roots) {
  if (!path) {
    return [];
  }
  const root = roots
    .filter(r => path === r.path || path.startsWith(r.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!root) {
    return [{label: path, path}];
  }
  const out = [{label: root.short, path: root.path}];
  let acc = root.path;
  path
    .slice(root.path.length)
    .split('/')
    .filter(Boolean)
    .forEach(seg => {
      acc = joinPath(acc, seg);
      out.push({label: seg, path: acc});
    });
  return out;
}

export function formatSize(bytes) {
  if (bytes < 1024) {
    return bytes + ' B';
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ' + units[i];
}

const pad = n => (n < 10 ? '0' + n : '' + n);

export function formatDate(ms) {
  if (!ms) {
    return '';
  }
  const d = new Date(ms);
  return (
    pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  );
}

/** Carpetas primero; después por nombre, fecha (recientes primero) o tamaño (mayores primero). */
export function sortEntries(list, by) {
  const arr = list.slice();
  arr.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    if (by === 'date' && a.modified !== b.modified) {
      return b.modified - a.modified;
    }
    if (by === 'size' && !a.isDirectory && a.size !== b.size) {
      return b.size - a.size;
    }
    const x = a.name.toLowerCase();
    const y = b.name.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return arr;
}

export function toFileUri(path) {
  return 'file://' + path.split('/').map(encodeURIComponent).join('/');
}
