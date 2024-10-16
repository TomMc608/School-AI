from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)

@app.route('/process', methods=['POST'])
def process_csv():
    try:
        logging.info("Received request for data processing.")
        data = request.get_json()
        selected_columns = request.args.getlist('selected_columns')
        use_scaler = request.args.get('use_scaler', 'false').lower() == 'true'

        if not data or not isinstance(data, list) or len(data) == 0:
            raise ValueError("Input data is empty or not properly formatted.")
        
        df = pd.DataFrame(data)
        if df.empty:
            raise ValueError("The uploaded CSV contains no data.")

        logging.info(f"Original dataframe shape: {df.shape}")
        logging.info(f"Selected columns: {selected_columns}")

        if selected_columns:
            df = df[selected_columns]
        
        logging.info(f"Dataframe shape after selecting columns: {df.shape}")

        error_logs = []

        # Data Cleaning & Preprocessing
        try:
            for col in df.select_dtypes(include=['object']).columns:
                df[col] = LabelEncoder().fit_transform(df[col].astype(str))
                logging.info(f"Column '{col}' encoded successfully.")
        except Exception as e:
            error_logs.append(f"Error processing categorical columns: {str(e)}")
            logging.error(f"Error processing categorical columns: {str(e)}")

        # Handle missing values
        try:
            for column in df.columns:
                if pd.api.types.is_numeric_dtype(df[column]):
                    df[column] = pd.to_numeric(df[column], errors='coerce')
                    df[column] = df[column].fillna(df[column].median())
                else:
                    df[column] = df[column].fillna(df[column].mode()[0])
        except Exception as e:
            error_logs.append(f"Error handling missing values: {str(e)}")
            logging.error(f"Error handling missing values: {str(e)}")

        # Normalize Data (Optional)
        try:
            if use_scaler:
                scaler = StandardScaler()
                df_normalized = pd.DataFrame(scaler.fit_transform(df), columns=df.columns)
                logging.info("Data normalized successfully.")
            else:
                df_normalized = df
                logging.info("Data normalization skipped.")
        except Exception as e:
            error_logs.append(f"Error during data normalization: {str(e)}")
            logging.error(f"Error during data normalization: {str(e)}")
            df_normalized = df

        # Correlation Analysis
        try:
            if len(df_normalized.columns) < 2:
                raise ValueError("Not enough columns selected for correlation analysis.")

            correlation_matrix = df_normalized.corr()
            
            # Calculate the average correlation
            # Exclude self-correlations and count each pair only once
            correlations = []
            for i in range(len(correlation_matrix.columns)):
                for j in range(i + 1, len(correlation_matrix.columns)):
                    corr_value = correlation_matrix.iloc[i, j]
                    if not pd.isna(corr_value):
                        correlations.append(abs(corr_value))  # Use absolute value
            
            avg_correlation = np.mean(correlations) if correlations else "N/A"
            logging.info(f"Average correlation: {avg_correlation}")
            logging.info(f"Correlation matrix:\n{correlation_matrix}")
            logging.info(f"Individual correlations: {correlations}")
        except Exception as e:
            error_logs.append(f"Error during correlation analysis: {str(e)}")
            logging.error(f"Error during correlation analysis: {str(e)}")
            avg_correlation = "N/A"

        response = {
            "status": "success",
            "average_correlation": float(avg_correlation) if avg_correlation != "N/A" else "N/A",
            "error_logs": error_logs
        }
        return jsonify(response)
    except Exception as e:
        logging.error(f"Unhandled error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 400

if __name__ == "__main__":
    app.run(debug=True)
