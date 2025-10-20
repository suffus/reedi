'use client';

import React, { useState } from 'react';
import { useBatchList, useCancelBatch, useDeleteBatch } from '@/lib/batch-upload-hooks';
import { 
  FileArchive, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Loader2,
  Trash2,
  X,
  Eye
} from 'lucide-react';

interface BatchUploadListProps {
  onViewBatch?: (batchId: string) => void;
}

export function BatchUploadList({ onViewBatch }: BatchUploadListProps) {
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const { data: batches, isLoading, error } = useBatchList();
  const cancelMutation = useCancelBatch();
  const deleteMutation = useDeleteBatch();

  const handleCancel = async (batchId: string) => {
    try {
      await cancelMutation.mutateAsync(batchId);
    } catch (error) {
      console.error('Failed to cancel batch:', error);
    }
  };

  const handleDelete = async (batchId: string) => {
    try {
      await deleteMutation.mutateAsync(batchId);
    } catch (error) {
      console.error('Failed to delete batch:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'CANCELLED':
        return <X className="h-4 w-4 text-gray-500" />;
      case 'PARTIAL_SUCCESS':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'PENDING':
      case 'EXTRACTING':
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Waiting';
      case 'EXTRACTING':
        return 'Extracting';
      case 'PROCESSING':
        return 'Processing';
      case 'COMPLETED':
        return 'Completed';
      case 'PARTIAL_SUCCESS':
        return 'Partial Success';
      case 'FAILED':
        return 'Failed';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 bg-green-50';
      case 'FAILED':
      case 'CANCELLED':
        return 'text-red-600 bg-red-50';
      case 'PARTIAL_SUCCESS':
        return 'text-yellow-600 bg-yellow-50';
      case 'PENDING':
      case 'EXTRACTING':
      case 'PROCESSING':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isActive = (status: string) => {
    return ['PENDING', 'EXTRACTING', 'PROCESSING'].includes(status);
  };

  const isCompleted = (status: string) => {
    return ['COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL_SUCCESS'].includes(status);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading batch uploads...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg p-6">
        <div className="flex items-center justify-center text-red-600">
          <XCircle className="h-6 w-6 mr-2" />
          <span>Failed to load batch uploads</span>
        </div>
      </div>
    );
  }

  if (!batches || batches.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 text-center">
        <FileArchive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No ZIP uploads yet</h3>
        <p className="text-gray-600">Upload your first ZIP file to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">ZIP Uploads</h2>
        <p className="text-sm text-gray-600">Manage your batch uploads</p>
      </div>

      <div className="divide-y divide-gray-200">
        {batches.map((batch) => (
          <div key={batch.id} className="p-6 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <FileArchive className="h-5 w-5 text-gray-600" />
                  <h3 className="font-medium text-gray-900">{batch.filename}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(batch.status)}`}>
                    {getStatusIcon(batch.status)}
                    <span className="ml-1">{getStatusText(batch.status)}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <div className="text-sm text-gray-600">File Size</div>
                    <div className="font-medium">{formatFileSize(batch.fileSize)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Total Files</div>
                    <div className="font-medium">{batch.totalFiles}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Processed</div>
                    <div className="font-medium text-green-600">{batch.processedFiles}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Failed</div>
                    <div className="font-medium text-red-600">{batch.failedFiles}</div>
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  Created: {formatDate(batch.createdAt)}
                  {batch.completedAt && (
                    <span className="ml-4">
                      Completed: {formatDate(batch.completedAt)}
                    </span>
                  )}
                </div>

                {/* Progress Bar for Active Batches */}
                {isActive(batch.status) && batch.totalFiles > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{Math.round((batch.processedFiles / batch.totalFiles) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.round((batch.processedFiles / batch.totalFiles) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-4">
                {onViewBatch && (
                  <button
                    onClick={() => onViewBatch(batch.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    title="View details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}

                {isActive(batch.status) && (
                  <button
                    onClick={() => handleCancel(batch.id)}
                    disabled={cancelMutation.isPending}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
                    title="Cancel upload"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {isCompleted(batch.status) && (
                  <button
                    onClick={() => handleDelete(batch.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
                    title="Delete batch"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



