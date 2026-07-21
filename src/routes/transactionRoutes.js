import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import TransactionController from '../controllers/transactionController.js';

const router = Router();
const transactionController = new TransactionController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', transactionController.findAllOrFindOne);
router.post('/register', transactionController.create);
router.patch('/update/:id', transactionController.update);
router.delete('/delete/:id', transactionController.delete);

export default router;