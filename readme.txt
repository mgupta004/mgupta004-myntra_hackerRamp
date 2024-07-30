download myntra_lens_AI_tryon or clone the directroy from github

setup the python3 env
---------------------
python3 -m venv myntra_env
source ./myntra_env/bin/activate


install all required packages
-----------------------------
pip install -r ./requirement.txt

other system files/lib
----------------------
for mac:
brew install ffmpeg
for unix:
sudo apt update
sudo apt install ffmpeg

Get aditional files
----------------------------------------
1. embedding_images directory

	1. cd app
	2. unzip embedding_images.zip into embedding_images directory containing similar files

2. YOLO8 trained model
	1. download best.pt.zip from https://github.com/mgupta004/mgupta004-myntra_hackerRamp_yolo8.git
	2. unzip the file to get yolo8 model file best.pt
	3. place this file in myntra_lens_AI_tryon directory


run the server fastAPI server
-----------------------------
uvicorn server:app --reload --port 8000

launch the front end html in browser
------------------------------------
right click and open the index.html in any browser


Configuration of the system
---------------------------

0. Create an openai API token

1. open ./config.yaml file and update the "openai_api_key" with your openai API key



