import BaseServices from './baseServices.js';
import pool from '../config/db.js';

export default class PayMethodServices extends BaseServices {
  constructor() {
    super('pay_methods');
  }
}