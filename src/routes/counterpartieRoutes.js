import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import CounterpartieController from '../controllers/counterpartieController.js';
import { validate } from '../middlewares/validate.js';
import * as counterpartieSchema from '../schemas/counterpartieSchema.js';

const router = Router();
const counterpartieController = new CounterpartieController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', validate(counterpartieSchema.findAllOrFindOneSchema), counterpartieController.findAllOrFindOne);
router.post('/register', validate(counterpartieSchema.createSchema), counterpartieController.create);
router.patch('/update/:id', validate(counterpartieSchema.updateSchema), counterpartieController.update);
router.delete('/delete/:id', validate(counterpartieSchema.deleteSchema), counterpartieController.delete);

export default router;