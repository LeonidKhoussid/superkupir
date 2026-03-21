import { AuthRepository } from "../auth/auth.repository";
import { PlaceInteractionsController } from "./place-interactions.controller";
import { PlaceInteractionsRepository } from "./place-interactions.repository";
import { createPlaceInteractionsRouter } from "./place-interactions.routes";
import { PlaceInteractionsService } from "./place-interactions.service";

const placeInteractionsRepository = new PlaceInteractionsRepository();
const authRepository = new AuthRepository();
const placeInteractionsService = new PlaceInteractionsService(
  placeInteractionsRepository,
  authRepository,
);
const placeInteractionsController = new PlaceInteractionsController(placeInteractionsService);

export const placeInteractionsRouter = createPlaceInteractionsRouter(placeInteractionsController);
