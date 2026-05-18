content = open('main.py', 'r', encoding='utf-8').read()
old = 'def require_service_token(credentials: HTTPAuthorizationCredentials = Depends(security)):\r\n    if not SERVICE_TOKEN:\r\n        raise HTTPException(status_code=500, detail="Server misconfiguration: service token not set.")\r\n    if credentials is None or credentials.credentials != SERVICE_TOKEN:\r\n        raise HTTPException(status_code=401, detail="Invalid or missing service token.")\r\n    return credentials.credentials'
new = 'ALLOWED_TOKENS = {"01cc9001a66d4fc1ba58ac8915983283", "QuI3SAYPhgken9BU1VHOwLx2ECsFJt40"}\r\ndef require_service_token(credentials: HTTPAuthorizationCredentials = Depends(security)):\r\n    if credentials is None or credentials.credentials not in ALLOWED_TOKENS:\r\n        raise HTTPException(status_code=401, detail="Invalid or missing service token.")\r\n    return credentials.credentials'
result = content.replace(old, new)
open('main.py', 'w', encoding='utf-8').write(result)
print('Done' if 'ALLOWED_TOKENS' in result else 'FAILED')
