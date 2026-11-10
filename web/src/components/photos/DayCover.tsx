import { CITY_META } from '../../../../shared/constants';
import type { PhotoInfo } from '../../lib/photos';
import { Photo, PhotoCredit } from './Photo';

/** Portada del día: foto del lugar principal, estática y estable (sin parallax), con degradé para legibilidad. */
export function DayCover({ photo }: { photo: PhotoInfo }) {
  return (
    <div className="day-cover">
      <div className="day-cover-img">
        <Photo photo={photo} width={1280} eager zoom alt={`${photo.name}, ${CITY_META[photo.city].name}`} />
      </div>
      <div className="day-cover-shade" aria-hidden="true" />
      <div className="day-cover-meta">
        <span className="day-cover-name">{photo.name}</span>
        <span className="day-cover-city">{CITY_META[photo.city].name}</span>
      </div>
      <PhotoCredit photo={photo} className="on-cover" />
    </div>
  );
}
