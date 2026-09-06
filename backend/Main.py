from pdf_to_image import pdf_to_image
# from extract_data_from_text import data_to_text
from run_pyesseract import run_pytesseract
import os

input_folder = "/Users/marshallrust/Project_Files/A folder of stuff I want to build for klint/Service Pilot v2/backend/pdfs"
output_folder = "/Users/marshallrust/Project_Files/A folder of stuff I want to build for klint/Service Pilot v2/backend/images"

def main():
    os.makedirs(output_folder, exist_ok=True)

    for filename in os.listdir(input_folder):
        if filename.lower().endswith('.pdf'):
            image = pdf_to_image(filename, input_folder, output_folder)
            text = run_pytesseract(image)
            # data_to_text()

    """
    TODO: 
    """

if __name__ =="__main__":
      main()