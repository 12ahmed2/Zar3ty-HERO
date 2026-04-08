from flask import Flask, request, jsonify
from flask_cors import CORS
from deep_translator import GoogleTranslator

app = Flask(__name__)
CORS(app)

@app.route('/translate', methods=['GET'])
def translate_text():
    text = request.args.get('text')
    if not text:
        return jsonify({"error": "text parameter is required"}), 400

    src = request.args.get('src', 'auto')
    dest = request.args.get('dest', 'en')

    translated = GoogleTranslator(
        source=src,
        target=dest
    ).translate(text)

    return jsonify({
        "translated_text": translated
    })

if __name__ == '__main__':
    app.run(port=5000, debug=True)
