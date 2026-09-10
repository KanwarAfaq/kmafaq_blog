from __future__ import annotations

from pathlib import Path

import cloudinary
import cloudinary.uploader

from .config import Settings
from .models import MediaAsset


def upload_cover(settings: Settings, image_path: Path) -> MediaAsset:
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    result = cloudinary.uploader.upload(
        str(image_path),
        resource_type="image",
        folder=settings.cloudinary_folder,
        unique_filename=True,
        overwrite=False,
    )
    return MediaAsset(
        secure_url=result["secure_url"],
        public_id=result["public_id"],
        asset_id=result["asset_id"],
        resource_type=result.get("resource_type", "image"),
        format=result.get("format"),
        width=result.get("width"),
        height=result.get("height"),
    )
