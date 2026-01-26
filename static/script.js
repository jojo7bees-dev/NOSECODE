const video = document.getElementById('webcam');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const status = document.getElementById('status');

let ws;
let isStreaming = false;

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
        status.innerText = 'متصل بالخادم';
        status.classList.add('status-connected');
    };

    ws.onmessage = (event) => {
        try {
            const detections = JSON.parse(event.data);
            drawDetections(detections);
        } catch (e) {
            console.error("Error parsing detections:", e);
        }
    };

    ws.onclose = () => {
        status.innerText = 'انقطع الاتصال... جارٍ الإعادة';
        status.classList.remove('status-connected');
        setTimeout(initWebSocket, 3000);
    };
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "environment"
            }
        });
        video.srcObject = stream;
        isStreaming = true;
        startBtn.style.display = 'none';

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            sendFrames();
        };
    } catch (err) {
        console.error('Error:', err);
        status.innerText = 'فشل تشغيل الكاميرا';
    }
}

function sendFrames() {
    if (!isStreaming) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(video, 0, 0);

        const base64Image = tempCanvas.toDataURL('image/jpeg', 0.6);
        ws.send(base64Image);
    }

    setTimeout(sendFrames, 66); // ~15 FPS
}

function drawDetections(detections) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach(det => {
        const [x1, y1, x2, y2] = det.box;
        const confidence = (det.confidence * 100).toFixed(1);
        const label = `${det.label} ${confidence}%`;

        // Draw Bounding Box with Glow
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Draw Label Background
        ctx.fillStyle = '#4f46e5';
        const textWidth = ctx.measureText(label).width;
        const padding = 8;
        ctx.fillRect(x1 - 2, y1 - 32, textWidth + padding * 2, 32);

        // Draw Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Tajawal, sans-serif';
        ctx.fillText(label, x1 + padding, y1 - 10);
    });
}

startBtn.addEventListener('click', () => {
    initWebSocket();
    startCamera();
});
