import os
from PIL import Image
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Request, Body
import requests
import shutil

from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse
from ultralytics import YOLO
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from typing import List  # Import List from typing module
import timm
import torch
from sklearn.preprocessing import normalize
from sklearn.metrics.pairwise import euclidean_distances, cosine_similarity
from timm.data import resolve_data_config
from timm.data.transforms_factory import create_transform
import json
from openai import OpenAI  # OpenAI Python library to make API calls
import yaml


app = FastAPI()

# Allow CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production to specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# fixed for the system
base_path = "."
configuration_file = "./config.yaml"
UPLOAD_DIRECTORY = "uploads"
EMBEDD_IMG_DIRECTORY = "embedding_images"

def load_configuration(config_path=configuration_file):
    try:
        # Load default configuration
        with open(config_path, 'r') as default_file:
            configuration = yaml.safe_load(default_file)
        return configuration
    except FileNotFoundError as e:
        print(f"ERROR: Fail to load configuration from:{config_path}. error:{e}. Make sure the file paths are correct.")
        return None
    except yaml.YAMLError as e:
        print(f"ERROR loading YAML file:{config_path}. error:{e}")
        return None


def load_parameter(param,config_dict):
    if param in config_dict.keys():
        print(f"{param} loaded")
        return config_dict[param]
    else:
        print(f"ERROR: fail to load param:{param}")

# load the configuration
config = load_configuration()
if not config:
    print(f"ERROR: failed to load configuration from file:{configuration_file}")
else:
    print(f"SUCCESS: loaded configuration from file:{configuration_file}")

# load the configurtion parameter
openai_api_key = load_parameter("openai_api_key",config)
number_of_similar_images = load_parameter("number_of_similar_images",config)
custom_params = load_parameter("custom_params",config)

yolo_model_file = f"{base_path}/best.pt"
embeddings_file = f"{base_path}/embedding.json"
common_qna_file = f"{base_path}/qna/common.txt"
qna_directory = f"{base_path}/qna"
prompt_file = f"{base_path}/prompt.json"

# Serve the uploads directory
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIRECTORY), name="uploads")
app.mount("/embedding_images", StaticFiles(directory=EMBEDD_IMG_DIRECTORY), name="embedding_images")

# In-memory storage for metadata
storage = {
    "cropped_images": {}, ## cropped_images[idx] = {"class_name":class_name,"score":score, "cropped_image_path":cropped_image_path}
    "similar_images": {}, ## similar_images[ids]  = {"image_file_name":image_file_name,"distance":distance, "prompt" :prompt, "masked_image_path": masked_image_path}
}

# Ensure the uploads directory exists
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

labels = ["sunglass","hat","jacket","shirt","pants","shorts","skirt","dress","bag", "shoe"]

def populate_label_dict():
    label_dict = {}

    for item in labels:
        label_dict[item] = 0

    return label_dict


## embeddings = [{"vector":[512 normalized values],"image_file_name":<image_file_name>, "prompt":<detail description of the image>},...]
def get_similar_images(embeddings,input_images,prompts,number_of_similar_images):
    
    print(f"        ===> get_similar_images(embeddings, input_images, prompts, {number_of_similar_images})")

    similar_images = {}
    idx = 0
    for img in input_images:
        # Extract embedding for the input file
        input_embedding = extractor(img[0])
        print(f"======== similar image for image:{img[0]} ==========")
        sm = similar_matches(input_embedding,embeddings,number_of_similar_images)
        for item in sm:
            similar_images[idx] = {
                                    "image_file_name": f"/{os.path.join(EMBEDD_IMG_DIRECTORY, item['image_file_name'])}",
                                    "distance": item['distance'],
                                    "prompt": prompts[item['image_file_name']],
                                    "class_name": img[1],
                                    }
            print(f"class_name={img[1]}, file={item['image_file_name']}, cos dis={item['distance']}, prompt={prompts[item['image_file_name']]}")
            idx += 1
    print("============================================================================")
    return similar_images


def similar_matches(input_embedding, embeddings, number_of_suggestions):

    print(f"    ===> similar_matches(input_embedding, embeddings, {number_of_suggestions})")

    # Extract vectors from embeddings
    embed_list = [e['vector'] for e in embeddings]

    # Calculate cosine similarities
    distances = cosine_similarity([input_embedding], embed_list)[0]

    # Get the indices of the N smallest distances (N best scores)
    best_indices = np.argsort(distances)[::-1][:number_of_suggestions]  # Sort in descending order and take top N

    # Create a list of dictionaries with the best matches
    best_matches = [
        {
            "image_file_name": embeddings[i]['image_file_name'],
            "distance": distances[i],
        }
        for i in best_indices
    ]
    return best_matches


class FeatureExtractor:
    def __init__(self, modelname):
        # Load the pre-trained model
        self.model = timm.create_model(
            modelname, pretrained=True, num_classes=0, global_pool="avg"
        )
        self.model.eval()

        # Get the input size required by the model
        self.input_size = self.model.default_cfg["input_size"]

        config = resolve_data_config({}, model=modelname)
        # Get the preprocessing function provided by TIMM for the model
        self.preprocess = create_transform(**config)

    def __call__(self, imagepath):
        # Preprocess the input image
        input_image = Image.open(imagepath).convert("RGB")  # Convert to RGB if needed
        input_image = self.preprocess(input_image)

        # Convert the image to a PyTorch tensor and add a batch dimension
        input_tensor = input_image.unsqueeze(0)

        # Perform inference
        with torch.no_grad():
            output = self.model(input_tensor)

        # Extract the feature vector
        feature_vector = output.squeeze().numpy()

        return normalize(feature_vector.reshape(1, -1), norm="l2").flatten()


## embeddings = [{"image_file_name":<image_file_name>, "prompt":<detail description of the image>},...]
def load_prompts(prompt_file):
    prompts = {}
    try:
        with open(prompt_file, 'r') as f:
            # Check if the file is empty
            if os.stat(prompt_file).st_size == 0:
                print(f"Warning: File '{embeddings_file}' is empty. loading empty prompts")
                return {}, []
            prompts_list = json.load(f)

            for pmt in prompts_list:
                image_file_name = pmt['image_file_name']
                prompt = pmt['prompt']
                prompts[image_file_name] = prompt

        return prompts, prompts_list

    except FileNotFoundError:
        print(f"Error: File '{prompt_file}' not found. loading empty prompts")
        return {}, []
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON in '{prompt_file}': {e}")
        return None, None
    except Exception as e:
        print(f"An error occurred while loading prompts from '{prompt_file}': {e}")
        return None, None


## embeddings = [{"vector":[512 normalized values],"image_file_name":<image_file_name>, "prompt":<detail description of the image>},...]
def load_embeddings(embeddings_file):
    try:
        with open(embeddings_file, 'r') as f:
            # Check if the file is empty
            if os.stat(embeddings_file).st_size == 0:
                print(f"Warning: File '{embeddings_file}' is empty. loading empty embedds")
                return []
            embeddings = json.load(f)
        print("embedding loaded")
        return embeddings
    except FileNotFoundError:
        print(f"Error: File '{embeddings_file}' not found. loading empty embedds")
        return []
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON in '{embeddings_file}': {e}")
        return None
    except Exception as e:
        print(f"An error occurred while loading embeddings from '{embeddings_file}': {e}")
        return None


def convert_to_high_quality_png(input_image_path, output_image_path, target_size=(1024, 1024), max_file_size=4 * 1024 * 1024):

    print(f"    ===> convert_to_high_quality_png({input_image_path},{output_image_path},{target_size},{max_file_size/(1024*1024)} Mb)")
    # Open the input image
    image = Image.open(input_image_path).convert("RGBA")
    
    # Resize the image while maintaining aspect ratio
    image.thumbnail(target_size, Image.LANCZOS)
    
    # Create a new image with a white background and paste the resized image onto it
    background = Image.new('RGBA', target_size, (255, 255, 255, 0))
    image_width, image_height = image.size
    offset = ((target_size[0] - image_width) // 2, (target_size[1] - image_height) // 2)
    background.paste(image, offset)
    
    # Save the image with maximum compression quality
    background.save(output_image_path, format='PNG', optimize=True)

    # Check the file size
    file_size = os.path.getsize(output_image_path)
    
    # If the file size is larger than the maximum allowed, reduce the quality further
    while file_size > max_file_size:
        quality -= 5
        if quality <= 0:
            raise ValueError("Cannot reduce image size below 4 MB")
        background.save(output_image_path, format='PNG', optimize=True)
        file_size = os.path.getsize(output_image_path)
    
    return output_image_path


# Function to crop and save detected objects and create an annotated image
def generate_crop_mask_files(image_path, output_dir):

    print(f"    ===> generate_crop_mask_files({image_path},{output_dir})")

    cropped_images = {}
    masked_images = {}

    # Load image
    original_image = Image.open(image_path).convert("RGB")
    image_np = np.array(original_image)

    # Perform inference
    results = detection_model(image_np)
    results = results[0]  # YOLO returns a list of results, we take the first one

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Create a drawing context
    annotated_image = original_image.copy()
    draw = ImageDraw.Draw(annotated_image)
    font = ImageFont.load_default()  # Load a default font

    # Extract the original file name and extension
    base_name = os.path.basename(image_path)
    file_name, file_extension = os.path.splitext(base_name)

    # Iterate through detected objects and generate the cropped image file
    for idx, box in enumerate(results.boxes):
        # Get bounding box coordinates
        xmin, ymin, xmax, ymax = map(int, box.xyxy[0])
        class_idx = int(box.cls[0])
        class_name = detection_model.names[class_idx]  # Get the class name
        score = box.conf[0].item()  # Get the confidence score

        # Crop the image using bounding box from the original image
        cropped_image = original_image.crop((xmin, ymin, xmax, ymax))

        # Save the cropped image without modifications
        cropped_image_path = os.path.join(output_dir, f"{file_name}_crop_{class_name}_{idx}{file_extension}")
        cropped_image.save(cropped_image_path, format="PNG")

        ## convert the cropped image to 150 x 150 because the embedding image is also 150 x 150
        convert_to_high_quality_png(cropped_image_path, cropped_image_path,target_size=(150, 150), max_file_size=4 * 1024 * 1024)

        cropped_images[idx] = {"class_name":class_name,"score":score, "cropped_image_path":cropped_image_path}

        # Draw the bounding box on the annotated image
        draw.rectangle([xmin, ymin, xmax, ymax], outline="green", width=2)
        text = f"{class_name} {score:.2f}"
        draw.text((xmin, ymin - 10), text, fill="blue", font=font)

        print(f"Cropped object saved at: {cropped_image_path}")

    # Save the annotated image
    annotated_image_path = os.path.join(output_dir, f"{file_name}_an{file_extension}")
    annotated_image.save(annotated_image_path)
    print(f"Annotated image saved at: {annotated_image_path}")

    # Iterate through detected objects and generate the masks files
    for idx, box in enumerate(results.boxes):
        # Get bounding box coordinates
        xmin, ymin, xmax, ymax = map(int, box.xyxy[0])

        # Adjust coordinates to fit within image bounds
        xmin = max(0, xmin)
        ymin = max(0, ymin)
        xmax = min(original_image.width, xmax)
        ymax = min(original_image.height, ymax)

        # Create a blank mask image for the current object
        mask = Image.new("RGBA", original_image.size, (0, 0, 0, 255))  # Opaque black mask

        # Draw a filled polygon as the mask for the detected object
        draw = ImageDraw.Draw(mask)
        points = [(xmin, ymin), (xmax, ymin), (xmax, ymax), (xmin, ymax)]
        draw.polygon(points, fill=(0, 0, 0, 0))  # Transparent fill inside polygon

        # Save the mask with a unique filename based on class and index
        class_idx = int(box.cls[0])
        class_name = detection_model.names[class_idx]
        score = box.conf[0].item()  # Get the confidence score

        mask_name = f"{file_name}_mask_{class_name}_{idx}{file_extension}"
        masked_image_path = os.path.join(output_dir, mask_name)

        masked_images[idx] = {"class_name":class_name,"score":score, "masked_image_path":masked_image_path}

        mask.save(masked_image_path)

        print(f"Mask saved at: {masked_image_path}")

    return cropped_images, masked_images


# Function to check and read the Q&A text file
def read_common_qna_file(common_qna_file):

    print(f"Fetching Common Q&A from file: {common_qna_file}")

    if os.path.exists(common_qna_file):
        with open(common_qna_file, 'r') as file:
            return file.read().strip(), common_qna_file
    else:
        return None, None

# Function to check and read the Q&A text file
def read_qna_file(image_file_name):

    qna_file_path = f"{qna_directory}/{image_file_name.split('.')[0]}.txt"

    print(f"Fetching Q&A from file: {qna_file_path}")

    if os.path.exists(qna_file_path):
        with open(qna_file_path, 'r') as file:
            return file.read().strip(), qna_file_path
    else:
        return None, None


def get_information_openai(client,messages,custom_params):

    print("Calling get_information_openai with messages:", messages)

    try:
        response = client.chat.completions.create(**custom_params, messages=messages)
        response_content = response.choices[0].message.content
        print("ChatGPT returned successfully:", response_content)
        return response_content, None

    except Exception as e:
        print(f"ChatGPT returned unsuccessfully: {e}")
        return None, f"{e}"


def validate_embeddings_prompts_matching(embeddings,prompts_list):
    prompts_keys = [e['image_file_name'] for e in prompts_list]
    embeddings_keys = [e['image_file_name'] for e in embeddings]
    return prompts_keys == embeddings_keys


detection_model = YOLO(yolo_model_file)
embeddings = load_embeddings(embeddings_file)
prompts, prompts_list = load_prompts(prompt_file)
# Extractor, for RT feature extraction of input corpped image(s)

# check if the prompt is present for all the embedded files
rt = validate_embeddings_prompts_matching(embeddings,prompts_list)
if not rt:
    print("Error: embeddings and prompts don't 1:1 ERROR !!!")
else:
    print("SUCCESS: embedding file names map to prompt map files")

extractor = FeatureExtractor("resnet50")

client = OpenAI(api_key=openai_api_key)


@app.post("/detect_classes")
async def detect_classes(file: UploadFile = File(...)):

    global storage

    print(f"===> detect_classes({file.filename})")

    classes_with_ids = {}

    # client/server path
    input_file_path = os.path.join(UPLOAD_DIRECTORY, file.filename)
    input_file_path_sqr = os.path.join(UPLOAD_DIRECTORY, f"{file.filename}_sqr.png")

    # Save the uploaded file
    with open(input_file_path, "wb") as buffer:
        buffer.write(await file.read())

    # convert the input file to png image of 1024 x 1024 (required for Dall-e for editing)
    convert_to_high_quality_png(input_file_path, input_file_path_sqr)

    # this function will call the yolo model and crop the detected images
    cropped_images_temp, _  = generate_crop_mask_files(input_file_path_sqr, UPLOAD_DIRECTORY)

    # clear and copy to global storage every time this API is called
    storage = {"cropped_images": {},"similar_images": {}}
    storage["cropped_images"].update(cropped_images_temp)

    # for handling detection of multiple same class
    labels_dict = populate_label_dict()

    for idx in storage["cropped_images"]:
        class_name = storage["cropped_images"][idx]["class_name"]
        score = storage["cropped_images"][idx]["score"]
        if labels_dict[class_name]:
            display_class_name = f"{class_name}_{labels_dict[class_name]} ({round(score,4)})"
        else:
            display_class_name = f"{class_name} ({round(score,4)})"

        classes_with_ids[display_class_name] = idx
        labels_dict[class_name] +=1

    print(f"<=== detect_classes({f"/uploads/{file.filename}_sqr_an.png"},{classes_with_ids})")

    return JSONResponse(content={"image": f"/uploads/{file.filename}_sqr_an.png", "classes": classes_with_ids})


@app.post("/fetch_similar_images")
async def fetch_similar_images(selected_ids: List[int]):

    global storage
    global prompts


    print(f"===> fetch_similar_images({selected_ids})")

    input_images = []
    input_classes = []
    for _id in selected_ids:
        input_images.append((storage["cropped_images"][_id]["cropped_image_path"],storage["cropped_images"][_id]["class_name"]))
        input_classes.append(storage["cropped_images"][_id]["class_name"])

    input_classes_str = ",".join(input_classes)
    print(f"++++ fetch_similar_images for classes:{input_classes_str}")

    similar_images_temp = get_similar_images(embeddings,input_images,prompts,number_of_similar_images)

    # clear and refresh the global storage every time this API is called    
    storage["similar_images"] =  {}
    storage["similar_images"].update(similar_images_temp)

    return JSONResponse(content={"similar_images": storage["similar_images"]})


@app.post("/imerse_image")
# async def imerse_image(selected_image_ids: List[int]):
async def imerse_image(selected_image_id: int = Form(...), file: UploadFile = File(...)):

    global storage

    print(f"===> imerse_image({selected_image_id,file.filename})")

    # full input file path
    input_file_path = os.path.join(UPLOAD_DIRECTORY, file.filename)
    input_file_path_sqr = os.path.join(UPLOAD_DIRECTORY, f"{file.filename}_sqr.png")

    # Save the uploaded file
    with open(input_file_path, "wb") as buffer:
        buffer.write(await file.read())

    # convert the input file to png image of 1024 x 1024 (required for Dall-e for editing)
    convert_to_high_quality_png(input_file_path, input_file_path_sqr)

    # this function will call the yolo model and crop the detected images
    _, masked_images_temp  = generate_crop_mask_files(input_file_path_sqr, UPLOAD_DIRECTORY)

    original_class = storage["similar_images"][selected_image_id]["class_name"]
    selected_image = storage["similar_images"][selected_image_id]["image_file_name"]

    print(f"get the prompt for this image:{base_path}/{selected_image}")

    input_masked_image_path = None

    your_classes = list(set(image_info["class_name"] for image_info in masked_images_temp.values()))

    for key in masked_images_temp.keys():
        if masked_images_temp[key]["class_name"] == original_class:
            input_masked_image_path = masked_images_temp[key]["masked_image_path"]
            break

    print(f"classes detected in the try out image:{your_classes}")

    try:
        if input_masked_image_path is None:
            print("The class of dress you selected is not yoloed in your image over which you are trying the dress.")
            return JSONResponse(content={"image_details": None})
           
        input_image = f"{base_path}/{input_file_path_sqr}"
        masked_image_path = f"{base_path}/{input_masked_image_path}"
        prompt = storage["similar_images"][selected_image_id]["prompt"]

        print(input_image)
        print(masked_image_path)
        print(prompt)

        # Call the OpenAI API
        edit_response = client.images.edit(
            image=open(input_image, "rb"),  # Adjust the path if needed
            mask=open(masked_image_path, "rb"),  # Adjust the path if needed
            prompt=prompt,  
            n=1,
            size="1024x1024",
            response_format="url",
        )

        url = edit_response.data[0].url

        imerse_image_file = f"{input_image}_imerse.png"

        # Download the image from the URL
        response = requests.get(url, stream=True)
        if response.status_code == 200:
            with open(imerse_image_file, "wb") as buffer:
                response.raw.decode_content = True
                shutil.copyfileobj(response.raw, buffer)

            return JSONResponse(content={"image_details": f"{imerse_image_file[1:]}"})
        else:
            raise HTTPException(status_code=500, detail="Failed to download the image from URL")

    except Exception as e:
        print(f"error: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred while calling image editing API: {e}")


@app.post("/ask_me", response_model=dict)
async def ask_me(selected_image_id: int = Body(...), text: str = Body(...)):

    if selected_image_id not in storage["similar_images"]:
        raise HTTPException(status_code=404, detail="Image not found.")

    image_file_path = storage["similar_images"][selected_image_id]["image_file_name"]
    prompt = storage["similar_images"][selected_image_id]["prompt"]

    # Extract just the file name from the file path
    image_file_name = os.path.basename(image_file_path)

    # Read the Q&A file associated with the image
    common_qna_text, common_file = read_common_qna_file(common_qna_file)
    qna_text, qna_file = read_qna_file(image_file_name)

    print(f"Retrieving review question: {text}")
    print(f"Retrieving review question for prompt: {prompt}")
    print(f"From general question from common QnA file: {common_file}")
    print(f"From specific question for file from: {qna_file}")

    if common_qna_text or qna_text:
        messages = [
            {"role": "user", "content": f"The production description of this fashion item is: {prompt}"},
            {"role": "user", "content": f"Here are some previous questions and answers for this product: {common_qna_text}\n{qna_text}"},
            {"role": "user", "content": f"Based on the product description and previous Q&A, could you briefly answer the following question: {text}"},
        ]

        answer, error_msg = get_information_openai(client, messages,custom_params)

        if error_msg:
            print(f"Chat GPT returned error: {error_msg}")
            answer = "System failed to get an answer."
    else:
        answer = "No information available."

    # Return JSONResponse with the answer
    return {"answer": answer}
