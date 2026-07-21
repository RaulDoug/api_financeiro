import BaseController from './baseControllers.js';
import CategorieServices from '../services/categorieServices.js';

const categorieServices = new CategorieServices();

export default class CategorieController extends BaseController {
  constructor() {
    super(categorieServices);
  }
}