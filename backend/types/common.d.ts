/**
 * Common types for Specifys.ai backend
 */

export interface User {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  [key: string]: any;
}

export interface Spec {
  id: string;
  userId: string;
  title: string;
  content: {
    overview?: any;
    technical?: any;
    market?: any;
    design?: any;
    [key: string]: any;
  };
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: any;
}

export interface Entitlement {
  userId: string;
  credits: number;
  subscriptions?: {
    [key: string]: {
      status: string;
      expiresAt?: Date | string;
      [key: string]: any;
    };
  };
  purchases?: {
    [key: string]: {
      amount: number;
      purchasedAt: Date | string;
      [key: string]: any;
    };
  };
  [key: string]: any;
}

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  author?: string;
  published: boolean;
  publishedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: any;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  featured: boolean;
  views: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}


