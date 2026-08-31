import { describe, expect, it } from 'vitest';
import {
  configurableSsrmGridDefaults,
  resolveConfigurableSsrmGridOptions,
} from './configuration.defaults';

describe('configurable SSRM defaults', () => {
  it('merges top-level values and nested defaultColDef params deterministically', () => {
    const resolved = resolveConfigurableSsrmGridOptions(configurableSsrmGridDefaults, {
      paginationPageSize: 50,
      defaultColDef: {
        resizable: false,
        filterParams: { debounceMs: 250 },
        cellEditorParams: { maxLength: 20 },
      },
    });

    expect(resolved.paginationPageSize).toBe(50);
    expect(resolved.cacheBlockSize).toBe(configurableSsrmGridDefaults.cacheBlockSize);
    expect(resolved.defaultColDef).toMatchObject({
      sortable: false,
      filter: false,
      resizable: false,
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true,
        maxNumConditions: 1,
        debounceMs: 250,
      },
      cellEditorParams: { maxLength: 20 },
    });
  });

  it('replaces rowSelection when the native discriminated mode changes', () => {
    const resolved = resolveConfigurableSsrmGridOptions(configurableSsrmGridDefaults, {
      rowSelection: {
        mode: 'singleRow',
        checkboxes: false,
        enableClickSelection: true,
      },
    });

    expect(resolved.rowSelection).toEqual({
      mode: 'singleRow',
      checkboxes: false,
      enableClickSelection: true,
    });
  });

  it('merges same-mode fill handles and replaces a different handle mode', () => {
    const mergedFill = resolveConfigurableSsrmGridOptions(configurableSsrmGridDefaults, {
      cellSelection: {
        suppressMultiRanges: true,
        handle: { mode: 'fill', suppressClearOnFillReduction: true },
      },
    });

    expect(mergedFill.cellSelection).toMatchObject({
      enableHeaderHighlight: true,
      suppressMultiRanges: true,
      handle: {
        mode: 'fill',
        direction: 'y',
        suppressClearOnFillReduction: true,
      },
    });

    const range = resolveConfigurableSsrmGridOptions(configurableSsrmGridDefaults, {
      cellSelection: { handle: { mode: 'range' } },
    });

    expect(range.cellSelection).toMatchObject({
      enableHeaderHighlight: true,
      handle: { mode: 'range' },
    });
    expect((range.cellSelection as { handle?: object }).handle).not.toHaveProperty('direction');
  });

  it('treats boolean cellSelection as a complete native replacement', () => {
    const resolved = resolveConfigurableSsrmGridOptions(configurableSsrmGridDefaults, {
      cellSelection: false,
    });
    expect(resolved.cellSelection).toBe(false);
  });
});
