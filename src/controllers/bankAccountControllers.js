import BaseController from './baseControllers.js';
import BankAccountServices from '../services/bankAccountSerivices.js';

const bankAccountSerivices = new BankAccountServices();

export default class BankAccountController extends BaseController {
  constructor() {
    super(bankAccountSerivices);
  }
}