'use client';

import React from 'react';
import { useBatchStatus, useCancelBatch, useDeleteBatch } from '@/lib/batch-upload-hooks';
import { 
  FileArchive, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Loader2,
  Trash2,
  X
} from 'lucide-react';

interface BatchUploadProgressProps {
  batchId: string;
  onClose?: () => void;
  onComplete?: (batchId: string) => void;
}

export function BatchUploadProgress({ batchId, onClose, onComplete }: BatchUploadProgressProps) {
  const { data: progress, isLoading, error } = useBatchStatus(batchId);
  const cancelMutation = useCancelBatch();
  const deleteMutation = useDeleteBatch();

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(batchId);
    } catch (error) {
      console.error('Failed to cancel batch:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(batchId);
      onClose?.();
    } catch (error) {
      console.error('Failed to delete batch:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-gray-600">Loading batch status...</span>
        </div>
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center gap-3 text-red-600">
          <XCircle className="h-5 w-5" />
          <span>Failed to load batch status</span>
        </div>
      </div>
    );
  }

  const isCompleted = progress.status === 'COMPLETED';
  const isFailed = progress.status === 'FAILED';
  const isCancelled = progress.status === 'CANCELLED';
  const isActive = ['PENDING', 'EXTRACTING', 'PROCESSING'].includes(progress.status);
  const isPartialSuccess = progress.status === 'PARTIAL_SUCCESS';

  const getStatusIcon = () => {
    if (isCompleted) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (isFailed) return <XCircle className="h-5 w-5 text-red-500" />;
    if (isCancelled) return <X className="h-5 w-5 text-gray-500" />;
    if (isPartialSuccess) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    if (isActive) return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    return <Clock className="h-5 w-5 text-gray-500" />;
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'PENDING':
        return 'Waiting to start...';
      case 'EXTRACTING':
        return 'Extracting ZIP file...';
      case 'PROCESSING':
        return 'Processing files...';
      case 'COMPLETED':
        return 'Completed successfully';
      case 'PARTIAL_SUCCESS':
        return 'Completed with some errors';
      case 'FAILED':
        return 'Processing failed';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    if (isCompleted) return 'text-green-600';
    if (isFailed || isCancelled) return 'text-red-600';
    if (isPartialSuccess) return 'text-yellow-600';
    if (isActive) return 'text-blue-600';
    return 'text-gray-600';
  };

  const progressPercentage = progress.totalFiles > 0 
    ? Math.round((progress.processedFiles / progress.totalFiles) * 100)
    : 0;

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <FileArchive className="h-6 w-6 text-gray-600" />
          <div>
            <h3 className="font-semibold text-gray-900">ZIP Upload Progress</h3>
            <p className="text-sm text-gray-500">Batch ID: {batchId}</p>
          </div>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 mb-4">
        {getStatusIcon()}
        <span className={`font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {/* Progress Bar */}
      {isActive && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* File Counts */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{progress.totalFiles}</div>
          <div className="text-sm text-gray-600">Total Files</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{progress.processedFiles}</div>
          <div className="text-sm text-gray-600">Processed</div>
        </div>
        {progress.failedFiles > 0 && (
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{progress.failedFiles}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
        )}
        {progress.skippedFiles > 0 && (
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{progress.skippedFiles}</div>
            <div className="text-sm text-gray-600">Skipped</div>
          </div>
        )}
      </div>

      {/* Errors */}
      {progress.errors && progress.errors.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-900 mb-2">Errors:</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {progress.errors.map((error, index) => (
              <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                <span className="font-medium">{error.filename}:</span> {error.error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {isActive && (
          <button
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
          >
            {cancelMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            Cancel
          </button>
        )}
        
        {(isCompleted || isFailed || isCancelled || isPartialSuccess) && (
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 text-red-700 bg-red-100 rounded-md hover:bg-red-200 disabled:opacity-50 flex items-center gap-2"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </button>
        )}
      </div>

      {/* Auto-close on completion */}
      {isCompleted && onComplete && (
        <div className="mt-4 text-center">
          <button
            onClick={() => onComplete(batchId)}
            className="text-blue-600 hover:text-blue-800 text-sm underline"
          >
            View uploaded media →
          </button>
        </div>
      )}
    </div>
  );
}


