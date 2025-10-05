FOCUS CAM

This small project captures webcam images from a browser frontend and posts them to an AWS Lambda which uses Rekognition to compute a "focus" score and save events to DynamoDB.

Structure
- `frontend/` - static assets (index.html, script.js, style.css)
- `lambda/` - AWS Lambda function code (`processFocusImage.py`)

Quick goals
- Run the frontend locally and record a session.
- Send images to the Lambda endpoint (API Gateway) which analyzes faces and stores events in DynamoDB.

Prerequisites
- Node.js (for serving frontend locally) or any static file server
- Python 3.9+ (for Lambda tests)
- AWS account and CLI configured (for deploy)
- Optional: AWS SAM CLI for local Lambda/API testing

Frontend - run locally
1. Open `frontend/index.html` in your browser (or serve the folder). For a quick static server using Node:

```bash
# from project root
npx http-server frontend -p 8080
# then open http://localhost:8080
```

2. Click Start to allow webcam access. The frontend will generate a session id and post images every 5 seconds to the API endpoint configured in `frontend/script.js` (update `API_ENDPOINT` to your API Gateway URL).

Payload keys sent to Lambda
- `sessionId` (string) - session identifier
- `userId` (string) - optional user identifier
- `timestamp` (ISO string)
- `imageBase64` (base64-encoded JPEG bytes without data: prefix)

Lambda - local testing
1. Install dependencies for local testing (boto3 if you want to call AWS services locally):

```bash
pip install boto3
```

2. To test the Lambda handler directly with a saved image, you can write a small Python snippet to load an image, base64-encode it and call `handler` from `lambda/processFocusImage.py` (the code expects payload keys `sessionId` and `imageBase64`).

Example quick test (python REPL):

```python
import json, base64
from processFocusImage import handler

with open('test.jpg','rb') as f:
	b = base64.b64encode(f.read()).decode('utf-8')

evt = {'body': json.dumps({'sessionId':'local-1','imageBase64': b})}
print(handler(evt, None))
```

Note: the real Lambda uses `boto3.client('rekognition')` and `boto3.resource('dynamodb')`. When running locally, either mock these calls or ensure AWS credentials and network access are available.

Deploying to AWS (high-level)
1. Create a DynamoDB table and set its name in the Lambda env var `FOCUS_EVENTS_TABLE`.
2. Create a Lambda function using `lambda/processFocusImage.py` as the handler. Ensure the Lambda role has permissions for Rekognition and DynamoDB.
3. Create an API Gateway REST API or HTTP API with a POST method that invokes the Lambda. Note the URL and set it as `API_ENDPOINT` in `frontend/script.js`.

Security & next steps
- Add auth to the API (Cognito / API keys / IAM) before exposing it publicly.
- Replace the hardcoded `USER_ID` in `frontend/script.js` with a real authenticated user id.
- Add unit tests for `processFocusImage.py` with mocked Rekognition responses (I can add pytest examples if you want).

If you'd like, I can:
- Add a small test harness for local Lambda testing (pytest + moto mocks).
- Generate deployment IaC (SAM template or CloudFormation) to wire up API Gateway + Lambda + DynamoDB.

