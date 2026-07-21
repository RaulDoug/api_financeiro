import BaseController from './baseControllers.js';
import TransactionServices from '../services/transactionServices.js';

const transactionServices = new TransactionServices();

export default class TransactionController extends BaseController {
  constructor() {
    super(transactionServices);
  }
}