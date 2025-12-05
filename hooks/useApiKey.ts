/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useState } from 'react';

/**
 * Hook for managing API key state.
 * In standalone mode, the API key is handled server-side,
 * so this hook mainly manages error dialog state.
 */
export const useApiKey = () => {
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  // In server-side mode, validation always passes
  // Errors are handled when API calls fail
  const validateApiKey = useCallback(async (): Promise<boolean> => {
    return true;
  }, []);

  const handleApiKeyDialogContinue = useCallback(() => {
    setShowApiKeyDialog(false);
  }, []);

  return {
    showApiKeyDialog,
    setShowApiKeyDialog,
    validateApiKey,
    handleApiKeyDialogContinue,
  };
};