import cv2
import numpy as np
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Response, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
import json
import uvicorn
import logging
import os
import uuid
import shutil

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Load YOLO model from ONNX format
# Using model.onnx as requested
MODEL_PATH = 'model.onnx'
if not os.path.exists(MODEL_PATH):
    logger.error(f"Model file {MODEL_PATH} not found!")
    # Fallback to yolov8n.pt if onnx is missing (for safety during development)
    model = YOLO('yolov8n.pt')
else:
    model = YOLO(MODEL_PATH, task='detect')

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

            # Run YOLO inference
            results = model.predict(img, conf=0.3, verbose=False)[0]

            detections = []
            if results.boxes:
                for box in results.boxes:
                    cls = int(box.cls[0])
                    # Filter for only one class (e.g., class 0) to strictly follow requirements
                    # if the model has more than one class.
                    if cls != 0:
                        continue

                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    label = model.names[cls]

                    detections.append({
                        "box": [int(x1), int(y1), int(x2), int(y2)],
                        "confidence": conf,
                        "label": label,
                        "class_id": cls
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

def remove_file(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        logger.error(f"Error removing file {path}: {e}")

@app.post("/upload-video")
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    os.makedirs("temp", exist_ok=True)
    file_id = str(uuid.uuid4())
    input_path = f"temp/{file_id}_{file.filename}"
    output_filename = f"detected_{file_id}_{file.filename}"
    output_filename = os.path.splitext(output_filename)[0] + ".mp4"
    output_path = f"temp/{output_filename}"

    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        cap = cv2.VideoCapture(input_path)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        if not out.isOpened():
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            results = model.predict(frame, conf=0.3, verbose=False)[0]
            # Filter detections for class 0 only
            if results.boxes:
                mask = results.boxes.cls == 0
                results.boxes = results.boxes[mask]

            # Draw detections
            res_plotted = results.plot()
            out.write(res_plotted)

        cap.release()
        out.release()

        background_tasks.add_task(remove_file, input_path)
        background_tasks.add_task(remove_file, output_path)

        return FileResponse(output_path, media_type="video/mp4", filename=output_filename)
    except Exception as e:
        logger.error(f"Error processing video: {e}")
        remove_file(input_path)
        remove_file(output_path)
        return Response(content=json.dumps({"error": str(e)}), status_code=500)

@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {"error": "Invalid image"}

    # Run YOLO inference
    results = model.predict(img, conf=0.3, verbose=False)[0]

    # Filter detections for class 0 only
    if results.boxes:
        mask = results.boxes.cls == 0
        results.boxes = results.boxes[mask]

    # Draw detections
    res_plotted = results.plot()

    # Encode image back to bytes
    _, im_png = cv2.imencode(".png", res_plotted)

    return Response(content=im_png.tobytes(), media_type="image/png")

# Serve static files
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
