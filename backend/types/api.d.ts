/**
 * API request/response types
 */

import { Request, Response, NextFunction } from 'express';
import { User, Spec, Entitlement, BlogPost, Article, ApiResponse, PaginatedResponse } from './common';

// Request types
export interface CreateUserRequest {
  userData?: Partial<User>;
}

export interface CreateSpecRequest {
  title: string;
  content: {
    overview?: any;
    technical?: any;
    market?: any;
    design?: any;
    [key: string]: any;
  };
}

export interface UpdateSpecRequest {
  title?: string;
  content?: {
    overview?: any;
    technical?: any;
    market?: any;
    design?: any;
    [key: string]: any;
  };
}

export interface ConsumeCreditsRequest {
  amount: number;
  reason: string;
}

export interface RefundCreditsRequest {
  amount: number;
  reason: string;
}

export interface CreateBlogPostRequest {
  title: string;
  content: string;
  excerpt?: string;
  author?: string;
  published?: boolean;
}

export interface UpdateBlogPostRequest {
  title?: string;
  content?: string;
  excerpt?: string;
  author?: string;
  published?: boolean;
}

export interface CreateArticleRequest {
  title: string;
  content: string;
  excerpt?: string;
  featured?: boolean;
}

export interface UpdateArticleRequest {
  title?: string;
  content?: string;
  excerpt?: string;
  featured?: boolean;
}

// Response types
export type UserResponse = ApiResponse<User>;
export type SpecResponse = ApiResponse<Spec>;
export type SpecsResponse = ApiResponse<PaginatedResponse<Spec>>;
export type EntitlementResponse = ApiResponse<Entitlement>;
export type BlogPostResponse = ApiResponse<BlogPost>;
export type BlogPostsResponse = ApiResponse<PaginatedResponse<BlogPost>>;
export type ArticleResponse = ApiResponse<Article>;
export type ArticlesResponse = ApiResponse<PaginatedResponse<Article>>;

// Route handler types
export type RouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;
export type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;


