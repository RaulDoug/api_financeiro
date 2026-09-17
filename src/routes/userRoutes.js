import { Router } from 'express';
import UserController from '../controllers/userController.js';
import { loginLimit, registerLimit } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createUserSchema, loginUserSchema } from '../schemas/userSchema.js';

const router = Router();
const userController = new UserController();

router.post('/register', registerLimit, validate(createUserSchema), userController.userCad);
router.post('/login', loginLimit, validate(loginUserSchema), userController.userLogin);

export default router;

