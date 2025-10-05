#Focus Cam

Lightweight web app that captures webcam frames in the browser and posts them to an AWS Lambda. The Lambda uses Amazon Rekognition to produce a simple "focus" score and records events in DynamoDB.

### Features
- Simple static frontend: webcam capture, periodic frame upload
- Serverless backend: AWS Lambda + API Gateway
- Storage/analytics: DynamoDB for event logs, optional analytics view

### Project Structure
- `frontend/` — static assets (`index.html`, `script.js`, `style.css`, analytics page)
- `lambda/` — Lambda code (`processFocusImage.py`)

### Prerequisites
- Node.js (to serve the frontend locally) or any static file server
- Python 3.9+ (for local Lambda testing)
- AWS account with credentials configured (for deploy)

### Quickstart (Frontend)
1) From the project root, start a static server and open the app:

```bash
npx http-server frontend -p 8080
open http://localhost:8080
```

2) Click Start and grant webcam permission. Frames are sent every ~5s to the configured API.

3) Set your API URL in `frontend/script.js` by updating `API_ENDPOINT`.

### Request Payload (to Lambda)
- `sessionId`: string — generated per session
- `userId`: string — optional user identifier
- `timestamp`: ISO string
- `imageBase64`: base64-encoded JPEG bytes (no data: prefix)

### Lambda: Local Testing
Install boto3 if needed and invoke the handler with a sample payload:

```bash
pip install boto3
```

```python
import json, base64
from processFocusImage import handler

with open('test.jpg','rb') as f:
    b = base64.b64encode(f.read()).decode('utf-8')

evt = {'body': json.dumps({'sessionId':'local-1','imageBase64': b})}
print(handler(evt, None))
```

### Deploy (High-level)
1) DynamoDB: create a table for focus events; set env var `FOCUS_EVENTS_TABLE` on the Lambda.
2) Lambda: deploy `lambda/processFocusImage.py` with permissions for Rekognition + DynamoDB.
3) API Gateway: create a POST endpoint that invokes the Lambda; set its URL as `API_ENDPOINT` in `frontend/script.js`.

### Configuration
- Frontend: set `API_ENDPOINT` and, if present, replace any hardcoded `USER_ID`.
- Lambda env vars: `FOCUS_EVENTS_TABLE` (required).

### Security Notes
- Do not expose unauthenticated endpoints publicly. Consider Cognito, API keys, or IAM auth.
- Treat uploaded images as sensitive; follow your data retention policy.

### Roadmap (ideas)
- Add authentication and per-user sessions
- Improve focus scoring heuristics or replace with a small on-device model
- Add unit tests for the Lambda (moto/pytest) and a minimal CI
- Provide IaC (SAM/CloudFormation) for one-command deploy
