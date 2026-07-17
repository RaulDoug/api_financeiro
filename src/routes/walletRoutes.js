import { Router } from 'express';
import WalletController from '../controllers/walletController.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = Router();
const walletController = new WalletController();

router.post('/register', authenticateJWT, walletController.walletCad);
router.patch('/update/:id', authenticateJWT, walletController.walletUpdate);
router.delete('/delete/:id', authenticateJWT, walletController.walletDelete);

export default router;