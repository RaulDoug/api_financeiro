import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import CounterpartieController from '../controllers/counterpartieController.js';

const router = Router();
const counterpartieController = new CounterpartieController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', counterpartieController.findAllOrFindOne);
router.post('/register', counterpartieController.create);
router.patch('/update/:id', counterpartieController.update);
router.delete('/delete/:id', counterpartieController.delete);

export default router;