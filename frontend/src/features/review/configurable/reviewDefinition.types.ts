import type {
  EntityDefinition,
  FieldDefinition,
} from '@/shared/grid/configurable/configuration.types';
import type {
  ConfigurableApplicationAccessProjection,
  ConfigurableEntityAccessProjection,
  ConfigurableFeatureAccessProjection,
} from '@/shared/grid/configurable/configuration.access';

/** JSON-safe business-action declaration. Executable behavior remains in the Review runtime registry. */
export interface ReviewActionDefinition {
  key: string;
  labelKey: string;
  placement: 'primary' | 'secondary';
}

/** Base sensitivity capability. Current-user unmask permission is deliberately not stored here. */
export interface ReviewFieldSensitivityDefinition {
  maskable: true;
}

export type ReviewFieldDefinition = FieldDefinition & {
  sensitivity?: ReviewFieldSensitivityDefinition;
};

/** Review's current entity extension over the shared configurable grid metadata. */
export interface ReviewEntityDefinition extends EntityDefinition<string, ReviewFieldDefinition> {
  actions?: readonly ReviewActionDefinition[];
}

export interface ReviewSensitiveFieldAccess {
  canRequestUnmask: boolean;
}

/**
 * Review access extends the shared default-deny field projection with action and sensitive-value
 * entitlements. It remains a resolved-current-user allowlist, not a second grid configuration.
 */
export interface ReviewEntityAccessProjection extends ConfigurableEntityAccessProjection {
  /** Omitted action means unavailable. `true` means this resolved user/session may invoke it. */
  actions?: Readonly<Record<string, true>>;
  /** Omitted sensitive entry means visible masked value cannot request unmask. */
  sensitiveFields?: Readonly<Record<string, ReviewSensitiveFieldAccess>>;
}

export interface ReviewFeatureAccessProjection extends ConfigurableFeatureAccessProjection {
  entities: Readonly<Record<string, ReviewEntityAccessProjection>>;
}

export interface ReviewApplicationAccessProjection extends ConfigurableApplicationAccessProjection {
  features: Readonly<Record<string, ReviewFeatureAccessProjection>>;
}

/**
 * After Review-specific access resolution, sensitivity metadata has been compiled into static renderer
 * params, so the generic grid receives ordinary FieldDefinition values plus allowed action identities.
 */
export interface ResolvedReviewEntityDefinition extends EntityDefinition {
  actions?: readonly ReviewActionDefinition[];
}
