// GRIDCAP-ROWMODEL-SSRM | GRIDCAP-COLUMNS | GRIDCAP-ACTION-SELECTED
import { useMutation } from '@tanstack/react-query';
import { Alert, Chip, Divider, Stack, Typography } from '@mui/material';
import { ConfigurableSsrmEntityGrid } from '@/shared/grid/configurable/ConfigurableSsrmEntityGrid';
import {
  DEFAULT_REVIEW_ACCESS_PROFILE,
  REVIEW_ACCESS_PROFILE_STORAGE_KEY,
  REVIEW_ACTIVE_ENTITY_STORAGE_KEY,
  isReviewAccessProfileKey,
  reviewAccessProfiles,
  type ReviewAccessProfileKey,
} from './configurable/reviewAccess.profiles';
import { resolveReviewFeatureAccess } from './configurable/reviewAccess.resolver';
import type { ResolvedReviewEntityDefinition } from './configurable/reviewDefinition.types';
import {
  isReviewEntityKey,
  reviewFeatureDefinition,
  type ReviewEntityKey,
} from './configurable/reviewFeature.definition';
import { resolveReviewLabel } from './configurable/reviewLabels';
import { requireReviewEntityRuntime } from './configurable/reviewRuntime.registry';
import type {
  ReviewEntityRuntime,
  ReviewPrimaryActionContext,
  ReviewRuntimeRow,
} from './configurable/reviewRuntime.types';

function readAccessProfile(): ReviewAccessProfileKey {
  const configured = window.localStorage.getItem(REVIEW_ACCESS_PROFILE_STORAGE_KEY);
  return isReviewAccessProfileKey(configured) ? configured : DEFAULT_REVIEW_ACCESS_PROFILE;
}

function chooseActiveEntity(availableEntities: readonly string[]): ReviewEntityKey | undefined {
  const configured = window.localStorage.getItem(REVIEW_ACTIVE_ENTITY_STORAGE_KEY);
  if (isReviewEntityKey(configured) && availableEntities.includes(configured)) return configured;

  const first = availableEntities[0];
  return first !== undefined && isReviewEntityKey(first) ? first : undefined;
}

interface ReviewResolvedEntityProps {
  entity: ResolvedReviewEntityDefinition;
  runtime: ReviewEntityRuntime;
}

/**
 * One active Review entity instance.
 *
 * The parent keys this component by entity identity. Changing Loan / Finance / Transaction therefore
 * unmounts mutation + GridApi + datasource + selection + draft state and creates a fresh SSRM instance.
 */
function ReviewResolvedEntity({ entity, runtime }: ReviewResolvedEntityProps) {
  const runtimePrimaryAction = runtime.primaryAction;
  const configuredPrimaryAction = runtimePrimaryAction
    ? entity.actions?.find(
        (action) => action.key === runtimePrimaryAction.key && action.placement === 'primary',
      )
    : undefined;

  // The resolved entity has already applied current-user action access. Runtime executable behavior is
  // therefore exposed only when its action key survived that default-deny access projection.
  const primaryAction = configuredPrimaryAction ? runtimePrimaryAction : undefined;
  const mutation = useMutation({
    mutationFn: async (context: ReviewPrimaryActionContext) => {
      if (!primaryAction) throw new Error('This Review entity has no permitted primary action.');
      return primaryAction.execute(context);
    },
  });

  return (
    <ConfigurableSsrmEntityGrid<ReviewRuntimeRow>
      entity={entity}
      rowsLoader={runtime.rowsLoader}
      registries={runtime.registries}
      resolveLabel={resolveReviewLabel}
      runtimePolicy={runtime.runtimePolicy}
      primaryAction={
        primaryAction && configuredPrimaryAction
          ? {
              label: resolveReviewLabel(configuredPrimaryAction.labelKey),
              isPending: mutation.isPending,
              error:
                mutation.error instanceof Error
                  ? mutation.error.message
                  : mutation.error
                    ? 'The Review action failed.'
                    : undefined,
              successMessage: mutation.data
                ? mutation.data.message ??
                  `${mutation.data.affectedCount} ${mutation.data.affectedCount === 1 ? 'row' : 'rows'} submitted.`
                : undefined,
              onExecute: (context) => mutation.mutateAsync(context),
            }
          : undefined
      }
    />
  );
}

/**
 * FE-only Review feature proving base definition + simulated current-user access + dynamic entity
 * runtime selection before backend metadata/authentication exists.
 *
 * Development switching intentionally uses localStorage + reload so QA/developers can exercise several
 * user projections without provisioning real users. Profile identity is interpreted only at this
 * provider boundary; shared grid code never branches on role/profile names.
 */
export function ReviewConfigurableSsrmFeature() {
  const accessProfileKey = readAccessProfile();
  const resolvedFeature = resolveReviewFeatureAccess(
    reviewFeatureDefinition,
    reviewAccessProfiles[accessProfileKey],
  );

  if (!resolvedFeature) {
    return (
      <Alert severity="warning">
        The selected development access profile does not expose the Review feature.
      </Alert>
    );
  }

  const availableEntities = Object.keys(resolvedFeature.entities);
  const activeEntityKey = chooseActiveEntity(availableEntities);

  if (!activeEntityKey) {
    return (
      <Alert severity="warning">
        The selected development access profile exposes Review but no usable entity.
      </Alert>
    );
  }

  const entity = resolvedFeature.entities[activeEntityKey];
  if (!entity) {
    return <Alert severity="error">Resolved Review entity is missing.</Alert>;
  }

  let runtime: ReviewEntityRuntime;
  try {
    runtime = requireReviewEntityRuntime(entity.dataAdapterKey);
  } catch (error) {
    return (
      <Alert severity="error">
        {error instanceof Error ? error.message : 'Review runtime adapter could not be resolved.'}
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Alert severity="info">
        FE-only access simulation. Change <strong>{REVIEW_ACCESS_PROFILE_STORAGE_KEY}</strong> and/or{' '}
        <strong>{REVIEW_ACTIVE_ENTITY_STORAGE_KEY}</strong> in localStorage, then reload. These values
        simulate resolved current-user access; they are not a security boundary.
      </Alert>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Typography variant="body2" fontWeight={700}>
          Development profile:
        </Typography>
        <Chip label={accessProfileKey} size="small" data-testid="review-access-profile" />
        <Typography variant="body2" fontWeight={700}>
          Active entity:
        </Typography>
        <Chip label={activeEntityKey} size="small" data-testid="review-active-entity" />
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Available entities for this profile: {availableEntities.join(', ')}. Profile identity controls
        authorization; active entity is a separate navigation choice.
      </Typography>

      <Divider />

      <Typography component="h2" variant="h5" fontWeight={700}>
        {resolveReviewLabel(entity.labelKey)}
      </Typography>

      <ReviewResolvedEntity
        // Entity changes must destroy the previous GridApi, datasource, selection, mutation and local
        // draft state. A keyed remount is clearer/safer than hot-swapping a live SSRM instance.
        key={activeEntityKey}
        entity={entity}
        runtime={runtime}
      />
    </Stack>
  );
}
