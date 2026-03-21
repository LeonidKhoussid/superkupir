import type { PublicCatalogItem } from "./catalog.types";
import { toPublicCatalogItem } from "./catalog.types";
import type { CatalogRepository } from "./catalog.repository";

export class CatalogService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async listPlaceTypes(): Promise<PublicCatalogItem[]> {
    const items = await this.catalogRepository.listPlaceTypes();
    return items.map(toPublicCatalogItem);
  }

  async listSeasons(): Promise<PublicCatalogItem[]> {
    const items = await this.catalogRepository.listSeasons();
    return items.map(toPublicCatalogItem);
  }
}
