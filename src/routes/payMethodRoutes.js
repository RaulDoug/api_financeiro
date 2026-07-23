import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import PayMethodController from '../controllers/payMethodController.js';
import { validate } from '../middlewares/validate.js';
import * as payMethodSchema from '../schemas/payMethodSchema.js';

const router = Router();
const payMethodController = new PayMethodController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', validate(payMethodSchema.findAllOrFindOneSchema), payMethodController.findAllOrFindOne);
router.post('/register', validate(payMethodSchema.createSchema), payMethodController.create);
router.patch('/update/:id', validate(payMethodSchema.updateSchema), payMethodController.update);
router.delete('/delete/:id', validate(payMethodSchema.deleteSchema), payMethodController.delete);

export default router;