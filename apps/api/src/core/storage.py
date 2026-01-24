"""MinIO object storage for BIM files, 3D models, reports."""
from io import BytesIO
from typing import BinaryIO, Optional
import logging

from minio import Minio
from minio.error import S3Error

from .config import settings

logger = logging.getLogger(__name__)


class ObjectStorage:
    """MinIO object storage client with lazy initialization."""
    
    _client: Optional[Minio] = None
    _available: Optional[bool] = None
    
    @property
    def client(self) -> Optional[Minio]:
        """Lazy-initialize MinIO client."""
        if self._client is None:
            try:
                self._client = Minio(
                    settings.minio_endpoint,
                    access_key=settings.minio_access_key,
                    secret_key=settings.minio_secret_key,
                    secure=settings.minio_secure,
                )
                self._ensure_buckets()
                self._available = True
                logger.info("MinIO storage connected")
            except Exception as e:
                logger.warning(f"MinIO not available: {e}")
                self._available = False
        return self._client
    
    @property
    def is_available(self) -> bool:
        """Check if storage is available."""
        if self._available is None:
            _ = self.client  # Trigger lazy init
        return self._available or False
    
    def _ensure_buckets(self):
        """Create required buckets if they don't exist."""
        if self._client is None:
            return
        buckets = [settings.minio_bucket_assets, settings.minio_bucket_reports]
        for bucket in buckets:
            try:
                if not self._client.bucket_exists(bucket):
                    self._client.make_bucket(bucket)
            except Exception as e:
                logger.warning(f"Could not ensure bucket {bucket}: {e}")
    
    def upload_file(
        self,
        bucket: str,
        object_name: str,
        file_data: BinaryIO,
        content_type: str = "application/octet-stream",
        metadata: dict | None = None,
    ) -> str:
        """Upload file to bucket."""
        if not self.is_available or self._client is None:
            raise S3Error(
                code="ServiceUnavailable",
                message="MinIO storage is not available",
                resource=bucket,
                request_id=None,
                host_id=None,
                response=None,
            )
        
        file_data.seek(0, 2)  # Seek to end
        size = file_data.tell()
        file_data.seek(0)  # Reset to beginning
        
        self._client.put_object(
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
        if not self.is_available or self._client is None:
            raise S3Error(
                code="ServiceUnavailable",
                message="MinIO storage is not available",
                resource=bucket,
                request_id=None,
                host_id=None,
                response=None,
            )
        response = self._client.get_object(bucket, object_name)
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
        if not self.is_available or self._client is None:
            raise S3Error(
                code="ServiceUnavailable",
                message="MinIO storage is not available",
                resource=bucket,
                request_id=None,
                host_id=None,
                response=None,
            )
        from datetime import timedelta
        return self._client.presigned_get_object(
            bucket,
            object_name,
            expires=timedelta(hours=expires_hours),
        )
    
    def delete_file(self, bucket: str, object_name: str):
        """Delete file from bucket."""
        if not self.is_available or self._client is None:
            raise S3Error(
                code="ServiceUnavailable",
                message="MinIO storage is not available",
                resource=bucket,
                request_id=None,
                host_id=None,
                response=None,
            )
        self._client.remove_object(bucket, object_name)
    
    def file_exists(self, bucket: str, object_name: str) -> bool:
        """Check if file exists."""
        if not self.is_available or self._client is None:
            return False
        try:
            self._client.stat_object(bucket, object_name)
            return True
        except S3Error:
            return False


# Global storage instance (lazy initialization)
storage = ObjectStorage()
