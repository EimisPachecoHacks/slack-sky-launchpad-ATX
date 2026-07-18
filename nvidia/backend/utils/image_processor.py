"""
Image Processor Utility for Skyrchitect AI
Handles image processing and conversion for AI analysis
"""

import base64
import io
from PIL import Image
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class ImageProcessor:
    """Process and prepare images for AI analysis"""

    # Maximum dimensions for analysis (to reduce token usage)
    MAX_WIDTH = 1920
    MAX_HEIGHT = 1920

    # Maximum file size (10MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024

    # Supported image formats
    SUPPORTED_FORMATS = {'PNG', 'JPEG', 'JPG', 'WEBP'}

    @classmethod
    def validate_image(cls, file_content: bytes, filename: str) -> Tuple[bool, str]:
        """
        Validate uploaded image

        Args:
            file_content: Binary content of the image
            filename: Original filename

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check file size
        if len(file_content) > cls.MAX_FILE_SIZE:
            return False, f"File size exceeds maximum of {cls.MAX_FILE_SIZE / 1024 / 1024}MB"

        # Check file format
        try:
            img = Image.open(io.BytesIO(file_content))
            if img.format not in cls.SUPPORTED_FORMATS:
                return False, f"Unsupported format: {img.format}. Supported: {', '.join(cls.SUPPORTED_FORMATS)}"

            logger.info(f"✓ Valid image: {img.format}, {img.size[0]}x{img.size[1]}")
            return True, ""

        except Exception as e:
            return False, f"Invalid image file: {str(e)}"

    @classmethod
    def process_image(cls, file_content: bytes) -> Tuple[Optional[bytes], Optional[str]]:
        """
        Process image for AI analysis
        - Resize if too large
        - Convert to PNG format
        - Optimize for analysis

        Args:
            file_content: Binary content of the image

        Returns:
            Tuple of (processed_image_bytes, error_message)
        """
        try:
            # Load image
            img = Image.open(io.BytesIO(file_content))

            # Convert to RGB if necessary (some PNGs have alpha channel)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create white background
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # Resize if too large
            original_size = img.size
            if img.width > cls.MAX_WIDTH or img.height > cls.MAX_HEIGHT:
                img.thumbnail((cls.MAX_WIDTH, cls.MAX_HEIGHT), Image.Resampling.LANCZOS)
                logger.info(f"✓ Resized image from {original_size} to {img.size}")

            # Convert to bytes
            output = io.BytesIO()
            img.save(output, format='PNG', optimize=True)
            processed_bytes = output.getvalue()

            logger.info(f"✓ Processed image: {len(processed_bytes)} bytes")
            return processed_bytes, None

        except Exception as e:
            logger.error(f"❌ Error processing image: {e}")
            return None, str(e)

    @classmethod
    def encode_image_base64(cls, image_bytes: bytes) -> str:
        """
        Encode image as base64 for AI API

        Args:
            image_bytes: Binary content of the image

        Returns:
            Base64 encoded string
        """
        return base64.b64encode(image_bytes).decode('utf-8')

    @classmethod
    def get_image_info(cls, file_content: bytes) -> dict:
        """
        Extract image metadata

        Args:
            file_content: Binary content of the image

        Returns:
            Dictionary with image info
        """
        try:
            img = Image.open(io.BytesIO(file_content))
            return {
                'format': img.format,
                'mode': img.mode,
                'width': img.size[0],
                'height': img.size[1],
                'size_bytes': len(file_content)
            }
        except Exception as e:
            logger.error(f"❌ Error getting image info: {e}")
            return {}
