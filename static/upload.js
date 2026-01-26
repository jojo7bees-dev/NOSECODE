const imageInput = document.getElementById('imageInput');
const uploadImageBtn = document.getElementById('uploadImageBtn');
const imageResult = document.getElementById('imageResult');

const videoInput = document.getElementById('videoInput');
const uploadVideoBtn = document.getElementById('uploadVideoBtn');
const videoResult = document.getElementById('videoResult');

const status = document.getElementById('status');

function updateStatus(text, type = '') {
    status.innerText = text;
    status.className = 'status-badge ' + (type ? 'status-' + type : '');
}

uploadImageBtn.addEventListener('click', async () => {
    if (!imageInput.files[0]) {
        updateStatus('يرجى اختيار صورة أولاً', 'danger');
        return;
    }

    const formData = new FormData();
    formData.append('file', imageInput.files[0]);

    updateStatus('جاري تحليل الصورة...', 'connected');
    imageResult.innerHTML = '<div style="padding: 20px; text-align: center;">جاري المعالجة...</div>';

    try {
        const response = await fetch('/upload-image', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            imageResult.innerHTML = `<img src="${url}" alt="Result">`;
            updateStatus('اكتمل التحليل بنجاح', 'connected');
        } else {
            updateStatus('حدث خطأ أثناء المعالجة', 'danger');
            imageResult.innerHTML = '';
        }
    } catch (error) {
        console.error(error);
        updateStatus('خطأ في الاتصال بالخادم', 'danger');
    }
});

uploadVideoBtn.addEventListener('click', async () => {
    if (!videoInput.files[0]) {
        updateStatus('يرجى اختيار فيديو أولاً', 'danger');
        return;
    }

    const formData = new FormData();
    formData.append('file', videoInput.files[0]);

    updateStatus('جاري معالجة الفيديو... قد يستغرق الأمر دقيقة', 'connected');
    videoResult.innerHTML = '<div style="padding: 20px; text-align: center;">جاري معالجة الفيديو... يرجى الانتظار</div>';

    try {
        const response = await fetch('/upload-video', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            videoResult.innerHTML = `<video src="${url}" controls></video>`;
            updateStatus('اكتملت معالجة الفيديو', 'connected');
        } else {
            updateStatus('فشلت معالجة الفيديو', 'danger');
            videoResult.innerHTML = '';
        }
    } catch (error) {
        console.error(error);
        updateStatus('خطأ في الاتصال', 'danger');
    }
});
