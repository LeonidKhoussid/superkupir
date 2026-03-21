import { AppError } from "../../lib/errors";
import type { AuthRepository } from "../auth/auth.repository";
import { toPublicPost } from "./posts.types";
import type { PostsRepository } from "./posts.repository";

export class PostsService {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  async listPosts(input: {
    guide?: boolean;
    mine?: boolean;
    userId?: string;
    limit: number;
    offset: number;
  }) {
    if (input.mine && !input.userId) {
      throw new AppError(401, "Authentication required");
    }

    const result = await this.postsRepository.list(input);

    return {
      items: result.items.map(toPublicPost),
      total: result.total,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async getPostById(id: number) {
    const post = await this.postsRepository.findById(id);

    if (!post) {
      throw new AppError(404, "Post not found");
    }

    return toPublicPost(post);
  }

  async createPost(userId: string, input: { title?: string | null; content: string; imageUrls: string[] }) {
    await this.ensureUserExists(userId);
    const post = await this.postsRepository.create({
      userId,
      title: input.title ?? null,
      content: input.content,
      imageUrls: input.imageUrls,
    });

    return toPublicPost(post);
  }

  async updatePost(
    id: number,
    userId: string,
    input: { title?: string | null; content?: string; imageUrls?: string[] },
  ) {
    const post = await this.postsRepository.findById(id);

    if (!post) {
      throw new AppError(404, "Post not found");
    }

    if (post.author.id !== userId) {
      throw new AppError(403, "Only the post owner can edit this post");
    }

    await this.postsRepository.update(id, input);
    return this.getPostById(id);
  }

  async deletePost(id: number, userId: string): Promise<void> {
    const post = await this.postsRepository.findById(id);

    if (!post) {
      throw new AppError(404, "Post not found");
    }

    if (post.author.id !== userId) {
      throw new AppError(403, "Only the post owner can delete this post");
    }

    await this.postsRepository.delete(id);
  }

  private async ensureUserExists(userId: string) {
    const user = await this.authRepository.findById(userId);

    if (!user) {
      throw new AppError(401, "Authenticated user not found");
    }
  }
}
