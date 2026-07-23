import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import CategorieController from '../controllers/categorieControllers.js';
import { validate } from '../middlewares/validate.js';
import * as categorieSchema from '../schemas/categorieSchema.js';

const router = Router();
const categorieController = new CategorieController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', validate(categorieSchema.findAllOrFindOneSchema), categorieController.findAllOrFindOne);
router.post('/register', validate(categorieSchema.createSchema), categorieController.create);
router.patch('/update/:id', validate(categorieSchema.updateSchema), categorieController.update);
router.delete('/delete/:id', validate(categorieSchema.deleteSchema), categorieController.delete);

export default router;