import type { CatalogPlace } from '../../../shared/catalog';
import raw from '../../../shared/catalog.json';

export const CATALOG: CatalogPlace[] = raw as unknown as CatalogPlace[];
export const CATALOG_BY_ID: Map<string, CatalogPlace> = new Map(CATALOG.map((p) => [p.id, p]));
