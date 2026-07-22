import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import bankAccountRoutes from './routes/bankAccountRoutes.js';
import categorieRoutes from './routes/categorieRoutes.js';
import counterpartieRoutes from './routes/counterpartieRoutes.js';
import payMethodRoutes from './routes/payMethodRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import investimentAssetRoutes from './routes/investimentAssetRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/bank-account', bankAccountRoutes);
app.use('/api/categorie', categorieRoutes);
app.use('/api/counterpartie', counterpartieRoutes);
app.use('/api/pay-method', payMethodRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/investiment-asset', investimentAssetRoutes);


export default app;