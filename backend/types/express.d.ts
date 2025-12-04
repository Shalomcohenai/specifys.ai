/**
 * Express extensions
 */

import { DecodedIdToken } from 'firebase-admin/auth';
import { User, Spec, Entitlement } from './common';

declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken;
      requestId?: string;
      [key: string]: any;
    }

    interface Response {
      [key: string]: any;
    }
  }
}

export {};


