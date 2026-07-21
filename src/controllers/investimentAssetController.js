import BaseController from './baseControllers.js';
import InvestimentAssetServices from '../services/investimentAssetServices';

const investimentAssetServices = new InvestimentAssetServices();

export default class InvestimentAssetController extends BaseController {
  constructor() {
    super(investimentAssetServices);
  }
}