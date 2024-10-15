from flask import Flask, request, jsonify
from flask_cors import CORS  # Import CORS
import pandas as pd

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/process', methods=['POST'])
def process_csv():
    try:
        # Get the JSON data from the request
        data = request.get_json()

        # Convert the JSON data to a Pandas DataFrame
        df = pd.DataFrame(data)

        # Example: Perform basic processing - let's say we calculate summary statistics
        summary_stats = df.describe().to_dict()

        # Send back the processed data as a response
        return jsonify({
            "status": "success",
            "summary_statistics": summary_stats
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400

if __name__ == "__main__":
    app.run(debug=True)
