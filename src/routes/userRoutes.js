import { Router } from 'express';
import UserController from '../controllers/userController.js';
import { loginLimit } from '../middlewares/auth.js';

const router = Router();
const userController = new UserController();

router.post('/register', userController.userCad);
router.post('/login', loginLimit, userController.userLogin);

export default router;

