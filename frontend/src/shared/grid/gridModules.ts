import { AllCommunityModule, enableDevValidations, type Module } from 'ag-grid-community';
import { ServerSideRowModelModule } from 'ag-grid-enterprise';

if (import.meta.env.DEV) {
  enableDevValidations();
}

// Module registration is centralized so an AG Grid upgrade or future Enterprise decision has
// one application-level integration point instead of being repeated across feature screens.
export const gridModules: Module[] = [AllCommunityModule, ServerSideRowModelModule];
