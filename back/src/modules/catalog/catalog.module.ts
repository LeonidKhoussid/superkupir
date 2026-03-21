import { CatalogController } from "./catalog.controller";
import { CatalogRepository } from "./catalog.repository";
import { createCatalogRouter } from "./catalog.routes";
import { CatalogService } from "./catalog.service";

const catalogRepository = new CatalogRepository();
const catalogService = new CatalogService(catalogRepository);
const catalogController = new CatalogController(catalogService);

export const catalogRouter = createCatalogRouter(catalogController);
