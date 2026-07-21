import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import InvestimentAssetController from '../controllers/investimentAssetController.js';

const router = Router();
const investimentAssetController = new InvestimentAssetController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', investimentAssetController.findAllOrFindOne);
router.post('/register', investimentAssetController.create);
router.patch('/update/:id', investimentAssetController.update);
router.delete('/delete/:id', investimentAssetController.delete);

export default router;