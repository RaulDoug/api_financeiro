import BaseController from './baseControllers.js';
import CounterpartieServices from '../services/counterpartieServices.js';

const counterpartieServices = new CounterpartieServices();

export default class CounterpartieController extends BaseController {
  constructor() {
    super(counterpartieServices);
  }
}