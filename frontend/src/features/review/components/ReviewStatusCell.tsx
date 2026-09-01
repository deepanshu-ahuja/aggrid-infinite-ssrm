import { Chip } from '@mui/material';
import type { ICellRendererParams } from 'ag-grid-community';
import type { ReviewRuntimeRow } from '../configurable/reviewRuntime.types';

/**
 * Small presentation-only registry component shared by Review entities.
 * Business status vocabulary stays in entity config/validators; this renderer only displays a value.
 */
export function ReviewStatusCell({ value }: ICellRendererParams<ReviewRuntimeRow, unknown>) {
  const label = typeof value === 'string' ? value : '';
  return <Chip label={label} size="small" variant="outlined" />;
}
