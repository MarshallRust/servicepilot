import os
from pdf2image import convert_from_path

def pdf_to_image(filename, input_folder, output_folder):

    pdf_path = os.path.join(input_folder, filename)
    print(f"Processing: {filename}")
            
    try:
        pages = convert_from_path(pdf_path)
        base_name = os.path.splitext(filename)[0]

        for i, page in enumerate(pages):

            image_name = f"{base_name}_page{i + 1}.jpg"
            image_path = os.path.join(output_folder, image_name)
                    
            page.save(image_path, 'JPEG')
            print(f" Saved: {image_name}")
                    
    except Exception as e:
        print(f"Error processing {filename}: {e}")

