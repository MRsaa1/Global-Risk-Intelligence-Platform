"""MinIO object storage for BIM files, 3D models, reports."""
from io import BytesIO
from typing import BinaryIO

from minio import Minio
from minio.error import S3Error

from .config import settings


class ObjectStorage:
    """MinIO object storage client."""
    
    def __init__(self):
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self._ensure_buckets()
    
    def _ensure_buckets(self):
        """Create required buckets if they don't exist."""
        buckets = [settings.minio_bucket_assets, settings.minio_bucket_reports]
        for bucket in buckets:
            if not self.client.bucket_exists(bucket):
                self.client.make_bucket(bucket)
    
    def upload_file(
        self,
        bucket: str,
        object_name: str,
        file_data: BinaryIO,
        content_type: str = "application/octet-stream",
        metadata: dict | None = None,
    ) -> str:
        """Upload file to bucket."""
        file_data.seek(0, 2)  # Seek to end
        size = file_data.tell()
        file_data.seek(0)  # Reset to beginning
        
        self.client.put_object(
            bucket,
            object_name,
            file_data,
            size,
            content_type=content_type,
            metadata=metadata or {},
        )
        return f"{bucket}/{object_name}"
    
    def download_file(self, bucket: str, object_name: str) -> bytes:
        """Download file from bucket."""
        response = self.client.get_object(bucket, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()
    
    def get_presigned_url(
        self,
        bucket: str,
        object_name: str,
        expires_hours: int = 1,
    ) -> str:
        """Get presigned URL for direct access."""
        from datetime import timedelta
        return self.client.presigned_get_object(
            bucket,
            object_name,
            expires=timedelta(hours=expires_hours),
        )
    
    def delete_file(self, bucket: str, object_name: str):
        """Delete file from bucket."""
        self.client.remove_object(bucket, object_name)
    
    def file_exists(self, bucket: str, object_name: str) -> bool:
        """Check if file exists."""
        try:
            self.client.stat_object(bucket, object_name)
            return True
        except S3Error:
            return False


# Global storage instance
storage = ObjectStorage()
