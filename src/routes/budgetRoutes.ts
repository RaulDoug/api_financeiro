import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import { validate } from '../middlewares/validate.js';
import BudgetController from '../controllers/budgetController.js';
import * as budgetSchema from '../schemas/budgetSchema.js';

const router = Router();
const budgetController =  new BudgetController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/', validate(budgetSchema.listBudgetsSchema), budgetController.listBudgets);
router.get('/find', validate(budgetSchema.findAllOrFindOneSchema), budgetController.findOneOrAllBudget);
router.get('/summary', validate(budgetSchema.summarySchema), budgetController.getBudgetSummary);
router.get('/amount', validate(budgetSchema.calculateCategoryAmountSchema), budgetController.calculateCategoryAmountBudget);
router.post('/register', validate(budgetSchema.createSchema), budgetController.createBudget);
router.patch('/update/:id', validate(budgetSchema.updateSchema), budgetController.updateBudget);
router.patch('/recalculate_used_amount', validate(budgetSchema.calculateCategoryAmountSchema), budgetController.recalculateUsedAmountBudget);
router.delete('/delete/:id', validate(budgetSchema.deleteSchema), budgetController.deleteBudget);

export default router;