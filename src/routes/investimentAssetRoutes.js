import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import InvestimentAssetController from '../controllers/investimentAssetController.js';
import { validate } from '../middlewares/validate.js';
import * as investimentAssetSchema from '../schemas/investmentAssetSchema.js';

const router = Router();
const investimentAssetController = new InvestimentAssetController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', validate(investimentAssetSchema.findAllOrFindOneSchema), investimentAssetController.findAllOrFindOne);
router.post('/register', validate(investimentAssetSchema.createSchema), investimentAssetController.create);
router.patch('/update/:id', validate(investimentAssetSchema.updateSchema), investimentAssetController.update);
router.delete('/delete/:id', validate(investimentAssetSchema.deleteSchema), investimentAssetController.delete);

export default router;