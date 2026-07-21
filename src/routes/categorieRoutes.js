import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import CategorieController from '../controllers/categorieControllers.js';

const router = Router();
const categorieController = new CategorieController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', categorieController.findAllOrFindOne);
router.post('/register', categorieController.create);
router.patch('/update/:id', categorieController.update);
router.delete('/delete/:id', categorieController.delete);

export default router;