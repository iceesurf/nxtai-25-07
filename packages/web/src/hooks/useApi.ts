import { useState, useEffect, useCallback } from 'react';
import { AxiosResponse, AxiosError } from 'axios';
import { handleApiError } from '../services/api';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

// Generic hook for API calls
export function useApi<T = any>(
  apiCall: () => Promise<AxiosResponse<T>>,
  options: UseApiOptions = {}
) {
  const { immediate = true, onSuccess, onError } = options;
  
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiCall();
      const data = response.data;
      
      setState({
        data,
        loading: false,
        error: null,
      });

      if (onSuccess) {
        onSuccess(data);
      }

      return data;
    } catch (error) {
      const errorMessage = handleApiError(error);
      
      setState({
        data: null,
        loading: false,
        error: errorMessage,
      });

      if (onError) {
        onError(errorMessage);
      }

      throw error;
    }
  }, [apiCall, onSuccess, onError]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Hook for mutations (POST, PUT, DELETE)
export function useMutation<T = any, P = any>(
  apiCall: (params: P) => Promise<AxiosResponse<T>>,
  options: UseApiOptions = {}
) {
  const { onSuccess, onError } = options;
  
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const mutate = useCallback(async (params: P) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiCall(params);
      const data = response.data;
      
      setState({
        data,
        loading: false,
        error: null,
      });

      if (onSuccess) {
        onSuccess(data);
      }

      return data;
    } catch (error) {
      const errorMessage = handleApiError(error);
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));

      if (onError) {
        onError(errorMessage);
      }

      throw error;
    }
  }, [apiCall, onSuccess, onError]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}

// Hook for paginated data
interface UsePaginatedApiOptions extends UseApiOptions {
  pageSize?: number;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function usePaginatedApi<T = any>(
  apiCall: (page: number, pageSize: number, filters?: any) => Promise<AxiosResponse<PaginatedResponse<T>>>,
  options: UsePaginatedApiOptions = {}
) {
  const { immediate = true, pageSize = 20, onSuccess, onError } = options;
  
  const [state, setState] = useState<UseApiState<PaginatedResponse<T>>>({
    data: null,
    loading: false,
    error: null,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<any>({});

  const execute = useCallback(async (page: number = currentPage, newFilters: any = filters) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiCall(page, pageSize, newFilters);
      const data = response.data;
      
      setState({
        data,
        loading: false,
        error: null,
      });

      if (onSuccess) {
        onSuccess(data);
      }

      return data;
    } catch (error) {
      const errorMessage = handleApiError(error);
      
      setState({
        data: null,
        loading: false,
        error: errorMessage,
      });

      if (onError) {
        onError(errorMessage);
      }

      throw error;
    }
  }, [apiCall, currentPage, filters, pageSize, onSuccess, onError]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    execute(page, filters);
  }, [execute, filters]);

  const nextPage = useCallback(() => {
    if (state.data?.hasNext) {
      goToPage(currentPage + 1);
    }
  }, [state.data?.hasNext, goToPage, currentPage]);

  const prevPage = useCallback(() => {
    if (state.data?.hasPrev) {
      goToPage(currentPage - 1);
    }
  }, [state.data?.hasPrev, goToPage, currentPage]);

  const updateFilters = useCallback((newFilters: any) => {
    setFilters(newFilters);
    setCurrentPage(1);
    execute(1, newFilters);
  }, [execute]);

  const refresh = useCallback(() => {
    execute(currentPage, filters);
  }, [execute, currentPage, filters]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
    setCurrentPage(1);
    setFilters({});
  }, []);

  return {
    ...state,
    currentPage,
    filters,
    execute,
    goToPage,
    nextPage,
    prevPage,
    updateFilters,
    refresh,
    reset,
  };
}

// Hook for real-time data with polling
interface UsePollingApiOptions extends UseApiOptions {
  interval?: number;
  enabled?: boolean;
}

export function usePollingApi<T = any>(
  apiCall: () => Promise<AxiosResponse<T>>,
  options: UsePollingApiOptions = {}
) {
  const { immediate = true, interval = 30000, enabled = true, onSuccess, onError } = options;
  
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiCall();
      const data = response.data;
      
      setState({
        data,
        loading: false,
        error: null,
      });

      if (onSuccess) {
        onSuccess(data);
      }

      return data;
    } catch (error) {
      const errorMessage = handleApiError(error);
      
      setState({
        data: null,
        loading: false,
        error: errorMessage,
      });

      if (onError) {
        onError(errorMessage);
      }

      throw error;
    }
  }, [apiCall, onSuccess, onError]);

  useEffect(() => {
    if (!enabled) return;

    if (immediate) {
      execute();
    }

    const intervalId = setInterval(() => {
      execute();
    }, interval);

    return () => clearInterval(intervalId);
  }, [execute, immediate, interval, enabled]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Hook for optimistic updates
export function useOptimisticMutation<T = any, P = any>(
  apiCall: (params: P) => Promise<AxiosResponse<T>>,
  optimisticUpdate: (params: P) => T,
  options: UseApiOptions = {}
) {
  const { onSuccess, onError } = options;
  
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const mutate = useCallback(async (params: P) => {
    // Apply optimistic update immediately
    const optimisticData = optimisticUpdate(params);
    setState(prev => ({
      ...prev,
      data: optimisticData,
      loading: true,
      error: null,
    }));

    try {
      const response = await apiCall(params);
      const data = response.data;
      
      setState({
        data,
        loading: false,
        error: null,
      });

      if (onSuccess) {
        onSuccess(data);
      }

      return data;
    } catch (error) {
      const errorMessage = handleApiError(error);
      
      // Revert optimistic update on error
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));

      if (onError) {
        onError(errorMessage);
      }

      throw error;
    }
  }, [apiCall, optimisticUpdate, onSuccess, onError]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}

export default useApi;

