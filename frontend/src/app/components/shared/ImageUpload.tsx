import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, User, Building2 } from 'lucide-react';

interface ImageUploadProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  type?: 'avatar' | 'logo';
  label?: string;
}

export function ImageUpload({ value, onChange, type = 'avatar', label }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | undefined>(value);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreview(result);
        onChange(result);
      };
      reader.readAsDataURL(file);
    }
  }, [onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleRemove = () => {
    setPreview(undefined);
    onChange(undefined);
  };

  const DefaultIcon = type === 'avatar' ? User : Building2;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className={`
          relative flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700
          ${type === 'avatar' ? 'w-20 h-20 rounded-full' : 'w-24 h-24'}
        `}>
          {preview ? (
            <>
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <DefaultIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
          )}
        </div>

        {/* Upload Zone */}
        <div
          {...getRootProps()}
          className={`
            flex-1 border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors
            ${isDragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isDragActive ? (
                  'Drop the image here'
                ) : (
                  <>
                    <span className="font-medium text-blue-600 dark:text-blue-400">Click to upload</span>
                    {' '}or drag and drop
                  </>
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                PNG, JPG, GIF up to 10MB
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
