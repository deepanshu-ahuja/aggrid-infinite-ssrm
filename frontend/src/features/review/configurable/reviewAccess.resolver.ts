import { resolveFeatureAccess } from '@/shared/grid/configurable/configuration.access';
import type { FeatureDefinition } from '@/shared/grid/configurable/configuration.types';
import type {
  ResolvedReviewEntityDefinition,
  ReviewApplicationAccessProjection,
  ReviewEntityDefinition,
} from './reviewDefinition.types';

function resolveReviewEntityCapabilities(
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

  const actions = (baseEntity.actions ?? []).filter((action) => access.actions?.[action.key] === true);
  const baseFields = new Map(baseEntity.fields.map((field) => [String(field.colId), field]));

  for (const fieldId of Object.keys(access.sensitiveFields ?? {})) {
    const baseField = baseFields.get(fieldId);
    if (!baseField) {
      throw new Error(
        `Review sensitive access for entity "${entityKey}" references unknown field "${fieldId}".`,
      );
    }
    if (!baseField.sensitivity?.maskable) {
      throw new Error(
        `Review sensitive access for entity "${entityKey}" references non-maskable field "${fieldId}".`,
      );
    }
  }

  const fields = resolvedEntity.fields.map((resolvedField) => {
    const baseField = baseFields.get(String(resolvedField.colId));
    if (!baseField?.sensitivity?.maskable) return resolvedField;

    const sensitiveAccess = access.sensitiveFields?.[String(resolvedField.colId)];

    // Sensitivity is provider/access metadata, not an AG Grid ColDef property. Compile the resolved
    // entitlement into JSON-safe renderer params and deliberately do not pass `sensitivity` itself to
    // the generic column compiler, which would otherwise treat unknown properties as native options.
    const { sensitivity: _sensitivity, ...fieldWithoutSensitivity } = baseField;
    return {
      ...fieldWithoutSensitivity,
      // Preserve any editability/access narrowing already performed by the shared resolver.
      editable: resolvedField.editable,
      cellRendererParams: {
        ...(resolvedField.cellRendererParams ?? {}),
        canRequestUnmask: sensitiveAccess?.canRequestUnmask === true,
      },
    };
  });

  return {
    ...resolvedEntity,
    fields,
    actions,
  };
}

/**
 * Resolve shared feature/entity/field access first, then Review-specific action/sensitive entitlements.
 *
 * Keeping this as a provider-layer composition prevents generic AG Grid code from knowing role names,
 * masking authorization or business action identities. A future backend can provide the same resolved
 * access shape without changing the grid runtime.
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

    entities[entityKey] = resolveReviewEntityCapabilities(
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
