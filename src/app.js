import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import bankAccountRoutes from './routes/bankAccountRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/bankAccount', bankAccountRoutes);


export default app;