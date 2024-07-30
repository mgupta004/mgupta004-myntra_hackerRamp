const SERVER_URL = "http://localhost:8000";

document.getElementById("fileInput").addEventListener("change", uploadImage);

async function uploadImage(event) {
    const file = event.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${SERVER_URL}/detect_classes`, {
        method: 'POST',
        body: formData
    });

    const data = await response.json();
    if (data.file_type === 'image') {
        displayTaggedImage(data.image);
    } else if (data.file_type === 'video') {
        displayTaggedVideo(data.image);
    }
    displayClassNames(data.classes);
}

function displayTaggedImage(imageSrc) {
    const imgElement = document.getElementById("taggedImage");
    imgElement.src = `${SERVER_URL}${imageSrc}`;
    imgElement.style.display = 'block';

    // Hide the video element if it's shown
    const videoElement = document.getElementById("taggedVideo");
    if (videoElement) {
        videoElement.style.display = 'none';
    }
}


// function displayTaggedVideo(videoSrc) {
//     let videoElement = document.getElementById("taggedVideo");

//     if (!videoElement) {
//         videoElement = document.createElement("video");
//         videoElement.id = "taggedVideo";
//         videoElement.controls = true;
//         videoElement.style.maxWidth = "100%";
//         document.getElementById("result").appendChild(videoElement);
//     }

//     videoElement.src = `${SERVER_URL}${videoSrc}`;
//     videoElement.style.display = 'block';

//     // Hide the image element if it's shown
//     const imgElement = document.getElementById("taggedImage");
//     if (imgElement) {
//         imgElement.style.display = 'none';
//     }
// }

function displayTaggedVideo(videoSrc) {
    let videoElement = document.getElementById("taggedVideo");

    if (!videoElement) {
        videoElement = document.createElement("video");
        videoElement.id = "taggedVideo";
        videoElement.controls = true;
        videoElement.style.maxWidth = "100%";
        document.getElementById("result").appendChild(videoElement);
    }
    console.log(`Video URL: ${SERVER_URL}${videoSrc}`);

    videoElement.src = `${SERVER_URL}${videoSrc}`;
    videoElement.load();  // Force reload the video element
    videoElement.style.display = 'block';

    // Hide the image element if it's shown
    const imgElement = document.getElementById("taggedImage");
    if (imgElement) {
        imgElement.style.display = 'none';
    }
}



function displayClassNames(classes) {
    const classesDiv = document.getElementById("classes");
    if (!classesDiv) {
        console.error("Element with ID 'classes' not found.");
        return;
    }

    classesDiv.innerHTML = '';

    Object.keys(classes).forEach(className => {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = classes[className]; // Assign the ID from classes
        checkbox.value = className;
        checkbox.name = "classes";
        classesDiv.appendChild(checkbox);

        const label = document.createElement("label");
        label.textContent = className;
        label.setAttribute("for", classes[className]);
        classesDiv.appendChild(label);

        classesDiv.appendChild(document.createElement("br"));
    });

    const fetchSimilarBtn = document.getElementById("fetchSimilarBtn");
    if (fetchSimilarBtn) {
        fetchSimilarBtn.style.display = 'block';
        fetchSimilarBtn.onclick = fetchSimilarImages;
    } else {
        console.error("Element with ID 'fetchSimilarBtn' not found.");
    }
}

async function fetchSimilarImages() {
    const checkedIds = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => parseInt(checkbox.id));

    if (checkedIds.length === 0) {
        alert("Please select at least one class.");
        return;
    }

    console.log(checkedIds);

    try {
        const response = await fetch(`${SERVER_URL}/fetch_similar_images`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(checkedIds) // Send selected IDs as JSON
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        displaySimilarImages(data.similar_images);
    } catch (error) {
        console.error('Error fetching similar images:', error);
        // Handle error gracefully, show user-friendly message or retry logic
    }
}

function displaySimilarImages(images) {
    const similarImagesDiv = document.getElementById("similarImages");
    similarImagesDiv.innerHTML = '';
    Object.keys(images).forEach(id => {
        const image = images[id];
        const div = document.createElement('div');
        div.className = 'image-item';
        div.innerHTML = `
            <img src="${SERVER_URL}${image.image_file_name}" alt="${image.prompt}" width="150">
            <p>Cosine Similarity Score: ${image.distance.toFixed(2)}</p>
            <p>(ML Generated Description): ${image.prompt}</p>
            <input type="radio" name="selectedImage" value="${id}">
        `;
        similarImagesDiv.appendChild(div);
    });

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.style.display = 'block';

    const askMeContainer = document.getElementById("askMeContainer");
    askMeContainer.style.display = 'block';
}

function triggerFileInput() {
    const fileInput = document.getElementById('uploadFileInput');
    fileInput.click();
}

async function submitSelectedImage(event) {
    const selectedImage = document.querySelector('input[name="selectedImage"]:checked');
    if (!selectedImage) {
        alert("Please select an image.");
        return;
    }

    const fileInput = event.target;
    if (!fileInput.files.length) {
        alert("Please upload an image file.");
        return;
    }

    const imageId = parseInt(selectedImage.value);
    const uploadedFile = fileInput.files[0];

    const formData = new FormData();
    formData.append('selected_image_id', imageId);
    formData.append('file', uploadedFile);

    console.log("FormData:", ...formData.entries());

    // Show processing bar
    const processingBar = document.getElementById("processingBar");
    processingBar.style.display = 'block';

    try {
        const response = await fetch(`${SERVER_URL}/imerse_image`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            if (data.image_details !== null){
                displayProcessedImage(data.image_details);
            }            
            else {
                alert("The class of dress you selected is not detected in your image, so failed to create the mask.")
            }
        } else {
            alert("Failed to process the image.");
        }
    } catch (error) {
        console.error('Error submitting selected image:', error);
        alert("An error occurred while processing the image.");
    } finally {
        // Hide processing bar
        processingBar.style.display = 'none';
    }
}

function displayProcessedImage(imageSrc) {
    const processedImageContainer = document.getElementById("processedImageContainer");
    const processedImageElement = document.getElementById("processedImage");

    // Append a unique query parameter to force refresh
    const uniqueImageSrc = `${SERVER_URL}${imageSrc}?t=${new Date().getTime()}`;

    processedImageElement.src = uniqueImageSrc;
    processedImageContainer.style.display = 'block';
}

async function askMe() {
    const selectedImage = document.querySelector('input[name="selectedImage"]:checked');
    if (!selectedImage) {
        alert("Please select an image.");
        return;
    }

    const questionText = document.getElementById("askMeInput").value;
    if (!questionText) {
        alert("Please enter a question.");
        return;
    }

    const imageId = parseInt(selectedImage.value);
    const requestData = {
        selected_image_id: imageId,
        text: questionText
    };

    console.log(requestData)

    try {
        const response = await fetch(`${SERVER_URL}/ask_me`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (response.ok) {
            const data = await response.json();
            displayAskMeResponse(data.answer);
        } else {
            alert("Failed to get a response.");
        }
    } catch (error) {
        console.error('Error asking question:', error);
        alert("An error occurred while asking the question.");
    }
}

function displayAskMeResponse(responseText) {
    const askMeResponseDiv = document.getElementById("askMeResponse");
    askMeResponseDiv.textContent = responseText;
}

// Voice recording functionality
let mediaRecorder;
let audioChunks = [];

async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    audioChunks = [];

    mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        sendAudioFile(audioBlob);
    });

    document.getElementById("recordBtn").style.display = "none";
    document.getElementById("stopBtn").style.display = "block";
}

function stopRecording() {
    mediaRecorder.stop();
    document.getElementById("recordBtn").style.display = "block";
    document.getElementById("stopBtn").style.display = "none";
}

async function sendAudioFile(audioBlob) {
    const selectedImage = document.querySelector('input[name="selectedImage"]:checked');
    if (!selectedImage) {
        alert("Please select an image.");
        return;
    }

    const imageId = parseInt(selectedImage.value);

    const formData = new FormData();
    formData.append('file', audioBlob, 'recorded_audio.wav');
    formData.append('selected_image_id', imageId);

    try {
        const response = await fetch(`${SERVER_URL}/ask_me_voice/`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const audioBlob = await response.blob();
            playAudioResponse(audioBlob);
        } else {
            alert("Failed to process the audio.");
        }
    } catch (error) {
        console.error('Error sending audio file:', error);
        alert("An error occurred while sending the audio.");
    }
}

function playAudioResponse(audioBlob) {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
}

