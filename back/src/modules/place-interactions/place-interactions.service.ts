import { AppError } from "../../lib/errors";
import { AuthRepository } from "../auth/auth.repository";
import type {
  CommentListInput,
  LikeSummary,
  PlaceCommentsListResult,
  PublicPlaceComment,
} from "./place-interactions.types";
import { toPublicPlaceComment } from "./place-interactions.types";
import type { PlaceInteractionsRepository } from "./place-interactions.repository";

export class PlaceInteractionsService {
  constructor(
    private readonly placeInteractionsRepository: PlaceInteractionsRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  private async ensurePlaceExists(placeId: number): Promise<void> {
    const exists = await this.placeInteractionsRepository.placeExists(placeId);

    if (!exists) {
      throw new AppError(404, "Place not found");
    }
  }

  private async ensureAuthenticatedUserExists(userId: string): Promise<void> {
    const user = await this.authRepository.findById(userId);

    if (!user) {
      throw new AppError(401, "Authenticated user not found");
    }
  }

  async likePlace(placeId: number, userId: string): Promise<{ liked: true; likes_count: number }> {
    await this.ensurePlaceExists(placeId);
    await this.ensureAuthenticatedUserExists(userId);
    await this.placeInteractionsRepository.likePlace(placeId, userId);

    const summary = await this.placeInteractionsRepository.getLikeSummary(placeId, userId);

    return {
      liked: true,
      likes_count: summary.likes_count,
    };
  }

  async unlikePlace(placeId: number, userId: string): Promise<{ liked: false; likes_count: number }> {
    await this.ensurePlaceExists(placeId);
    await this.ensureAuthenticatedUserExists(userId);
    await this.placeInteractionsRepository.unlikePlace(placeId, userId);

    const summary = await this.placeInteractionsRepository.getLikeSummary(placeId, userId);

    return {
      liked: false,
      likes_count: summary.likes_count,
    };
  }

  async getLikeSummary(placeId: number, userId?: string): Promise<LikeSummary> {
    await this.ensurePlaceExists(placeId);

    if (userId) {
      await this.ensureAuthenticatedUserExists(userId);
    }

    return this.placeInteractionsRepository.getLikeSummary(placeId, userId);
  }

  async listComments(placeId: number, pagination: CommentListInput): Promise<PlaceCommentsListResult> {
    await this.ensurePlaceExists(placeId);

    const result = await this.placeInteractionsRepository.listComments(placeId, pagination);

    return {
      items: result.items.map(toPublicPlaceComment),
      total: result.total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }

  async createComment(placeId: number, userId: string, content: string): Promise<PublicPlaceComment> {
    await this.ensurePlaceExists(placeId);
    await this.ensureAuthenticatedUserExists(userId);

    const comment = await this.placeInteractionsRepository.createComment(placeId, userId, content);
    return toPublicPlaceComment(comment);
  }
}
