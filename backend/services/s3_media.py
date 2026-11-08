"""
AWS S3 Media Storage Service.
Provides presigned URL generation, secure file validation, MIME type checking,
and CloudFront media delivery URL formatting.
Maintains 100% backward compatibility with existing media URLs.
"""
import os
import uuid
import mimetypes
import logging
from typing import Dict, Any, Optional
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

logger = logging.getLogger("gathrcart.s3_media")

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf"
}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 # 10 MB

class S3MediaService:
    def __init__(self):
        self.bucket = os.environ.get("AWS_S3_BUCKET", "smartcart-media-storage")
        self.region = os.environ.get("AWS_DEFAULT_REGION", "ap-south-1")
        self.cloudfront_domain = os.environ.get("CLOUDFRONT_DOMAIN") # e.g. "d123456.cloudfront.net"
        
        # Boto3 client with signature version v4
        self.s3_client = boto3.client(
            "s3",
            region_name=self.region,
            config=Config(signature_version="s3v4")
        )

    def validate_file(self, filename: str, content_type: str, file_size: Optional[int] = None) -> bool:
        if content_type not in ALLOWED_MIME_TYPES:
            raise ValueError(f"Content-Type '{content_type}' is not permitted.")
        if file_size and file_size > MAX_FILE_SIZE_BYTES:
            raise ValueError(f"File size exceeds maximum permitted limit of {MAX_FILE_SIZE_BYTES / (1024*1024)} MB.")
        return True

    def generate_presigned_upload(self, folder: str, filename: str, content_type: str) -> Dict[str, Any]:
        """
        Generates presigned upload URL directly to Amazon S3.
        Folder e.g., 'products', 'shops', 'riders', 'profiles'.
        """
        self.validate_file(filename, content_type)
        ext = os.path.splitext(filename)[1].lower() or ".jpg"
        object_key = f"{folder.strip('/')}/{uuid.uuid4().hex}{ext}"

        try:
            presigned_post = self.s3_client.generate_presigned_post(
                Bucket=self.bucket,
                Key=object_key,
                Fields={"Content-Type": content_type},
                Conditions=[
                    {"Content-Type": content_type},
                    ["content-length-range", 100, MAX_FILE_SIZE_BYTES]
                ],
                ExpiresIn=3600 # 1 hour
            )
            public_url = self.get_public_media_url(object_key)
            return {
                "upload_url": presigned_post["url"],
                "fields": presigned_post["fields"],
                "object_key": object_key,
                "media_url": public_url
            }
        except ClientError as e:
            logger.error(f"Error generating presigned upload: {e}")
            # Fallback for local testing without AWS credentials
            return {
                "upload_url": f"https://{self.bucket}.s3.{self.region}.amazonaws.com",
                "fields": {"key": object_key, "Content-Type": content_type},
                "object_key": object_key,
                "media_url": self.get_public_media_url(object_key)
            }

    def get_public_media_url(self, object_key: str) -> str:
        """
        Returns CloudFront distribution URL if configured, else direct S3 path.
        """
        if self.cloudfront_domain:
            return f"https://{self.cloudfront_domain}/{object_key}"
        return f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{object_key}"

s3_media_service = S3MediaService()
