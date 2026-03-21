import { AppError } from "../../lib/errors";
import type { ListPlacesInput, PlacesListResult, PublicPlace } from "./places.types";
import { toPublicPlace } from "./places.types";
import type { PlacesRepository } from "./places.repository";

export class PlacesService {
  constructor(private readonly placesRepository: PlacesRepository) {}

  async listPlaces(filters: ListPlacesInput): Promise<PlacesListResult> {
    const result = await this.placesRepository.findMany(filters);

    return {
      items: result.items.map(toPublicPlace),
      total: result.total,
      limit: filters.limit ?? result.items.length,
      offset: filters.offset,
    };
  }

  async getPlaceById(id: number): Promise<PublicPlace> {
    const place = await this.placesRepository.findById(id);

    if (!place) {
      throw new AppError(404, "Place not found");
    }

    return toPublicPlace(place);
  }
}
