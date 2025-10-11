#!/bin/bash

# Initialize LocalStack with test bucket
set -x

echo "Waiting for LocalStack to be ready..."
awslocal s3 mb s3://reedi-test || true

echo "Setting bucket CORS policy..."
awslocal s3api put-bucket-cors --bucket reedi-test --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}'

echo "LocalStack initialization complete!"

