const video = document.getElementById('webcam');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const status = document.getElementById('status');

let ws;
let isStreaming = false;

// Initialize WebSocket
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
        status.innerText = 'الحالة: متصل بالخادم';
    };

    ws.onmessage = (event) => {
        const detections = JSON.parse(event.data);
        drawDetections(detections);
    };

    ws.onclose = () => {
        status.innerText = 'الحالة: تم قطع الاتصال بالخادم. إعادة المحاولة...';
        setTimeout(initWebSocket, 2000);
    };
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        video.srcObject = stream;
        isStreaming = true;
        startBtn.style.display = 'none';
        status.innerText = 'الحالة: جاري المعالجة...';

        // Match canvas size to video
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            sendFrames();
        };
    } catch (err) {
        console.error('Error accessing webcam:', err);
        status.innerText = 'الحالة: فشل الوصول إلى الكاميرا';
    }
}

function sendFrames() {
    if (!isStreaming) return;

    // Draw video frame to an offscreen canvas to get base64 data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);

    const base64Image = tempCanvas.toDataURL('image/jpeg', 0.5); // 0.5 quality for speed

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(base64Image);
    }

    // Capture next frame in ~100ms (approx 10 FPS to avoid overloading)
    setTimeout(sendFrames, 100);
}

function drawDetections(detections) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.font = '18px Arial';
    ctx.fillStyle = '#00ff00';

    detections.forEach(det => {
        const [x1, y1, x2, y2] = det.box;
        const label = `${det.label} ${(det.confidence * 100).toFixed(1)}%`;

        // Draw box
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Draw label background
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(x1, y1 - 25, textWidth + 10, 25);

        // Draw text
        ctx.fillStyle = '#000000';
        ctx.fillText(label, x1 + 5, y1 - 7);
        ctx.fillStyle = '#00ff00';
    });
}

startBtn.addEventListener('click', () => {
    initWebSocket();
    startCamera();
});
