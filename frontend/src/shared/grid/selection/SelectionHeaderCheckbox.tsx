import { Checkbox, Tooltip } from '@mui/material';
import type { SelectionHeaderState } from './serverSelection';

export interface SelectionHeaderCheckboxProps extends SelectionHeaderState {
  label: string;
  onChange: (checked: boolean) => void;
}

/**
 * Displays the checkbox in AG Grid's selection-column header.
 *
 * This component knows nothing about page, filtered, or all selection. Each selection hook
 * calculates the state and passes it here, which lets both hooks share the same accessible UI.
 */
export function SelectionHeaderCheckbox({
  checked,
  indeterminate,
  disabled,
  label,
  onChange,
}: SelectionHeaderCheckboxProps) {
  return (
    <Tooltip title={label}>
      <span>
        <Checkbox
          size="small"
          checked={checked}
          indeterminate={indeterminate}
          disabled={disabled}
          inputProps={{ 'aria-label': label }}
          onClick={(event) => {
            // AG treats an ordinary header click as a possible sort action. Stopping propagation
            // makes this click belong only to our checkbox.
            event.stopPropagation();
            onChange(!checked);
          }}
        />
      </span>
    </Tooltip>
  );
}
