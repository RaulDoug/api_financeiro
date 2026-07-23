import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import BankAccountController from '../controllers/bankAccountControllers.js';
import { validate } from '../middlewares/validate.js';
import * as bASchema from '../schemas/bankAccountSchema.js';

const router = Router();
const bankAccountController = new BankAccountController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', validate(bASchema.findAllOrFindOneSchema), bankAccountController.findAllOrFindOne);
router.post('/register', validate(bASchema.createSchema), bankAccountController.create);
router.patch('/update/:id', validate(bASchema.updateSchema), bankAccountController.update);
router.delete('/delete/:id', validate(bASchema.deleteSchema), bankAccountController.delete);

export default router;