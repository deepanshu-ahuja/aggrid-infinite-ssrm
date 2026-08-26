import type { IDateFilterParams, INumberFilterParams, ITextFilterParams } from 'ag-grid-community';

/**
 * Behaviour shared by AG Grid's server-backed Simple Filters.
 *
 * Why this exists:
 * - Text, Number, and Date filters should present the same Apply/Reset interaction.
 * - Server-backed grids should not send a request for every intermediate value while the user is
 *   still constructing a filter.
 * - Our current backend filter contract supports one condition per column, so the UI must not
 *   expose AG Grid's default second condition (AND / OR) until that contract is extended.
 *
 * This is deliberately kept as a small internal building block rather than exported as another
 * application abstraction. Tables consume the typed presets below.
 */
const serverSimpleFilterBehaviour: Pick<
  ITextFilterParams,
  'buttons' | 'maxNumConditions' | 'closeOnApply'
> = {
  /**
   * `reset` removes the currently applied filter for the column.
   *
   * `apply` means edits in the popup are not applied to the grid until the user explicitly confirms
   * them. That is useful for server-backed grids because applying a filter causes data to be loaded
   * again from the backend.
   */
  buttons: ['reset', 'apply'],

  /**
   * AG Grid Simple Filters support multiple conditions joined by AND / OR and default to allowing
   * two conditions. Our current server query contract only represents one condition per field, so
   * keep the UI to one condition until the mapper + API contract + backend are extended together.
   */
  maxNumConditions: 1,

  /**
   * Close the filter popup after Apply or Reset so the user immediately returns to the table after
   * committing the change.
   */
  closeOnApply: true,
};

/**
 * Default Text Filter parameters for server-backed application grids.
 *
 * These operators are intentionally narrower than AG Grid's complete Text Filter feature set.
 * Do not add operators here only because AG Grid supports them; first make sure the shared backend
 * query contract, feature mapper, and backend implementation can represent the same semantics.
 *
 * A specific column can still override a setting without abandoning the shared defaults:
 *
 * ```ts
 * filterParams: {
 *   ...serverTextFilterParams,
 *   filterOptions: ['equals', 'notEqual'],
 * }
 * ```
 *
 * That pattern is appropriate for categorical text fields that should not expose free-form
 * operators such as `contains`.
 */
export const serverTextFilterParams = {
  ...serverSimpleFilterBehaviour,
  filterOptions: ['contains', 'equals', 'notEqual', 'startsWith', 'endsWith'],
} satisfies ITextFilterParams;

/**
 * Default Number Filter parameters for server-backed application grids.
 *
 * `inRange`, `blank`, and `notBlank` are intentionally not exposed yet because the current backend
 * request contract does not represent those cases. Range filtering can be added later by extending
 * the end-to-end contract rather than teaching a single table a private payload shape.
 */
export const serverNumberFilterParams = {
  ...serverSimpleFilterBehaviour,
  filterOptions: [
    'equals',
    'notEqual',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
  ],
} satisfies INumberFilterParams;

/**
 * Default Date Filter parameters for server-backed application grids.
 *
 * AG Grid represents "Before" as `lessThan` and "After" as `greaterThan`. The mapper is responsible
 * for translating the selected date value into the application's backend representation.
 *
 * `inRange`, `blank`, and `notBlank` remain disabled until the shared query contract and backend
 * support them.
 */
export const serverDateFilterParams = {
  ...serverSimpleFilterBehaviour,
  filterOptions: ['equals', 'notEqual', 'lessThan', 'greaterThan'],
} satisfies IDateFilterParams;
