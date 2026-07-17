import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import walletRoutes from './routes/walletRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', userRoutes);
app.use('/api/wallet', walletRoutes);


export default app;