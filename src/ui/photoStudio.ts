export type PhotoFilter =
  | 'natural'
  | 'golden_hour'
  | 'dreamy_pastel'
  | 'cozy_sunset'
  | 'starry_twilight'
  | 'vintage_sepia';

export type PhotoFrame = 'none' | 'polaroid' | 'cinematic' | 'postcard' | 'grid';

export const PHOTO_FILTERS: {
  id: PhotoFilter;
  name: string;
  color: string;
  desc: string;
  css: string;
}[] = [
  { id: 'natural', name: 'Natural', color: '#f8fafc', desc: 'Puro y nítido', css: 'none' },
  {
    id: 'golden_hour',
    name: 'Hora dorada',
    color: '#f59e0b',
    desc: 'Luz ámbar cálida',
    css: 'sepia(0.28) saturate(1.4) brightness(1.05) contrast(1.05)',
  },
  {
    id: 'dreamy_pastel',
    name: 'Pastel ensueño',
    color: '#a78bfa',
    desc: 'Etéreo y luminoso',
    css: 'brightness(1.12) saturate(1.15) hue-rotate(10deg) contrast(0.95)',
  },
  {
    id: 'cozy_sunset',
    name: 'Atardecer cálido',
    color: '#f43f5e',
    desc: 'Tonos melocotón suaves',
    css: 'sepia(0.35) hue-rotate(-20deg) saturate(1.45) contrast(1.1)',
  },
  {
    id: 'starry_twilight',
    name: 'Noche estelar',
    color: '#38bdf8',
    desc: 'Cielo índigo apacible',
    css: 'brightness(0.9) contrast(1.2) hue-rotate(185deg) saturate(1.3)',
  },
  {
    id: 'vintage_sepia',
    name: 'Película clásica',
    color: '#d97706',
    desc: 'Sepia nostálgico',
    css: 'sepia(0.65) contrast(1.15) brightness(0.95) saturate(0.85)',
  },
];

export const PHOTO_FRAMES: { id: PhotoFrame; name: string; desc: string }[] = [
  { id: 'none', name: 'Sin marco', desc: 'Composición limpia' },
  { id: 'polaroid', name: 'Polaroid', desc: 'Borde blanco clásico' },
  { id: 'cinematic', name: 'Cinemático', desc: 'Barras panorámicas' },
  { id: 'postcard', name: 'Postal', desc: 'Sello aéreo y matasellos' },
  { id: 'grid', name: 'Guía suave', desc: 'Líneas para encuadrar' },
];
