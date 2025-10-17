import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, getAuthHeaders } from './api';

export interface BatchUploadOptions {
  preserveStructure?: boolean;
  targetGalleryId?: string;
  maxFileSize?: number;
  allowedTypes?: ('IMAGE' | 'VIDEO' | 'DOCUMENT')[];
}

export interface BatchUpload {
  id: string;
  filename: string;
  fileSize: number;
  status: 'PENDING' | 'EXTRACTING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED' | 'CANCELLED';
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  errors?: Array<{
    filename: string;
    error: string;
    timestamp: string;
  }>;
  mediaItems?: Array<{
    id: string;
    originalFilename: string;
    processingStatus: string;
  }>;
}

export interface BatchUploadProgress {
  batchId: string;
  status: 'PENDING' | 'EXTRACTING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED' | 'CANCELLED';
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  currentFile?: string;
  errors?: Array<{
    filename: string;
    error: string;
    timestamp: string;
  }>;
}

// Upload zip file
export function useZipUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, options }: { file: File; options?: BatchUploadOptions }) => {
      const formData = new FormData();
      formData.append('zipFile', file);
      
      if (options) {
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined) {
            formData.append(key, String(value));
          }
        });
      }

      const response = await fetch(`${API_BASE_URL}/batch-upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload zip file');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate batch uploads list
      queryClient.invalidateQueries({ queryKey: ['batch-uploads'] });
    },
  });
}

// Get batch status
export function useBatchStatus(batchId: string) {
  return useQuery({
    queryKey: ['batch-upload', batchId],
    queryFn: async (): Promise<BatchUploadProgress> => {
      const response = await fetch(`${API_BASE_URL}/batch-upload/${batchId}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch batch status');
      }
      
      const data = await response.json();
      return data.data;
    },
    enabled: !!batchId,
    refetchInterval: (query) => {
      // Stop polling if batch is completed, failed, or cancelled
      if (query.state.data?.status === 'COMPLETED' || query.state.data?.status === 'FAILED' || query.state.data?.status === 'CANCELLED') {
        return false;
      }
      // Poll every 2 seconds for active batches
      return 2000;
    },
  });
}

// Get user's batch uploads
export function useBatchList(limit = 20, offset = 0) {
  return useQuery({
    queryKey: ['batch-uploads', { limit, offset }],
    queryFn: async (): Promise<BatchUpload[]> => {
      const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
      const response = await fetch(`${API_BASE_URL}/batch-upload?${params}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch batch uploads');
      }
      
      const data = await response.json();
      return data.data;
    },
  });
}

// Cancel batch upload
export function useCancelBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const response = await fetch(`${API_BASE_URL}/batch-upload/${batchId}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel batch upload');
      }
      
      return response.json();
    },
    onSuccess: (_, batchId) => {
      // Invalidate batch status and list
      queryClient.invalidateQueries({ queryKey: ['batch-upload', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-uploads'] });
    },
  });
}

// Delete batch upload
export function useDeleteBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const response = await fetch(`${API_BASE_URL}/batch-upload/${batchId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete batch upload');
      }
      
      return response.json();
    },
    onSuccess: (_, batchId) => {
      // Invalidate batch status and list
      queryClient.invalidateQueries({ queryKey: ['batch-upload', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-uploads'] });
    },
  });
}

// Retry failed files
export function useRetryBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const response = await fetch(`${API_BASE_URL}/batch-upload/${batchId}/retry`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to retry batch upload');
      }
      
      return response.json();
    },
    onSuccess: (_, batchId) => {
      // Invalidate batch status and list
      queryClient.invalidateQueries({ queryKey: ['batch-upload', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-uploads'] });
    },
  });
}
