import BaseController from './baseControllers.js';
import PayMathodServices from '../services/payMethodServices.js';

const payMethodServices = new PayMathodServices();

export default class PayMethodController extends BaseController {
  constructor() {
    super(payMethodServices);
  }
}