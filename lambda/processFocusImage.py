import json, base64, boto3, os, time, uuid

rekog = boto3.client('rekognition')
dynamo = boto3.resource('dynamodb')
events_tbl = dynamo.Table(os.environ['FOCUS_EVENTS_TABLE'])

def compute_focus(fd):
    # basic pose / eyes calculations
    eyes_open = 100 if fd.get('EyesOpen', {}).get('Value') else 30
    yaw = abs(fd.get('Pose', {}).get('Yaw', 0.0))
    pitch = abs(fd.get('Pose', {}).get('Pitch', 0.0))
    pose_penalty = min(yaw + pitch, 60)

    # emotions from Rekognition
    emos = fd.get('Emotions', [])
    raw_top = max(emos, key=lambda e: e['Confidence'])['Type'] if emos else 'UNKNOWN'
    raw_top = raw_top.upper()

    # helper to get confidence for a given emotion (0 if not present)
    def conf(name):
        for e in emos:
            if e.get('Type', '').upper() == name:
                return e.get('Confidence', 0)
        return 0

    # explicit confidences we'll check
    sad_c = conf('SAD')
    angry_c = conf('ANGRY')
    fear_c = conf('FEAR')
    confused_c = conf('CONFUSED')
    disgusted_c = conf('DISGUSTED')

    # derive a 'STRESSED' label heuristically: a combination of SAD/ANGRY/FEAR
    stressed = False
    if (sad_c + angry_c + fear_c) >= 70:
        stressed = True
    # also consider high confusion with eyes mostly closed as stressed
    if confused_c >= 50 and eyes_open < 60:
        stressed = True

    # decide final reported emotion: use STRESSED when derived, otherwise raw_top
    derived_top = 'STRESSED' if stressed else raw_top

    # score adjustments per emotion (positive = boosts focus, negative = penalty)
    if derived_top in ['CALM', 'HAPPY']:
        emo_adj = 10
    elif derived_top == 'CONFUSED':
        emo_adj = -5
    elif derived_top == 'DISGUSTED':
        emo_adj = -10
    elif derived_top == 'STRESSED':
        emo_adj = -15
    else:
        emo_adj = 0

    score = max(0, min(100, 0.6 * eyes_open + 0.3 * (100 - pose_penalty) + 0.1 * emo_adj))
    return score, derived_top, raw_top

def handler(event, ctx):
    body = json.loads(event.get('body') or '{}')
    session_id = body['sessionId']
    img_b64 = body['imageBase64'].split(',')[-1]
    img_bytes = base64.b64decode(img_b64)

    resp = rekog.detect_faces(Image={'Bytes': img_bytes}, Attributes=['ALL'])
    fds = resp.get('FaceDetails', [])
    if not fds:
        return {"statusCode": 200, "body": json.dumps({"ok": True, "focusScore": 0, "note": "no face"})}

    score, topEmotion, rawEmotion = compute_focus(fds[0])
    ts = int(time.time()*1000)
    events_tbl.put_item(Item={
        'sessionId': session_id, 'ts': ts,
        'focusScore': score, 'emotionTop': topEmotion, 'emotionRaw': rawEmotion
    })
    return {"statusCode": 200, "headers": {"Access-Control-Allow-Origin":"*"},
            "body": json.dumps({"ok": True, "focusScore": score, "emotionTop": topEmotion, "emotionRaw": rawEmotion, "ts": ts})}
