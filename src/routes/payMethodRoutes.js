import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import PayMethodController from '../controllers/payMethodController.js';

const router = Router();
const payMethodController = new PayMethodController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', payMethodController.findAllOrFindOne);
router.post('/register', payMethodController.create);
router.patch('/update/:id', payMethodController.update);
router.delete('/delete/:id', payMethodController.delete);

export default router;