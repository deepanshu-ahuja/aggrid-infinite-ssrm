import type {
  TransactionBulkUpdateItem,
  TransactionStatus,
  TransactionUpdateChanges,
} from '../api/transactions.contracts';
import type { TransactionUpdatePayload } from './transactionEditing';

const TRANSACTION_STATUSES: readonly TransactionStatus[] = ['Completed', 'Pending', 'Failed'];
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function hasOwn<T extends object>(value: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/** Convert tracked draft changes back into the strict Transactions API patch shape before transport. */
export function mapTransactionUpdateChanges(
  changes: TransactionUpdatePayload['updates'][number]['changes'],
): TransactionUpdateChanges {
  const mapped: TransactionUpdateChanges = {};

  if (hasOwn(changes, 'account')) {
    if (typeof changes.account !== 'string') throw new Error('Transaction account must be a string.');
    mapped.account = changes.account;
  }

  if (hasOwn(changes, 'amount')) {
    if (typeof changes.amount !== 'number' || !Number.isFinite(changes.amount)) {
      throw new Error('Transaction amount must be a finite number.');
    }
    mapped.amount = changes.amount;
  }

  if (hasOwn(changes, 'currency')) {
    if (typeof changes.currency !== 'string') throw new Error('Transaction currency must be a string.');
    mapped.currency = changes.currency;
  }

  if (hasOwn(changes, 'status')) {
    if (
      typeof changes.status !== 'string' ||
      !TRANSACTION_STATUSES.includes(changes.status as TransactionStatus)
    ) {
      throw new Error('Transaction status is invalid.');
    }
    mapped.status = changes.status as TransactionStatus;
  }

  if (hasOwn(changes, 'transactionDate')) {
    if (
      typeof changes.transactionDate !== 'string' ||
      !ISO_DATE_PATTERN.test(changes.transactionDate)
    ) {
      throw new Error('Transaction date must be an ISO date (YYYY-MM-DD).');
    }
    mapped.transactionDate = changes.transactionDate;
  }

  if (Object.keys(mapped).length === 0) {
    throw new Error('Transaction update must contain at least one editable field.');
  }

  return mapped;
}

export function mapTransactionBulkUpdateItems(
  updates: TransactionUpdatePayload['updates'],
): TransactionBulkUpdateItem[] {
  return updates.map((update) => ({
    id: update.id,
    changes: mapTransactionUpdateChanges(update.changes),
  }));
}
