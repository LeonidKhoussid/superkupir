export interface ListPlacesInput {
  limit?: number;
  offset: number;
  q?: string;
  name?: string;
  sourceLocation?: string;
}

export interface PlaceRecord {
  id: number;
  externalId: string;
  name: string;
  sourceLocation: string | null;
  cardUrl: string | null;
  logoUrl: string | null;
  size: string | null;
  description: string | null;
  photoUrls: string[];
  lat: number | null;
  lon: number | null;
  coordinatesRaw: string | null;
  address: string | null;
}

export interface PublicPlace {
  id: number;
  external_id: string;
  name: string;
  source_location: string | null;
  card_url: string | null;
  logo_url: string | null;
  size: string | null;
  description: string | null;
  photo_urls: string[];
  lat: number | null;
  lon: number | null;
  coordinates_raw: string | null;
  address: string | null;
}

export interface PlacesListResult {
  items: PublicPlace[];
  total: number;
  limit: number;
  offset: number;
}

export const toPublicPlace = (place: PlaceRecord): PublicPlace => ({
  id: place.id,
  external_id: place.externalId,
  name: place.name,
  source_location: place.sourceLocation,
  card_url: place.cardUrl,
  logo_url: place.logoUrl,
  size: place.size,
  description: place.description,
  photo_urls: place.photoUrls,
  lat: place.lat,
  lon: place.lon,
  coordinates_raw: place.coordinatesRaw,
  address: place.address,
});
