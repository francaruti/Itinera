import type { ActivityCategory } from '../../../shared/types';

const RULES: Array<[RegExp, ActivityCategory]> = [
  [/\b(almuerzo|cena|desayuno|brunch|restaurante|caf[eé]|comer|pizza|hamburguesa|helado|bar)\b/i, 'food'],
  [/\b(vuelo|aeropuerto|traslado|taxi|uber|tren|bus|metro|ferry|check-?out)\b/i, 'transport'],
  [/\b(hotel|check-?in|hospedaje)\b/i, 'lodging'],
  [/\b(parque|magic kingdom|universal|disney|epic|montaña rusa|atracci[oó]n)/i, 'park'],
  [/\b(compras|tienda|outlet|mall|shopping|souvenir)/i, 'shopping'],
  [/\b(show|broadway|concierto|fuegos|teatro|musical)/i, 'show'],
  [/\b(descanso|descansar|piscina|siesta|dormir|relax)/i, 'rest'],
  [/\b(museo|torre|mirador|puente|catedral|plaza|memorial|biblioteca|estatua|paseo|caminar|visita)/i, 'sight'],
];

export function guessCategory(text: string): ActivityCategory {
  for (const [re, cat] of RULES) if (re.test(text)) return cat;
  return 'other';
}
