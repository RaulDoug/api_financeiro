import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import TransactionController from '../controllers/transactionController.js';
import { validate } from '../middlewares/validate.js';
import * as transactionSchema from '../schemas/transactionSchema.js';

const router = Router();
const transactionController = new TransactionController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', validate(transactionSchema.findSchema), transactionController.find);
router.post('/register', validate(transactionSchema.createSchema), transactionController.create);
router.patch('/update/:id', validate(transactionSchema.updateSchema), transactionController.update);
router.delete('/delete/:id', validate(transactionSchema.deleteSchema), transactionController.delete);

export default router;