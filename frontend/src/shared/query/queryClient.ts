import { QueryClient } from '@tanstack/react-query';

/**
 * One QueryClient for normal application server-state lifecycle.
 *
 * AG Grid Infinite/SSRM row loading does not use this cache; their datasources remain the owners of
 * block loading/caching. Feature mutations use this client for pending/error/success lifecycle.
 */
export const queryClient = new QueryClient();
