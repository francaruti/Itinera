import { Copy, Languages, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { copyText } from '../../lib/format';
import { tap } from '../../lib/haptics';
import { useStore } from '../../store';
import { Seg } from '../ui/Seg';

type Cat = 'aero' | 'comer' | 'mover' | 'hotel' | 'ayuda';

const CATS: Array<{ id: Cat; label: string }> = [
  { id: 'aero', label: 'Aeropuerto' },
  { id: 'comer', label: 'Comer' },
  { id: 'mover', label: 'Moverse' },
  { id: 'hotel', label: 'Hotel y compras' },
  { id: 'ayuda', label: 'Ayuda' },
];

const PHRASES: Record<Cat, Array<[string, string]>> = {
  aero: [
    ["I'm here on vacation.", 'Vengo de vacaciones.'],
    ["I'll be staying for a few days.", 'Me quedaré unos días.'],
    ['I have a reservation under my name.', 'Tengo una reserva a mi nombre.'],
    ['Where is the baggage claim?', '¿Dónde recojo el equipaje?'],
    ['Where can I get a taxi?', '¿Dónde puedo tomar un taxi?'],
    ["I don't speak much English. Do you speak Spanish?", 'No hablo mucho inglés. ¿Habla español?'],
  ],
  comer: [
    ['A table for four, please.', 'Una mesa para cuatro, por favor.'],
    ['Could we see the menu, please?', '¿Podemos ver el menú, por favor?'],
    ['What do you recommend?', '¿Qué me recomienda?'],
    ["I'm allergic to peanuts.", 'Soy alérgico(a) al maní.'],
    ['Separate checks, please.', 'Cuentas separadas, por favor.'],
    ['Is the tip included?', '¿La propina está incluida?'],
    ['Could we get the check, please?', '¿Nos trae la cuenta, por favor?'],
  ],
  mover: [
    ['How do I get to the city center?', '¿Cómo llego al centro de la ciudad?'],
    ['Does this bus go to the museum?', '¿Este autobús va al museo?'],
    ['Where can I buy a ticket?', '¿Dónde puedo comprar un boleto?'],
    ['Please take me to this address.', 'Por favor, lléveme a esta dirección.'],
    ['You can drop us off here, thank you.', 'Puede dejarnos aquí, gracias.'],
    ['How long does it take to walk there?', '¿Cuánto se tarda caminando hasta allá?'],
  ],
  hotel: [
    ['Could we have an early check-in?', '¿Podemos hacer el check-in más temprano?'],
    ['Could you hold our luggage until check-in?', '¿Pueden guardarnos las maletas hasta el check-in?'],
    ["The air conditioning isn't working.", 'El aire acondicionado no funciona.'],
    ['How much is this?', '¿Cuánto cuesta esto?'],
    ['Do you have this in a different size?', '¿Lo tiene en otra talla?'],
    ['Can I try this on?', '¿Me lo puedo probar?'],
  ],
  ayuda: [
    ['I need help, please.', 'Necesito ayuda, por favor.'],
    ['Please call the emergency number.', 'Por favor llame al número de emergencias.'],
    ['I lost my passport.', 'Perdí mi pasaporte.'],
    ['I need a doctor.', 'Necesito un médico.'],
    ['Where is the nearest pharmacy?', '¿Dónde queda la farmacia más cercana?'],
    ["I'm lost. Could you help me find this place?", 'Estoy perdido(a). ¿Me ayuda a encontrar este lugar?'],
  ],
};

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

function speak(text: string) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch {
    /* sin voz disponible */
  }
}

/** Frases útiles en inglés: se escuchan con la voz del teléfono (funciona sin internet) y se copian con un toque. */
export function Phrases() {
  const toast = useStore((s) => s.toast);
  const [cat, setCat] = useState<Cat>('aero');
  return (
    <section className="card phrases">
      <h2 className="card-title h-stretch">
        <Languages size={18} /> Frases útiles
      </h2>
      <div className="phrases-cats">
        <Seg<Cat> value={cat} onChange={setCat} label="Tipo de frase" options={CATS.map((c) => ({ value: c.id, label: c.label }))} />
      </div>
      <ul className="phrase-list">
        {PHRASES[cat].map(([en, es]) => (
          <li key={en}>
            <div className="phrase-text">
              <strong>{en}</strong>
              <small>{es}</small>
            </div>
            <div className="phrase-actions">
              {canSpeak && (
                <button type="button" className="icon-btn" onClick={() => (tap(), speak(en))} aria-label={`Escuchar: ${en}`}>
                  <Volume2 size={18} />
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                onClick={async () => toast((await copyText(en)) ? 'Frase copiada' : 'No se pudo copiar', 'success')}
                aria-label={`Copiar: ${en}`}
              >
                <Copy size={17} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
