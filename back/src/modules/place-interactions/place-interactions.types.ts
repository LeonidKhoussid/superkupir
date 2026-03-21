export interface CommentAuthor {
  id: string;
  email: string;
}

export interface PlaceCommentRecord {
  id: number;
  placeId: number;
  user: CommentAuthor;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicPlaceComment {
  id: number;
  place_id: number;
  user: CommentAuthor;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface PlaceCommentsListResult {
  items: PublicPlaceComment[];
  total: number;
  limit: number;
  offset: number;
}

export interface CommentListInput {
  limit: number;
  offset: number;
}

export interface LikeSummary {
  place_id: number;
  likes_count: number;
  liked_by_current_user: boolean | null;
}

export const toPublicPlaceComment = (comment: PlaceCommentRecord): PublicPlaceComment => ({
  id: comment.id,
  place_id: comment.placeId,
  user: comment.user,
  content: comment.content,
  created_at: comment.createdAt,
  updated_at: comment.updatedAt,
});
