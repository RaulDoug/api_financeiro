import { Router } from 'express';
import UserController from '../controllers/userController.js';
import { loginLimit, registerLimit, authenticateJWT } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createUserSchema, loginUserSchema, findUserByEmailSchema } from '../schemas/userSchema.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';

const router = Router();
const userController = new UserController();

router.post('/register', registerLimit, validate(createUserSchema), userController.userCad);
router.post('/login', loginLimit, validate(loginUserSchema), userController.userLogin);
router.get('/find-all', authenticateJWT, injectActiveWallet, userController.userFindAll);
router.get('/find-by-email/:id', authenticateJWT, injectActiveWallet, validate(findUserByEmailSchema), userController.userFindByEmail);

export default router;

