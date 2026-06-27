"""
PDF Converter Utility for Skyrchitect AI
Handles PDF to image conversion for architecture diagram analysis
"""

import io
from PIL import Image
from pdf2image import convert_from_bytes
from PyPDF2 import PdfReader
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class PDFConverter:
    """Convert PDF architecture diagrams to images for AI analysis"""

    # Maximum file size (20MB for PDFs)
    MAX_FILE_SIZE = 20 * 1024 * 1024

    # DPI for PDF rendering
    RENDER_DPI = 200

    @classmethod
    def validate_pdf(cls, file_content: bytes, filename: str) -> Tuple[bool, str]:
        """
        Validate uploaded PDF

        Args:
            file_content: Binary content of the PDF
            filename: Original filename

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check file size
        if len(file_content) > cls.MAX_FILE_SIZE:
            return False, f"PDF size exceeds maximum of {cls.MAX_FILE_SIZE / 1024 / 1024}MB"

        # Check if it's a valid PDF
        try:
            pdf = PdfReader(io.BytesIO(file_content))
            page_count = len(pdf.pages)

            if page_count == 0:
                return False, "PDF has no pages"

            logger.info(f"✓ Valid PDF: {page_count} page(s)")
            return True, ""

        except Exception as e:
            return False, f"Invalid PDF file: {str(e)}"

    @classmethod
    def pdf_to_image(
        cls,
        pdf_content: bytes,
        page_number: int = 1
    ) -> Tuple[Optional[bytes], Optional[str]]:
        """
        Convert PDF page to image

        Args:
            pdf_content: Binary content of the PDF
            page_number: Page number to convert (1-indexed)

        Returns:
            Tuple of (image_bytes, error_message)
        """
        try:
            logger.info(f"Converting PDF page {page_number} to image...")

            # Convert PDF to images
            images = convert_from_bytes(
                pdf_content,
                dpi=cls.RENDER_DPI,
                first_page=page_number,
                last_page=page_number,
                fmt='png'
            )

            if not images:
                return None, f"Could not convert PDF page {page_number}"

            # Get the first (and only) image
            img = images[0]

            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # Convert to bytes
            output = io.BytesIO()
            img.save(output, format='PNG', optimize=True)
            image_bytes = output.getvalue()

            logger.info(f"✓ Converted PDF to image: {img.size[0]}x{img.size[1]}, {len(image_bytes)} bytes")
            return image_bytes, None

        except Exception as e:
            logger.error(f"❌ Error converting PDF to image: {e}")
            return None, str(e)

    @classmethod
    def get_pdf_info(cls, pdf_content: bytes) -> dict:
        """
        Extract PDF metadata

        Args:
            pdf_content: Binary content of the PDF

        Returns:
            Dictionary with PDF info
        """
        try:
            pdf = PdfReader(io.BytesIO(pdf_content))
            return {
                'page_count': len(pdf.pages),
                'size_bytes': len(pdf_content),
                'metadata': dict(pdf.metadata) if pdf.metadata else {}
            }
        except Exception as e:
            logger.error(f"❌ Error getting PDF info: {e}")
            return {}
