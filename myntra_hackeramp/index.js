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
    displayTaggedImage(data.image);
    displayClassNames(data.classes);
}

function displayTaggedImage(imageSrc) {
    const imgElement = document.getElementById("taggedImage");
    imgElement.src = `${SERVER_URL}${imageSrc}`;
    imgElement.style.display = 'block';
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

