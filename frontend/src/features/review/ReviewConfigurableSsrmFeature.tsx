// GRIDCAP-ROWMODEL-SSRM | GRIDCAP-COLUMNS
import { Alert, Chip, Divider, Stack, Typography } from '@mui/material';
import { ConfigurableSsrmEntityGrid } from '@/shared/grid/configurable/ConfigurableSsrmEntityGrid';
import { resolveFeatureAccess } from '@/shared/grid/configurable/configuration.access';
import {
  DEFAULT_REVIEW_ACCESS_PROFILE,
  REVIEW_ACCESS_PROFILE_STORAGE_KEY,
  REVIEW_ACTIVE_ENTITY_STORAGE_KEY,
  isReviewAccessProfileKey,
  isReviewEntityKey,
  resolveReviewLabel,
  reviewAccessProfiles,
  reviewEntityRuntimes,
  reviewFeatureDefinition,
  type FinanceReviewRow,
  type LoanReviewRow,
  type ReviewAccessProfileKey,
  type ReviewEntityKey,
} from './configurable/reviewConfigurableFeature';

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

/**
 * FE-only Review feature proving base definition + simulated current-user access + dynamic entity
 * selection before any backend metadata/authentication platform exists.
 *
 * Development switching intentionally uses localStorage + reload so QA/developers can exercise several
 * user projections without provisioning real users. The profile names are interpreted only here by the
 * development provider boundary; the shared access resolver and grid never branch on a role/profile.
 */
export function ReviewConfigurableSsrmFeature() {
  const accessProfileKey = readAccessProfile();
  const resolvedFeature = resolveFeatureAccess(
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

  return (
    <Stack spacing={2.5}>
      <Alert severity="info">
        FE-only access simulation. Change <strong>{REVIEW_ACCESS_PROFILE_STORAGE_KEY}</strong> and/or{' '}
        <strong>{REVIEW_ACTIVE_ENTITY_STORAGE_KEY}</strong> in localStorage, then reload. These values
        simulate resolved current-user access; they are not a security boundary.
      </Alert>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Typography variant="body2" fontWeight={700}>Development profile:</Typography>
        <Chip label={accessProfileKey} size="small" data-testid="review-access-profile" />
        <Typography variant="body2" fontWeight={700}>Active entity:</Typography>
        <Chip label={activeEntityKey} size="small" data-testid="review-active-entity" />
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Available entities for this profile: {availableEntities.join(', ')}. The active entity is a
        separate choice so a user who has both Loan and Finance access can open either one.
      </Typography>

      <Divider />

      <Typography component="h2" variant="h5" fontWeight={700}>
        {resolveReviewLabel(entity.labelKey)}
      </Typography>

      {activeEntityKey === 'loan' ? (
        <ConfigurableSsrmEntityGrid<LoanReviewRow>
          entity={entity}
          rowsLoader={reviewEntityRuntimes.loan.rowsLoader}
          registries={reviewEntityRuntimes.loan.registries}
          resolveLabel={resolveReviewLabel}
        />
      ) : (
        <ConfigurableSsrmEntityGrid<FinanceReviewRow>
          entity={entity}
          rowsLoader={reviewEntityRuntimes.finance.rowsLoader}
          registries={reviewEntityRuntimes.finance.registries}
          resolveLabel={resolveReviewLabel}
        />
      )}
    </Stack>
  );
}
