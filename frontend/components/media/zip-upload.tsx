'use client';

import React, { useState, useRef } from 'react';
import { useZipUpload, BatchUploadOptions } from '@/lib/batch-upload-hooks';
import { zipChunkedUploadService, ZipUploadOptions, UploadProgress } from '@/lib/zipChunkedUploadService';
import { Upload, X, FileArchive, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ZipUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: (batchId: string) => void;
}

export function ZipUploadDialog({ isOpen, onClose, onUploadSuccess }: ZipUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<BatchUploadOptions>({
    preserveStructure: false,
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    allowedTypes: ['IMAGE', 'VIDEO']
  });
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useZipUpload();

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.name.endsWith('.zip')) {
      alert('Please select a ZIP file');
      return;
    }

    // Validate file size
    if (selectedFile.size > 1024 * 1024 * 1024) { // 1GB limit
      alert('File size must be less than 1GB');
      return;
    }

    setFile(selectedFile);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a zip file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(null);

    try {
      const result = await zipChunkedUploadService.uploadZipFile(
        file,
        options as ZipUploadOptions,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      if (result.success) {
        toast.success('Zip file upload initiated successfully!');
        onUploadSuccess?.(result.data!.batchId);
        onClose();
        setFile(null);
      } else {
        toast.error(result.error || 'Upload failed');
      }
    } catch (error) {
      toast.error('Failed to upload zip file. Please try again.');
      console.error('Zip upload error:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFile(null);
      setUploadProgress(null);
      onClose();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Upload ZIP File
          </h2>
          <button
            onClick={handleClose}
            disabled={uploadMutation.isPending}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* File Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : file
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="space-y-2">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="font-medium text-green-700">{file.name}</p>
              <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-12 w-12 text-gray-400 mx-auto" />
              <p className="text-gray-600">
                Drag and drop a ZIP file here, or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  browse
                </button>
              </p>
              <p className="text-sm text-gray-500">Maximum size: 1GB</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Options */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="preserveStructure"
              checked={options.preserveStructure}
              onChange={(e) =>
                setOptions({ ...options, preserveStructure: e.target.checked })
              }
              className="mr-2"
            />
            <label htmlFor="preserveStructure" className="text-sm text-gray-700">
              Preserve folder structure (future feature)
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max file size (MB)
            </label>
            <input
              type="number"
              value={Math.round(options.maxFileSize! / (1024 * 1024))}
              onChange={(e) =>
                setOptions({
                  ...options,
                  maxFileSize: parseInt(e.target.value) * 1024 * 1024,
                })
              }
              min="1"
              max="1024"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allowed file types
            </label>
            <div className="space-y-1">
              {[
                { value: 'IMAGE', label: 'Images' },
                { value: 'VIDEO', label: 'Videos' },
                { value: 'DOCUMENT', label: 'Documents' },
              ].map((type) => (
                <label key={type.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={options.allowedTypes?.includes(type.value as any)}
                    onChange={(e) => {
                      const currentTypes = options.allowedTypes || [];
                      if (e.target.checked) {
                        setOptions({
                          ...options,
                          allowedTypes: [...currentTypes, type.value as any],
                        });
                      } else {
                        setOptions({
                          ...options,
                          allowedTypes: currentTypes.filter((t) => t !== type.value),
                        });
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">{type.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && uploadProgress && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium text-blue-700">
                Uploading... {uploadProgress.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.percentage}%` }}
              />
            </div>
            <div className="text-xs text-blue-600">
              {uploadProgress.uploadedBytes > 0 && (
                <>
                  {formatFileSize(uploadProgress.uploadedBytes)} / {formatFileSize(uploadProgress.totalBytes)}
                  {uploadProgress.currentChunk > 0 && (
                    <span className="ml-2">
                      (Chunk {uploadProgress.currentChunk} of {uploadProgress.totalChunks})
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {uploadMutation.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <p className="text-sm text-red-700 font-medium">Upload failed</p>
              <p className="text-sm text-red-600">
                {uploadMutation.error instanceof Error
                  ? uploadMutation.error.message
                  : 'An error occurred during upload'}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload ZIP'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
