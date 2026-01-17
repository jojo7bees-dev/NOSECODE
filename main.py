import cv2
import numpy as np
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
import json
import uvicorn
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Load YOLOv8 model (n is the smallest and fastest version)
# This will download the model weights on the first run
model = YOLO('yolov8n.pt')

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection accepted")
    try:
        while True:
            # Receive base64 encoded image from the client
            data = await websocket.receive_text()

            if not data:
                continue

            # Remove the data URL prefix if it exists
            if "," in data:
                _, encoded = data.split(",", 1)
            else:
                encoded = data

            # Decode the base64 image
            try:
                binary_data = base64.b64decode(encoded)
                np_data = np.frombuffer(binary_data, dtype=np.uint8)
                img = cv2.imdecode(np_data, cv2.IMREAD_COLOR)
            except Exception as e:
                logger.error(f"Failed to decode image: {e}")
                await websocket.send_text(json.dumps({"error": "Decoding error"}))
                continue

            if img is None:
                await websocket.send_text(json.dumps({"error": "Invalid image"}))
                continue

            # Run YOLOv8 inference
            # We use stream=True for better performance in loops
            results = model(img, conf=0.3, verbose=False)[0]

            detections = []
            if results.boxes:
                for box in results.boxes:
                    # Get box coordinates, confidence and class
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    label = model.names[cls]

                    detections.append({
                        "box": [int(x1), int(y1), int(x2), int(y2)],
                        "confidence": conf,
                        "label": label
                    })

            # Send results back to the client
            await websocket.send_text(json.dumps(detections))
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        try:
            await websocket.send_text(json.dumps({"error": "Server error"}))
        except:
            pass

# Serve static files
# This must be mounted AFTER other routes if it's at root
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
