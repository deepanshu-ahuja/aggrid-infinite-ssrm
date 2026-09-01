import type { EntityDefinition } from '@/shared/grid/configurable/configuration.types';
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

/**
 * Review's entity extension over the shared configurable grid metadata.
 *
 * The shared EntityDefinition continues to own all AG Grid field/grid metadata. Review adds only
 * business-action identities; endpoint functions, payload mapping and mutation behavior stay outside
 * declarative configuration in the entity runtime registry.
 */
export interface ReviewEntityDefinition extends EntityDefinition {
  actions?: readonly ReviewActionDefinition[];
}

/**
 * Review access extends the shared default-deny field projection with business-action entitlements.
 * It is an authorization allowlist, not a partial copy/override of EntityDefinition.
 */
export interface ReviewEntityAccessProjection extends ConfigurableEntityAccessProjection {
  /** Omitted action means unavailable. `true` means this resolved user/session may invoke it. */
  actions?: Readonly<Record<string, true>>;
}

export interface ReviewFeatureAccessProjection extends ConfigurableFeatureAccessProjection {
  entities: Readonly<Record<string, ReviewEntityAccessProjection>>;
}

export interface ReviewApplicationAccessProjection extends ConfigurableApplicationAccessProjection {
  features: Readonly<Record<string, ReviewFeatureAccessProjection>>;
}

/** Shared resolved entity metadata plus the action identities that survived access resolution. */
export interface ResolvedReviewEntityDefinition extends EntityDefinition {
  actions?: readonly ReviewActionDefinition[];
}
