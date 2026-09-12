import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { injectActiveWallet } from '../middlewares/walletContext.js';
import DashboardController from '../controllers/dashboardControllers.js';

const router = Router();
const dashboardController = new DashboardController();

router.use(authenticateJWT);
router.use(injectActiveWallet);

router.get('/summary', dashboardController.getSummary);
router.get('/account-balances', dashboardController.getAccountBalances);
router.get('/expense-by-category', dashboardController.getExpensesByCategory);
router.get('/income-vs-expense', dashboardController.getIncomeVsExpense);
router.get('/credit-card-summary', dashboardController.getCreditCardSummary);
router.get('/overdue-alerts', dashboardController.getOverdueAlerts);
router.get('/recent-transactions', dashboardController.getRecentTransactions);

export default router;
