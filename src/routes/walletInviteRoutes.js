import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import { validate } from '../middlewares/validate.js';
import WalletInviteController from '../controllers/walletInviteController.js';
import { createWalletInviteSchema, acceptWalletInviteSchema } from '../schemas/walletInviteSchema.js';

const router = Router();
const walletInviteController = new WalletInviteController();

router.use(authenticateJWT);

router.get('/find-invites', walletInviteController.findWalletInvites);
router.post('/send-invite', injectActiveWallet, validate(createWalletInviteSchema), walletInviteController.walletInvite);
router.patch('/accept-invite', validate(acceptWalletInviteSchema), walletInviteController.walletAccept);

export default router;