/* let coinBalance = 0;

function uploadPicture(challengeId) {
    const fileInput = document.getElementById(`${challengeId}FileInput`);
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const uploadsDiv = document.getElementById(`${challengeId}Uploads`);
            const uploadDiv = document.createElement('div');
            uploadDiv.className = 'upload';
            uploadDiv.innerHTML = `
                <img src="${e.target.result}" alt="Upload" style="max-width: 100%; margin-top: 10px;">
                <button onclick="likePicture(this)">Like</button>
                <span>0</span> likes
                <div class="comment-section">
                    <input type="text" placeholder="Add a comment" onkeydown="addComment(event, this)">
                </div>
            `;
            uploadsDiv.appendChild(uploadDiv);

            // Add coins for the upload
            coinBalance += 10;
            updateCoinBalance();
        };
        reader.readAsDataURL(fileInput.files[0]);
    }
}

function likePicture(button) {
    const likesSpan = button.nextElementSibling;
    let likes = parseInt(likesSpan.innerText);
    likes += 1;
    likesSpan.innerText = likes;

    // Add coins for the like
    coinBalance += 1;
    updateCoinBalance();
}

function updateCoinBalance() {
    document.getElementById('coinBalance').innerText = coinBalance;
}

function addComment(event, input) {
    if (event.key === 'Enter' && input.value.trim() !== '') {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment';
        commentDiv.innerText = input.value;
        input.parentElement.appendChild(commentDiv);
        input.value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateCoinBalance();
}); */




let coinBalance = 0;

function uploadPicture(challengeId) {
    const fileInput = document.getElementById(`${challengeId}FileInput`);
    const uploadsDiv = document.getElementById(`${challengeId}Uploads`);
    const uploadDiv = document.createElement('div');
    uploadDiv.className = 'upload';

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            uploadDiv.innerHTML = `
                <img src="${e.target.result}" alt="Upload" style="max-width: 100%; margin-top: 10px;">
                <button onclick="likePicture(this)">Like</button>
                <span>0</span> likes
                <div class="comment-section">
                    <input type="text" placeholder="Add a comment" onkeydown="addComment(event, this)">
                </div>
            `;
            uploadsDiv.appendChild(uploadDiv);
            coinBalance += 10;
            updateCoinBalance();
        };
        reader.readAsDataURL(fileInput.files[0]);
    }
}

function uploadLink(challengeId) {
    const linkInput = document.getElementById(`${challengeId}LinkInput`);
    const uploadsDiv = document.getElementById(`${challengeId}Uploads`);
    const uploadDiv = document.createElement('div');
    uploadDiv.className = 'upload';

    if (linkInput.value.trim() !== '') {
        uploadDiv.innerHTML = `
            <a href="${linkInput.value.trim()}" target="_blank">Open Link</a>
            <button onclick="likePicture(this)">Like</button>
            <span>0</span> likes
            <div class="comment-section">
                <input type="text" placeholder="Add a comment" onkeydown="addComment(event, this)">
            </div>
        `;
        uploadsDiv.appendChild(uploadDiv);
    }
}

function likePicture(button) {
    const likesSpan = button.nextElementSibling;
    let likes = parseInt(likesSpan.innerText);
    likes += 1;
    likesSpan.innerText = likes;

    coinBalance += 1;
    updateCoinBalance();
}

function updateCoinBalance() {
    document.getElementById('coinBalance').innerText = coinBalance;
}

function addComment(event, input) {
    if (event.key === 'Enter' && input.value.trim() !== '') {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment';
        commentDiv.innerText = input.value;
        input.parentElement.appendChild(commentDiv);
        input.value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateCoinBalance();
});



