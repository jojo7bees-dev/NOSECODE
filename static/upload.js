const imageInput = document.getElementById('imageInput');
const uploadImageBtn = document.getElementById('uploadImageBtn');
const imageResult = document.getElementById('imageResult');

const videoInput = document.getElementById('videoInput');
const uploadVideoBtn = document.getElementById('uploadVideoBtn');
const videoResult = document.getElementById('videoResult');

const status = document.getElementById('status');

uploadImageBtn.addEventListener('click', async () => {
    if (!imageInput.files[0]) {
        alert('يرجى اختيار صورة أولاً');
        return;
    }

    const formData = new FormData();
    formData.append('file', imageInput.files[0]);

    status.innerText = 'الحالة: جاري معالجة الصورة...';
    imageResult.innerHTML = '';

    try {
        const response = await fetch('/upload-image', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const img = document.createElement('img');
            img.src = url;
            img.style.maxWidth = '100%';
            imageResult.appendChild(img);
            status.innerText = 'الحالة: تم الانتهاء';
        } else {
            status.innerText = 'الحالة: حدث خطأ أثناء المعالجة';
        }
    } catch (error) {
        console.error(error);
        status.innerText = 'الحالة: حدث خطأ في الاتصال';
    }
});

uploadVideoBtn.addEventListener('click', async () => {
    if (!videoInput.files[0]) {
        alert('يرجى اختيار فيديو أولاً');
        return;
    }

    const formData = new FormData();
    formData.append('file', videoInput.files[0]);

    status.innerText = 'الحالة: جاري معالجة الفيديو (قد يستغرق ذلك وقتاً)...';
    videoResult.innerHTML = '';

    try {
        const response = await fetch('/upload-video', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.style.maxWidth = '100%';
            videoResult.appendChild(video);
            status.innerText = 'الحالة: تم الانتهاء';
        } else {
            status.innerText = 'الحالة: حدث خطأ أثناء المعالجة';
        }
    } catch (error) {
        console.error(error);
        status.innerText = 'الحالة: حدث خطأ في الاتصال';
    }
});
