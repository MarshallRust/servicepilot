from pytesseract import pytesseract


custom_config = (
            f'--oem 3 --psm {6} '
            f'-c preserve_interword_spaces=1 '
            f'-c tessedit_char_whitelist={'0123456789$.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'}'
            f'-c tessedit_do_invert=0 '
            f'-c textord_heavy_nr=0 '
            f'-c textord_min_linesize=1 '
            f'-c textord_max_noise_size=5 '
            f'-c textord_noise_rejwords=0 '
            f'-c textord_noise_rejrows=0'
            )

def run_pytesseract(image):
    image = image
    passcustom_config = custom_config()
    return pytesseract.image_to_data(image, lang='eng', config=custom_config, output_type=pytesseract.Output.DICT)
