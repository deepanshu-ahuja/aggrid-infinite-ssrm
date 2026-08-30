/**
 * Reusable configuration root for one configurable business feature.
 *
 * Feature implementations provide their concrete keys and entity definitions while
 * sharing the same configuration shape.
 */
export interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
> {
  /**
   * Stable programmatic identifier for this feature definition.
   *
   * @example
   * "review"
   */
  featureKey: TFeatureKey;

  /**
   * Entity definitions available to the feature, keyed by their stable entity identifier.
   * Each record value contains the configuration for that entity/data context.
   *
   * @example
   * { loan: loanDefinition, finance: financeDefinition }
   */
  entities: Record<TEntityKey, EntityDefinition>;
}

/**
 * Reusable configuration for one entity/data context inside a configurable feature.
 */
export interface EntityDefinition {
  /**
   * Full translation key used to resolve the entity label displayed by the UI.
   *
   * @example
   * "review.entities.loan.label"
   */
  labelKey: string;

  /**
   * Key of the registered frontend data adapter used for this entity's data operations.
   *
   * The resolved adapter provides the feature/entity-specific boundary for loading rows,
   * saving changes, and mapping grid requests and API responses to the backend contract.
   *
   * @example
   * "reviewLoan"
   */
  dataAdapterKey: string;

  /**
   * Defines how the stable unique identifier is read from every API row for this entity.
   * The identifier lets grid-related state consistently refer to the same business record.
   */
  rowId: RowIdDefinition;
}

/**
 * Defines how to locate an entity row's stable unique identifier in the API row shape.
 */
export interface RowIdDefinition {
  /**
   * Field path in each API row that contains the stable unique identifier for that
   * business record. Dot notation is supported for nested API row shapes.
   *
   * @example
   * "id"
   *
   * @example
   * "loan.id"
   */
  path: string;
}
