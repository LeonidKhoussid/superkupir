export interface PostAuthorRecord {
  id: string;
  email: string;
  isGuide: boolean;
}

export interface PostRecord {
  id: number;
  author: PostAuthorRecord;
  title: string | null;
  content: string;
  imageUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicPostAuthor {
  id: string;
  email: string;
  is_guide: boolean;
}

export interface PublicPost {
  id: number;
  author: PublicPostAuthor;
  title: string | null;
  content: string;
  image_urls: string[];
  created_at: Date;
  updated_at: Date;
}

export const toPublicPost = (post: PostRecord): PublicPost => ({
  id: post.id,
  author: {
    id: post.author.id,
    email: post.author.email,
    is_guide: post.author.isGuide,
  },
  title: post.title,
  content: post.content,
  image_urls: post.imageUrls,
  created_at: post.createdAt,
  updated_at: post.updatedAt,
});
