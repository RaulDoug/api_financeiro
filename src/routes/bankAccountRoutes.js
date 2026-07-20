import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import BankAccountController from '../controllers/bankAccountControllers.js';

const router = Router();
const bankAccountController = new BankAccountController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', bankAccountController.findAllOrFindOne);
router.post('/', bankAccountController.create);
router.patch('/:id', bankAccountController.update);
router.delete('/:id', bankAccountController.delete);

export default router;