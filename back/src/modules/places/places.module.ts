import { PlacesController } from "./places.controller";
import { PlacesRepository } from "./places.repository";
import { createPlacesRouter } from "./places.routes";
import { PlacesService } from "./places.service";

const placesRepository = new PlacesRepository();
const placesService = new PlacesService(placesRepository);
const placesController = new PlacesController(placesService);

export const placesRouter = createPlacesRouter(placesController);
