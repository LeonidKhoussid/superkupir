import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/errors";
import type { CatalogService } from "./catalog.service";

export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  listPlaceTypes = asyncHandler(async (_request: Request, response: Response) => {
    const result = await this.catalogService.listPlaceTypes();
    response.status(200).json({ items: result });
  });

  listSeasons = asyncHandler(async (_request: Request, response: Response) => {
    const result = await this.catalogService.listSeasons();
    response.status(200).json({ items: result });
  });
}
