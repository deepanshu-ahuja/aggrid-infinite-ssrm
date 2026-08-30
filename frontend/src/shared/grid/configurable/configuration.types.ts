/**
 * Shared configuration for one configurable business feature.
 */
export interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
> {
  /**
   * Stable programmatic identifier for the feature.
   *
   * @example
   * "review"
   */
  featureKey: TFeatureKey;

  /**
   * Entity definitions available to the feature, keyed by their stable entity identifier.
   *
   * @example
   * { loan: loanDefinition, finance: financeDefinition }
   */
  entities: Record<TEntityKey, EntityDefinition>;
}

/**
 * Shared configuration for one entity/data context inside a configurable feature.
 */
export interface EntityDefinition {
  /**
   * Translation key used for the entity's displayed label.
   *
   * @example
   * "review.entities.loan.label"
   */
  labelKey: string;

  /**
   * Key of the registered frontend data adapter used for this entity's data operations.
   *
   * @example
   * "reviewLoan"
   */
  dataAdapterKey: string;

  /**
   * Defines where the stable unique identifier is found in each API row.
   */
  rowId: RowIdDefinition;
}

/**
 * Defines where an entity row's stable unique identifier is found.
 */
export interface RowIdDefinition {
  /**
   * Field path containing the row's stable unique identifier.
   * Dot notation is supported for nested API row shapes.
   *
   * @example
   * "id"
   *
   * @example
   * "loan.id"
   */
  path: string;
}
