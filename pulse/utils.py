import os
from io import BytesIO
from django.core.files.base import ContentFile
from PIL import Image

def compress_to_webp(image_file, quality=80, max_size=(1080, 1080)):
    """
    Compresses an image file and converts it to WebP format.
    Resizes image to a max size (preserving aspect ratio) if it exceeds it.
    """
    if not image_file:
        return None
        
    try:
        img = Image.open(image_file)
        
        # Preserve transparency for PNG/WebP
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            # Keep transparency mode
            pass
        else:
            img = img.convert('RGB')
            
        # Resize if larger than max_size
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        output = BytesIO()
        img.save(output, format='WebP', quality=quality)
        output.seek(0)
        
        # Construct filename with .webp extension
        base_name = os.path.splitext(image_file.name)[0]
        new_name = f"{base_name}.webp"
        
        return ContentFile(output.read(), name=new_name)
    except Exception as e:
        # Fallback to original if conversion fails
        return image_file
