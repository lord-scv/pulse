from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    
    if response is not None:
        code = getattr(exc, 'default_code', 'error')
        message = "An error occurred."
        field = None
        
        # Parse DRF response data
        if isinstance(response.data, dict):
            keys = list(response.data.keys())
            if keys:
                first_key = keys[0]
                val = response.data[first_key]
                if first_key == 'detail':
                    if isinstance(val, dict):
                        message = val.get('message', str(val))
                        code = val.get('code', code)
                    else:
                        message = str(val)
                else:
                    field = first_key
                    if isinstance(val, list):
                        message = str(val[0])
                    elif isinstance(val, dict):
                        # Nested fields
                        message = str(list(val.values())[0])
                    else:
                        message = str(val)
                    code = "validation_error"
        elif isinstance(response.data, list):
            if response.data:
                message = str(response.data[0])
            code = "validation_error"
            
        custom_data = {
            "error": {
                "code": code,
                "message": message
            }
        }
        if field:
            custom_data["error"]["field"] = field
            
        response.data = custom_data
        
    return response
