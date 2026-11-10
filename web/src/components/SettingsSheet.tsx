import { Calendar, Check, Download, Link2, Monitor, Moon, Printer, RefreshCw, RotateCcw, Smartphone, Sun, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { copyText } from '../lib/format';
import { useInstall } from '../lib/install';
import { op } from '../lib/ops';
import { useStore, type ThemePref } from '../store';
import { AccountSection } from './AccountSection';
import { Confirm } from './ui/Confirm';
import { Seg } from './ui/Seg';
import { Sheet } from './ui/Sheet';

export default function SettingsSheet() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const snap = useStore((s) => s.snap)!;
  const dispatch = useStore((s) => s.dispatch);
  const toast = useStore((s) => s.toast);
  const online = useStore((s) => s.online);
  const pending = useStore((s) => s.pending);
  const refresh = useStore((s) => s.refresh);
  const authRequired = useStore((s) => s.authRequired);
  const replaceAll = useStore((s) => s.replaceAll);
  const resetToOriginal = useStore((s) => s.resetToOriginal);
  const install = useInstall();
  const file = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [name, setName] = useState(snap.trip.name);
  const [people, setPeople] = useState(snap.trip.travelers.join(', '));

  const close = () => setOpen(false);

  async function copyCalendar() {
    try {
      const { url } = await api.calendarLink();
      toast((await copyText(url)) ? 'Enlace copiado. Pégalo en “Suscribirse a calendario”.' : url, 'success');
    } catch {
      toast('No se pudo obtener el enlace (¿sin conexión?)', 'error');
    }
  }

  async function onImport(f: File | undefined) {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      await replaceAll(data);
      toast('Respaldo importado', 'success');
      close();
    } catch {
      toast('El archivo no es un respaldo válido', 'error');
    } finally {
      if (file.current) file.current.value = '';
    }
  }

  return (
    <>
      <Sheet open={open} onClose={close} title="Ajustes" wide>
        <div className="settings">
          <section>
            <h3>Apariencia</h3>
            <small className="muted">«Automático» usa el tema de tu teléfono.</small>
            <Seg<ThemePref>
              value={theme}
              onChange={setTheme}
              label="Tema"
              options={[
                { value: 'light', label: (<><Sun size={15} /> Claro</>) },
                { value: 'dark', label: (<><Moon size={15} /> Oscuro</>) },
                { value: 'auto', label: (<><Monitor size={15} /> Automático</>) },
              ]}
            />
          </section>

          {authRequired && <AccountSection />}

          <section>
            <h3>Viaje</h3>
            <div className="grid-2">
              <label className="field">
                <span>Nombre</span>
                <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== snap.trip.name && dispatch(op.trip({ name: name.trim() }))} />
              </label>
              <label className="field">
                <span>Viajeros (separados por coma)</span>
                <input
                  className="input"
                  value={people}
                  placeholder="Ej. Ana, Luis"
                  onChange={(e) => setPeople(e.target.value)}
                  onBlur={() => dispatch(op.trip({ travelers: people.split(',').map((p) => p.trim()).filter(Boolean).slice(0, 12) }))}
                />
              </label>
            </div>
          </section>

          <section>
            <h3>Calendario</h3>
            <div className="row wrap">
              <a className="btn ghost" href="/api/calendar.ics" download>
                <Calendar size={16} /> Descargar .ics
              </a>
              <button className="btn ghost" onClick={copyCalendar}>
                <Link2 size={16} /> Copiar enlace de suscripción
              </button>
            </div>
            <small className="muted">Suscribe tu calendario al itinerario y las reservas, con la zona horaria del viaje.</small>
          </section>

          <section>
            <h3>Datos</h3>
            <div className="row wrap">
              <a className="btn ghost" href="/api/export" download>
                <Download size={16} /> Exportar respaldo
              </a>
              <button className="btn ghost" onClick={() => file.current?.click()}>
                <Upload size={16} /> Importar respaldo
              </button>
              <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void onImport(e.target.files?.[0])} />
              <button
                className="btn ghost"
                onClick={() => {
                  close();
                  setTimeout(() => window.print(), 350);
                }}
              >
                <Printer size={16} /> Imprimir itinerario
              </button>
              <button className="btn danger" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={16} /> Restaurar plan original
              </button>
            </div>
          </section>

          <section>
            <h3>App</h3>
            <div className="row wrap">
              {install.state === 'available' && (
                <button className="btn yellow" onClick={() => void install.install()}>
                  <Smartphone size={16} /> Instalar en este dispositivo
                </button>
              )}
              {install.state === 'installed' && (
                <span className="chip ok">
                  <Check size={13} /> App instalada
                </span>
              )}
              {install.state === 'none' && <small className="muted">En el navegador usa “Añadir a pantalla de inicio” para instalarla.</small>}
              <button className="btn ghost" onClick={() => void refresh()}>
                <RefreshCw size={16} /> Sincronizar ahora
              </button>

            </div>
            <small className="muted">
              {online ? (pending > 0 ? `Conectado · ${pending} cambios por enviar` : 'Todo sincronizado') : 'Sin conexión · tus cambios se enviarán al volver internet'}
            </small>
            <small className="muted">
              <a href="#/legal/privacidad">Privacidad</a> · <a href="#/legal/terminos">Términos</a>
            </small>
          </section>

          <section className="kbd-section">
            <h3>Atajos de teclado</h3>
            <ul className="kbd-list">
              <li><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd> o <kbd>/</kbd> <span>Buscar</span></li>
              <li><kbd>←</kbd> <kbd>→</kbd> <span>Cambiar de día</span></li>
              <li><kbd>Esc</kbd> <span>Cerrar diálogos</span></li>
            </ul>
          </section>
        </div>
      </Sheet>
      <Confirm
        open={confirmReset}
        title="¿Restaurar el plan original?"
        message="Se reemplazarán todos los cambios (actividades, reservas, pendientes y gastos) por el plan inicial. Antes puedes exportar un respaldo."
        confirmLabel="Restaurar"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false);
          await resetToOriginal();
          toast('Plan original restaurado', 'success');
          close();
        }}
      />
    </>
  );
}
