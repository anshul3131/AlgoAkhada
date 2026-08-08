import { useCallback, useState } from 'react';
import { submissionApi, userApi } from '../lib/api';

export function useUserFlow() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUser = useCallback(async (username: string) => {
    setIsCreatingUser(true);
    setError(null);

    try {
      const createdUser = await userApi.createUser(username);
      setUserId(createdUser.id);
      return createdUser;
    } catch (caughtError) {
      setError((caughtError as Error).message);
      throw caughtError;
    } finally {
      setIsCreatingUser(false);
    }
  }, []);

  const submitCode = useCallback(async (token: string, payload: { userId: string; problemId: string; language: string; code: string }) => {
    setIsSubmitting(true);
    setError(null);

    try {
      return await submissionApi.submitCode(token, payload);
    } catch (caughtError) {
      setError((caughtError as Error).message);
      throw caughtError;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    userId,
    isCreatingUser,
    isSubmitting,
    error,
    createUser,
    submitCode,
  };
}
