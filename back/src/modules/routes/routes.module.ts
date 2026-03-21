import { CatalogRepository } from "../catalog/catalog.repository";
import { PlacesRepository } from "../places/places.repository";
import { RoutesController } from "./routes.controller";
import { RoutesRepository } from "./routes.repository";
import { createRoutesRouter } from "./routes.routes";
import { RoutesService } from "./routes.service";

const routesRepository = new RoutesRepository();
const placesRepository = new PlacesRepository();
const catalogRepository = new CatalogRepository();
const routesService = new RoutesService(routesRepository, placesRepository, catalogRepository);
const routesController = new RoutesController(routesService);

export const routesRouter = createRoutesRouter(routesController);
