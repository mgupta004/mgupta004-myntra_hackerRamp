download and unzip app or clone the directroy from github
Unzip the embedding_images.zip
cd app

setup the python3 env
---------------------
python3 -m venv myntra_env
source ./myntra_env/bin/activate


install all required packages
-----------------------------
pip install -r ./requirement.txt


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

Additional information
-----------------------
The yolo8 trained model is best.pt

