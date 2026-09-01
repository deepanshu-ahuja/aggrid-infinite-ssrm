import { resolveFeatureAccess } from '@/shared/grid/configurable/configuration.access';
import type { FeatureDefinition } from '@/shared/grid/configurable/configuration.types';
import type {
  ResolvedReviewEntityDefinition,
  ReviewApplicationAccessProjection,
  ReviewEntityDefinition,
} from './reviewDefinition.types';

function resolveReviewEntityActions(
  entityKey: string,
  baseEntity: ReviewEntityDefinition,
  resolvedEntity: ReviewEntityDefinition,
  access: ReviewApplicationAccessProjection['features'][string]['entities'][string],
): ResolvedReviewEntityDefinition {
  const baseActions = new Map((baseEntity.actions ?? []).map((action) => [action.key, action]));

  for (const actionKey of Object.keys(access.actions ?? {})) {
    if (!baseActions.has(actionKey)) {
      throw new Error(
        `Review access for entity "${entityKey}" references unknown action "${actionKey}".`,
      );
    }
  }

  return {
    ...resolvedEntity,
    actions: (baseEntity.actions ?? []).filter((action) => access.actions?.[action.key] === true),
  };
}

/**
 * Resolve shared feature/entity/field access first, then Review-specific business-action access.
 *
 * Keeping this as a feature/provider-layer composition prevents generic AG Grid code from knowing
 * profile names or business action identities. A future backend can provide the same resolved access
 * projection without changing the configurable grid runtime.
 */
export function resolveReviewFeatureAccess<
  TFeatureKey extends string,
  TEntityKey extends string,
>(
  feature: FeatureDefinition<TFeatureKey, TEntityKey, ReviewEntityDefinition>,
  access: ReviewApplicationAccessProjection,
) {
  const sharedResolved = resolveFeatureAccess(feature, access);
  if (!sharedResolved) return undefined;

  const featureAccess = access.features[feature.featureKey];
  if (!featureAccess) return undefined;

  const entities: Record<string, ResolvedReviewEntityDefinition> = {};
  for (const [entityKey, resolvedEntity] of Object.entries(sharedResolved.entities)) {
    const baseEntity = feature.entities[entityKey as TEntityKey];
    const entityAccess = featureAccess.entities[entityKey];
    if (!baseEntity || !entityAccess) continue;

    entities[entityKey] = resolveReviewEntityActions(
      entityKey,
      baseEntity,
      resolvedEntity,
      entityAccess,
    );
  }

  return {
    featureKey: sharedResolved.featureKey,
    entities,
  };
}
