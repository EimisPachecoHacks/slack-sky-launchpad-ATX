"""
S3 Storage Utility for Skyrchitect AI
Handles uploading and managing architecture diagram images in S3
"""

import os
import boto3
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class S3Storage:
    """S3 bucket manager for storing uploaded architecture diagrams"""

    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            region_name=os.getenv('AWS_DEFAULT_REGION', 'us-west-2')
        )
        self.bucket_name = os.getenv('S3_DIAGRAMS_BUCKET', 'skyrchitect-diagrams')

        # Create bucket if it doesn't exist
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        """Create S3 bucket if it doesn't exist"""
        try:
            # Check if bucket exists
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            logger.info(f"✓ S3 bucket '{self.bucket_name}' exists")
        except Exception as e:
            logger.info(f"Creating S3 bucket '{self.bucket_name}'...")
            try:
                region = os.getenv('AWS_DEFAULT_REGION', 'us-west-2')

                if region == 'us-east-1':
                    # us-east-1 doesn't need LocationConstraint
                    self.s3_client.create_bucket(Bucket=self.bucket_name)
                else:
                    self.s3_client.create_bucket(
                        Bucket=self.bucket_name,
                        CreateBucketConfiguration={'LocationConstraint': region}
                    )

                # Enable versioning for backup
                self.s3_client.put_bucket_versioning(
                    Bucket=self.bucket_name,
                    VersioningConfiguration={'Status': 'Enabled'}
                )

                # Set lifecycle policy to delete old versions after 90 days
                self.s3_client.put_bucket_lifecycle_configuration(
                    Bucket=self.bucket_name,
                    LifecycleConfiguration={
                        'Rules': [
                            {
                                'Id': 'DeleteOldVersions',
                                'Status': 'Enabled',
                                'NoncurrentVersionExpiration': {'NoncurrentDays': 90}
                            }
                        ]
                    }
                )

                logger.info(f"✓ S3 bucket '{self.bucket_name}' created successfully")
            except Exception as create_error:
                logger.warning(f"Could not create S3 bucket: {create_error}")
                logger.warning("Images will be analyzed but not backed up to S3")

    def upload_diagram(
        self,
        file_content: bytes,
        filename: str,
        content_type: str = 'image/png',
        metadata: Optional[dict] = None
    ) -> Optional[str]:
        """
        Upload architecture diagram to S3

        Args:
            file_content: Binary content of the file
            filename: Original filename
            content_type: MIME type of the file
            metadata: Additional metadata to store

        Returns:
            S3 URL of the uploaded file, or None if upload fails
        """
        try:
            # Generate unique key with timestamp
            timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
            file_extension = filename.split('.')[-1] if '.' in filename else 'png'
            s3_key = f"diagrams/{timestamp}-{filename}"

            # Prepare metadata
            s3_metadata = metadata or {}
            s3_metadata.update({
                'original-filename': filename,
                'upload-timestamp': timestamp
            })

            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type,
                Metadata=s3_metadata,
                ServerSideEncryption='AES256'  # Encrypt at rest
            )

            # Generate S3 URL
            s3_url = f"s3://{self.bucket_name}/{s3_key}"

            logger.info(f"✓ Diagram uploaded to S3: {s3_url}")
            return s3_url

        except Exception as e:
            logger.error(f"❌ Failed to upload diagram to S3: {e}")
            return None

    def get_presigned_url(self, s3_key: str, expiration: int = 3600) -> Optional[str]:
        """
        Generate a presigned URL for accessing the diagram

        Args:
            s3_key: S3 object key
            expiration: URL expiration time in seconds (default: 1 hour)

        Returns:
            Presigned URL or None if generation fails
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=expiration
            )
            return url
        except Exception as e:
            logger.error(f"❌ Failed to generate presigned URL: {e}")
            return None

    def delete_diagram(self, s3_key: str) -> bool:
        """
        Delete a diagram from S3

        Args:
            s3_key: S3 object key

        Returns:
            True if deletion was successful
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            logger.info(f"✓ Diagram deleted from S3: {s3_key}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to delete diagram from S3: {e}")
            return False


# Singleton instance
_s3_storage = None

def get_s3_storage() -> S3Storage:
    """Get or create S3Storage singleton"""
    global _s3_storage
    if _s3_storage is None:
        _s3_storage = S3Storage()
    return _s3_storage
