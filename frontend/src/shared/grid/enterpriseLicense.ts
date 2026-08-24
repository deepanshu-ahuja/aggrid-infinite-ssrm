import { LicenseManager } from 'ag-grid-enterprise';

let configured = false;

export function configureAgGridEnterpriseLicense() {
  if (configured) {
    return;
  }

  const licenseKey = import.meta.env.VITE_AG_GRID_LICENSE_KEY?.trim();
  if (licenseKey) {
    // AG Grid licenses are initialized in the browser by design. Keeping this in one place avoids
    // feature code knowing how Enterprise is licensed and keeps trial/production setup replaceable.
    LicenseManager.setLicenseKey(licenseKey);
  }

  configured = true;
}
