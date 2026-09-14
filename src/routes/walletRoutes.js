import { Router } from 'express';
import WalletController from '../controllers/walletController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createWalletSchema, updateWalletSchema, deleteWalletSchema } from '../schemas/walletSchema.js';

const router = Router();
const walletController = new WalletController();

router.use(authenticateJWT);

router.get('/', walletController.walletFind);
router.post('/register', validate(createWalletSchema), walletController.walletCad);
router.patch('/update/:id', validate(updateWalletSchema), walletController.walletUpdate);
router.delete('/delete/:id', validate(deleteWalletSchema), walletController.walletDelete);

export default router;