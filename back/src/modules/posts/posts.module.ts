import { AuthRepository } from "../auth/auth.repository";
import { PostsController } from "./posts.controller";
import { PostsRepository } from "./posts.repository";
import { createPostsRouter } from "./posts.routes";
import { PostsService } from "./posts.service";

const postsRepository = new PostsRepository();
const authRepository = new AuthRepository();
const postsService = new PostsService(postsRepository, authRepository);
const postsController = new PostsController(postsService);

export const postsRouter = createPostsRouter(postsController);
