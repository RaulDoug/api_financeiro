import { format, startOfMonth, endOfMonth, isValid, parseISO, isAfter } from 'date-fns';
import AppError from '../../errors/AppError';
import { todayHelper } from '../transactions/helpers/transactionsHelpers';

export const resolveDateRange = (filters = {}) => {
  const { today } = todayHelper();

  if (filters.startDate && filters.endDate) {
    const startDateIsValid = isValid(parseISO(filters.startDate));
    const endDateIsValida = isValid(parseISO(filters.endDate));

    if (!startDateIsValid || !endDateIsValida) {
      throw new AppError('Data inicial ou final inválida', 400);
    }

    const dateCompare = isAfter(filters.startDate, filters.endDate);

    if (dateCompare) {
      throw new AppError('Data inicial não pode ser maior que a data final', 400);
    }
  }

  const startDate = filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : format(startOfMonth(today), 'yyyy-MM-dd');
  const endDate = filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : format(endOfMonth(today), 'yyyy-MM-dd');

  return {
    startDate,
    endDate,
  };
};