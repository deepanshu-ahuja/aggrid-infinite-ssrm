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

/** Semantic value categories understood by configurable field definitions. */
export type FieldDataType = 'text' | 'number' | 'boolean' | 'date' | 'dateTime';

/** Base text-filter operators supported by the shared configurable filter vocabulary. */
export type TextFilterOperator =
  | 'contains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith';

/** Base number-filter operators supported by the shared configurable filter vocabulary. */
export type NumberFilterOperator =
  | 'equals'
  | 'notEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual';

/** Base date/date-time filter operators supported by the shared configurable filter vocabulary. */
export type DateFilterOperator = 'equals' | 'notEqual' | 'lessThan' | 'greaterThan';

/** Base boolean filter operators supported by the shared configurable filter vocabulary. */
export type BooleanFilterOperator = 'equals' | 'notEqual';

/** Union of the shared filter operators available before feature-specific extensions. */
export type FilterOperator =
  | TextFilterOperator
  | NumberFilterOperator
  | DateFilterOperator
  | BooleanFilterOperator;

/**
 * Resolves the shared filter-operator vocabulary appropriate for a semantic field type.
 */
export type FilterOperatorForDataType<TDataType extends FieldDataType> =
  TDataType extends 'text'
    ? TextFilterOperator
    : TDataType extends 'number'
      ? NumberFilterOperator
      : TDataType extends 'boolean'
        ? BooleanFilterOperator
        : TDataType extends 'date' | 'dateTime'
          ? DateFilterOperator
          : never;

/**
 * Filter configuration for one field.
 *
 * Supplying this object makes filtering available for the field and the operator list is the
 * complete set of choices exposed for that field. The list must contain at least one operator.
 */
export interface FieldFilterDefinition<TOperator extends string = FilterOperator> {
  /**
   * Operators the user is allowed to apply to this field.
   *
   * A concrete feature can narrow this list to a subset of the shared operators or extend the
   * field definition with additional registered operator keys when feature-specific semantics are
   * required.
   */
  operators: readonly [TOperator, ...TOperator[]];
}

/** Initial pin position available to a configurable field. */
export type FieldPinnedPosition = 'left' | 'right';

/**
 * Sizing constraints that continue to apply after the column is created.
 *
 * These are not user-state defaults: the configurable compiler maps them to normal AG Grid column
 * constraints so they remain authoritative while the column exists.
 */
export interface FieldSizingConstraintsDefinition {
  /**
   * Minimum column width in pixels.
   *
   * When omitted, the configurable grid inherits the shared grid minimum-width behavior.
   */
  minWidth?: number;

  /** Maximum column width in pixels. Omit when no field-specific maximum is required. */
  maxWidth?: number;

  /**
   * Whether the user can manually resize the column.
   *
   * When omitted, resizing remains enabled by the shared grid default.
   */
  resizable?: boolean;
}

/**
 * Initial sizing for one field plus the constraints that continue to apply afterwards.
 *
 * A field can start with either a fixed width or a flex weight, never both. Frontend-authored
 * definitions get that rule from this union; backend JSON must enforce the same rule during runtime
 * configuration validation.
 */
export type FieldSizingDefinition =
  | (FieldSizingConstraintsDefinition & {
      /**
       * Initial fixed width in pixels.
       *
       * The compiler maps this to AG Grid `initialWidth` so later user-resized/Grid-State width is
       * not overwritten merely because column definitions are rebuilt.
       */
      defaultWidth?: number;

      /** A fixed-width field cannot also declare an initial flex weight. */
      defaultFlex?: never;
    })
  | (FieldSizingConstraintsDefinition & {
      /** A flex-sized field cannot also declare an initial fixed width. */
      defaultWidth?: never;

      /**
       * Initial flex weight used to share remaining grid width with other flex columns.
       *
       * The compiler maps this to AG Grid `initialFlex`; `minWidth` and `maxWidth` can still bound
       * the flex result.
       */
      defaultFlex?: number;
    });

/**
 * Initial layout/default-state configuration for one field.
 *
 * These values establish the starting column state. They are intentionally separate from hard
 * sizing constraints so later persisted Grid State can restore user choices such as visibility,
 * pinning, width, and flex without column-definition refreshes resetting those choices.
 */
export interface FieldLayoutDefinition {
  /**
   * Whether the column is visible when first created.
   *
   * Omit for the normal visible default. The compiler maps this to AG Grid `initialHide` rather than
   * the stateful `hide` property so persisted user visibility can be restored later.
   */
  defaultVisible?: boolean;

  /**
   * Side on which the column is pinned when first created.
   *
   * Omit for an initially unpinned column. The compiler maps this to AG Grid `initialPinned` so a
   * user's later pin/unpin state is not reset when column definitions are updated.
   */
  defaultPinned?: FieldPinnedPosition;

  /** Optional initial sizing and persistent width/resizing constraints for this field. */
  sizing?: FieldSizingDefinition;
}

/**
 * Reusable configuration for one field/column exposed by an entity.
 *
 * The generic parameters allow frontend-owned definitions to narrow stable field IDs, API row
 * paths, translation keys, data types, and any additional registered filter operators without
 * weakening the shared JSON-compatible contract to arbitrary untyped values.
 */
export interface FieldDefinition<
  TFieldId extends string = string,
  TFieldPath extends string = string,
  TTranslationKey extends string = string,
  TDataType extends FieldDataType = FieldDataType,
  TAdditionalFilterOperator extends string = never,
> {
  /**
   * Stable configuration identity for the field.
   *
   * This identity is independent of the API row path so configuration references can remain stable
   * when the backend response shape changes.
   *
   * @example
   * "loanAmount"
   */
  id: TFieldId;

  /**
   * Path in the API row that contains the field's value.
   *
   * Dot notation is supported for nested response shapes. A concrete frontend definition can
   * narrow this generic to the valid field-path strings for its row type.
   *
   * @example
   * "amount"
   *
   * @example
   * "financials.amount"
   */
  field: TFieldPath;

  /**
   * Full translation key used to resolve the field/column label displayed by the UI.
   *
   * A concrete feature can narrow this generic to its valid translation-key type.
   *
   * @example
   * "review.fields.loanAmount.label"
   */
  labelKey: TTranslationKey;

  /**
   * Semantic type of the field value.
   *
   * The type determines the shared filter-operator vocabulary available to this field before any
   * explicitly registered feature-specific operators are added.
   */
  dataType: TDataType;

  /**
   * Whether users can sort by this field.
   *
   * When omitted, the configurable compiler should use the shared sortable default (`true`).
   */
  sortable?: boolean;

  /**
   * Filtering configuration for the field.
   *
   * Omit this property when the field is not filterable. When present, `operators` defines the
   * exact operator choices allowed for the field. Additional operator keys must resolve through
   * the feature's bounded filter/query mapping rather than being treated as arbitrary executable
   * behavior from configuration.
   */
  filter?: FieldFilterDefinition<
    FilterOperatorForDataType<TDataType> | TAdditionalFilterOperator
  >;

  /**
   * Optional initial layout and sizing configuration for the field.
   *
   * Layout values are defaults, not authorization rules. Persisted user Grid State may later
   * override them, while hard current constraints such as access/masking will be resolved
   * separately when that contract is designed.
   */
  layout?: FieldLayoutDefinition;
}

type ConfigurableFieldDefinition<TTranslationKey extends string = string> = FieldDefinition<
  string,
  string,
  TTranslationKey,
  FieldDataType,
  string
>;

/**
 * Reusable configuration for one entity/data context inside a configurable feature.
 */
export interface EntityDefinition<
  TTranslationKey extends string = string,
  TFieldDefinition extends ConfigurableFieldDefinition<TTranslationKey> = ConfigurableFieldDefinition<TTranslationKey>,
> {
  /**
   * Full translation key used to resolve the entity label displayed by the UI.
   *
   * A concrete feature can narrow this generic to its valid translation-key type.
   *
   * @example
   * "review.entities.loan.label"
   */
  labelKey: TTranslationKey;

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

  /**
   * Fields available for this entity in their configured default column order.
   *
   * Each field has its own stable `id`, so array position controls default presentation order while
   * identity remains independent of position.
   */
  fields: readonly TFieldDefinition[];
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
