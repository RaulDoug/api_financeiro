import { Router } from 'express';
import WalletController from '../controllers/walletController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createWalletSchema, updateWalletSchema, deleteWalletSchema } from '../schemas/walletSchema.js';

const router = Router();
const walletController = new WalletController();

router.post('/register', authenticateJWT, validate(createWalletSchema), walletController.walletCad);
router.patch('/update/:id', authenticateJWT, validate(updateWalletSchema), walletController.walletUpdate);
router.delete('/delete/:id', authenticateJWT, validate(deleteWalletSchema), walletController.walletDelete);

export default router;