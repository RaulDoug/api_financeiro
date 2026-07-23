import { Router } from 'express';
import UserController from '../controllers/userController.js';
import { loginLimit } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createUserSchema, loginUserSchema } from '../schemas/userSchema.js';

const router = Router();
const userController = new UserController();

router.post('/register', validate(createUserSchema), userController.userCad);
router.post('/login', validate(loginUserSchema), loginLimit, userController.userLogin);

export default router;

