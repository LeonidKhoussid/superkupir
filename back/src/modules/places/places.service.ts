import { AppError } from "../../lib/errors";
import type {
  ListPlacesInput,
  PlaceRecommendationInput,
  PlaceRecommendationsResult,
  PlacesListResult,
  PublicPlace,
} from "./places.types";
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

  async recommendPlaces(input: PlaceRecommendationInput): Promise<PlaceRecommendationsResult> {
    if (input.anchorPlaceId !== undefined) {
      const exists = await this.placesRepository.placeExists(input.anchorPlaceId);

      if (!exists) {
        throw new AppError(404, "Anchor place not found");
      }
    }

    const result = await this.placesRepository.findRecommendations(input);

    const payload: PlaceRecommendationsResult = {
      items: result.items.map((item) => ({
        ...toPublicPlace(item),
        distance_km: item.distanceKm,
      })),
      total: result.total,
      limit: input.limit,
    };

    if (result.broadFallback) {
      payload.recommendation_broad_fallback = true;
    }

    return payload;
  }
}
