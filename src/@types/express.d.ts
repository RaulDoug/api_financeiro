import 'express';

declare global {
  namespace Express {
    interface Request {
      activeWalletId?: string;
      user?: {
        id: string;
        email?: string;
      }
    }
  }
}