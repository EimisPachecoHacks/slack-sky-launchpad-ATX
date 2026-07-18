"""File upload validation and security"""

import magic
import os
from typing import Tuple, Optional
from fastapi import UploadFile, HTTPException, status
from backend.config import settings
import logging

logger = logging.getLogger(__name__)


# MIME type mappings for allowed file types
ALLOWED_MIME_TYPES = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/jpg": [".jpg", ".jpeg"],
    "application/pdf": [".pdf"],
}

# Magic number signatures for file type detection
FILE_SIGNATURES = {
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
    b"%PDF": "application/pdf",
}


class FileValidationError(HTTPException):
    """Custom file validation error"""
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


def validate_file_extension(filename: str) -> str:
    """
    Validate file extension

    Args:
        filename: Name of the file

    Returns:
        File extension (lowercase with dot)

    Raises:
        FileValidationError: If extension is not allowed
    """
    if not filename:
        raise FileValidationError("Filename is required")

    # Get extension
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    # Check if extension is allowed
    allowed_extensions = settings.get_allowed_extensions()
    if ext not in allowed_extensions:
        raise FileValidationError(
            f"File extension '{ext}' not allowed. "
            f"Allowed extensions: {', '.join(allowed_extensions)}"
        )

    return ext


def validate_file_size(file_size: int) -> None:
    """
    Validate file size

    Args:
        file_size: Size of file in bytes

    Raises:
        FileValidationError: If file is too large
    """
    max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    if file_size > max_size_bytes:
        raise FileValidationError(
            f"File size ({file_size / 1024 / 1024:.2f} MB) exceeds "
            f"maximum allowed size ({settings.MAX_UPLOAD_SIZE_MB} MB)"
        )


def detect_mime_type(file_content: bytes, filename: str) -> str:
    """
    Detect MIME type using magic numbers (file signatures)

    Args:
        file_content: First few bytes of file
        filename: Original filename

    Returns:
        Detected MIME type

    Raises:
        FileValidationError: If MIME type cannot be detected or is not allowed
    """
    # Try to detect from magic numbers
    detected_mime = None

    for signature, mime_type in FILE_SIGNATURES.items():
        if file_content.startswith(signature):
            detected_mime = mime_type
            break

    # Fallback: Try python-magic if available
    if not detected_mime:
        try:
            mime = magic.Magic(mime=True)
            detected_mime = mime.from_buffer(file_content)
        except Exception as e:
            logger.warning(f"Failed to detect MIME type with magic: {e}")

    # If still not detected, try from extension
    if not detected_mime:
        ext = os.path.splitext(filename)[1].lower()
        for mime_type, extensions in ALLOWED_MIME_TYPES.items():
            if ext in extensions:
                detected_mime = mime_type
                break

    if not detected_mime:
        raise FileValidationError("Could not determine file type")

    # Verify MIME type is allowed
    if detected_mime not in ALLOWED_MIME_TYPES:
        raise FileValidationError(
            f"File type '{detected_mime}' not allowed. "
            f"Allowed types: {', '.join(ALLOWED_MIME_TYPES.keys())}"
        )

    return detected_mime


def validate_mime_vs_extension(mime_type: str, extension: str) -> None:
    """
    Validate that MIME type matches file extension

    Args:
        mime_type: Detected MIME type
        extension: File extension

    Raises:
        FileValidationError: If MIME type doesn't match extension
    """
    allowed_extensions = ALLOWED_MIME_TYPES.get(mime_type, [])

    if extension not in allowed_extensions:
        raise FileValidationError(
            f"File extension '{extension}' does not match detected file type '{mime_type}'. "
            f"Possible polyglot file attack detected."
        )


async def validate_upload_file(file: UploadFile) -> Tuple[str, str, bytes]:
    """
    Comprehensive file upload validation

    Validates:
    - File extension
    - File size
    - MIME type (using magic numbers)
    - MIME type matches extension (prevents polyglot attacks)

    Args:
        file: Uploaded file

    Returns:
        Tuple of (extension, mime_type, file_content)

    Raises:
        FileValidationError: If any validation fails
    """
    # Validate filename exists
    if not file.filename:
        raise FileValidationError("Filename is required")

    # Validate extension
    extension = validate_file_extension(file.filename)

    # Read file content
    file_content = await file.read()
    file_size = len(file_content)

    # Validate size
    validate_file_size(file_size)

    # Detect MIME type from content
    mime_type = detect_mime_type(file_content[:1024], file.filename)

    # Validate MIME type matches extension
    validate_mime_vs_extension(mime_type, extension)

    # Log successful validation
    logger.info(
        f"File validation successful: {file.filename} "
        f"({file_size / 1024:.2f} KB, {mime_type})"
    )

    # Reset file pointer for further reading
    await file.seek(0)

    return extension, mime_type, file_content


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent directory traversal and other attacks

    Args:
        filename: Original filename

    Returns:
        Sanitized filename
    """
    # Remove directory components
    filename = os.path.basename(filename)

    # Remove null bytes
    filename = filename.replace("\x00", "")

    # Remove leading dots (hidden files)
    while filename.startswith("."):
        filename = filename[1:]

    # Replace potentially dangerous characters
    dangerous_chars = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"]
    for char in dangerous_chars:
        filename = filename.replace(char, "_")

    # Limit length
    max_length = 255
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length - len(ext)] + ext

    # Ensure filename is not empty after sanitization
    if not filename or filename == ".":
        filename = "uploaded_file"

    return filename


# Dependency for FastAPI routes
async def validate_file_upload(file: UploadFile) -> Tuple[str, str, bytes]:
    """
    FastAPI dependency for file upload validation

    Usage:
        @app.post("/upload")
        async def upload_file(
            file_data: Tuple[str, str, bytes] = Depends(validate_file_upload)
        ):
            extension, mime_type, content = file_data
            ...
    """
    return await validate_upload_file(file)
