import type { EntityDefinition, FeatureDefinition } from './configuration.types';

/** Current frontend-only field access vocabulary used by resolved configurable-feature projections. */
export type ConfigurableFieldAccess = 'read' | 'edit';

/**
 * Current-user access for one entity.
 *
 * Keys are stable `FieldDefinition.colId` values, not response field paths or labels. Omitting a field
 * means it is unavailable to the current user and it is removed from the resolved entity entirely.
 */
export interface ConfigurableEntityAccessProjection {
  fields: Readonly<Record<string, ConfigurableFieldAccess>>;
}

/** Current-user access for one feature. Omitting an entity means the user cannot access that entity. */
export interface ConfigurableFeatureAccessProjection {
  entities: Readonly<Record<string, ConfigurableEntityAccessProjection>>;
}

/**
 * Application/session access manifest consumed by the frontend configuration provider.
 *
 * The current implementation is supplied by local development profiles. A future backend may return
 * the resolved manifest, but generic grid code must not derive authorization from role names.
 */
export interface ConfigurableApplicationAccessProjection {
  features: Readonly<Record<string, ConfigurableFeatureAccessProjection>>;
}

/**
 * Feature shape after current-user access has been intersected with the base feature definition.
 *
 * Unlike `FeatureDefinition`, the entity record is intentionally not keyed by a compile-time complete
 * entity union: authorization can remove any subset of entities for one current user/session.
 */
export interface ResolvedFeatureDefinition<
  TFeatureKey extends string = string,
  TEntityDefinition extends EntityDefinition = EntityDefinition,
> {
  featureKey: TFeatureKey;
  entities: Readonly<Record<string, TEntityDefinition>>;
}

function resolveEntityAccess<TEntityDefinition extends EntityDefinition>(
  entityKey: string,
  entity: TEntityDefinition,
  access: ConfigurableEntityAccessProjection,
): TEntityDefinition {
  const fieldsById = new Map(entity.fields.map((field) => [String(field.colId), field]));

  for (const fieldId of Object.keys(access.fields)) {
    if (!fieldsById.has(fieldId)) {
      throw new Error(
        `Configurable access for entity "${entityKey}" references unknown field colId "${fieldId}".`,
      );
    }
  }

  const fields = entity.fields.flatMap((field) => {
    const accessMode = access.fields[String(field.colId)];
    if (!accessMode) return [];

    // Access can only narrow what the base definition supports. `edit` therefore preserves the base
    // editable flag instead of promoting a base read-only field into an editable field.
    return [
      {
        ...field,
        ...(accessMode === 'read' ? { editable: false } : {}),
      },
    ];
  });

  if (fields.length === 0) {
    throw new Error(
      `Configurable access for entity "${entityKey}" exposes the entity without any fields. ` +
        'Omit the entity from the access projection when it should be unavailable.',
    );
  }

  return {
    ...entity,
    fields,
  } as TEntityDefinition;
}

/**
 * Resolve one base feature against the current application/session access manifest.
 *
 * The base feature answers "what can this feature support?". The returned feature answers "what may
 * this current user/session actually receive?". Missing features/entities/fields are removed rather
 * than merely hidden, while `read` access explicitly downgrades a base editable field to read-only.
 */
export function resolveFeatureAccess<
  TFeatureKey extends string,
  TEntityKey extends string,
  TEntityDefinition extends EntityDefinition,
>(
  feature: FeatureDefinition<TFeatureKey, TEntityKey, TEntityDefinition>,
  applicationAccess: ConfigurableApplicationAccessProjection,
): ResolvedFeatureDefinition<TFeatureKey, TEntityDefinition> | undefined {
  const featureAccess = applicationAccess.features[feature.featureKey];
  if (!featureAccess) return undefined;

  const resolvedEntities: Record<string, TEntityDefinition> = {};

  for (const [entityKey, entityAccess] of Object.entries(featureAccess.entities)) {
    const entity = feature.entities[entityKey as TEntityKey];
    if (!entity) {
      throw new Error(
        `Configurable access for feature "${feature.featureKey}" references unknown entity "${entityKey}".`,
      );
    }
    resolvedEntities[entityKey] = resolveEntityAccess(entityKey, entity, entityAccess);
  }

  return {
    featureKey: feature.featureKey,
    entities: resolvedEntities,
  };
}
