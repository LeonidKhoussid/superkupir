export interface CatalogItemRecord {
  id: number;
  name: string;
  slug: string;
}

export interface PublicCatalogItem {
  id: number;
  name: string;
  slug: string;
}

export const toPublicCatalogItem = (item: CatalogItemRecord): PublicCatalogItem => ({
  id: item.id,
  name: item.name,
  slug: item.slug,
});
