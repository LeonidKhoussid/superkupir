import { CatalogRepository } from "../catalog/catalog.repository";
import { PlacesRepository } from "../places/places.repository";
import { RoutesRepository } from "../routes/routes.repository";
import { RoutesService } from "../routes/routes.service";
import { RouteBuildSessionsController } from "./route-build-sessions.controller";
import { RouteBuildSessionsRepository } from "./route-build-sessions.repository";
import { createRouteBuildSessionsRouter } from "./route-build-sessions.routes";
import { RouteBuildSessionsService } from "./route-build-sessions.service";

const routeBuildSessionsRepository = new RouteBuildSessionsRepository();
const placesRepository = new PlacesRepository();
const catalogRepository = new CatalogRepository();
const routesRepository = new RoutesRepository();
const routesService = new RoutesService(routesRepository, placesRepository, catalogRepository);
const routeBuildSessionsService = new RouteBuildSessionsService(
  routeBuildSessionsRepository,
  placesRepository,
  catalogRepository,
  routesService,
);
const routeBuildSessionsController = new RouteBuildSessionsController(routeBuildSessionsService);

export const routeBuildSessionsRouter = createRouteBuildSessionsRouter(
  routeBuildSessionsController,
);
