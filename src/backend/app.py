from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.preprocessing import OneHotEncoder, LabelEncoder
from sklearn.feature_selection import mutual_info_classif
from sklearn.cluster import KMeans, DBSCAN
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer

app = Flask(__name__)
CORS(app)

@app.route('/process', methods=['POST'])
def process_csv():
    try:
        # Get the JSON data from the request
        data = request.get_json()

        # Convert the JSON data to a Pandas DataFrame
        df = pd.DataFrame(data)

        # Step 1: Data Cleaning
        # Handle missing values by filling with median for numerical or mode for categorical
        for column in df.columns:
            if df[column].dtype == np.number:
                df[column].fillna(df[column].median(), inplace=True)
            else:
                df[column].fillna(df[column].mode()[0], inplace=True)

        # Identify column types
        numeric_features = df.select_dtypes(include=['number']).columns.tolist()
        categorical_features = df.select_dtypes(include=['object']).columns.tolist()

        # Step 2: Encoding Categorical Features
        one_hot_encoder = OneHotEncoder(sparse=False, drop='first')
        label_encoder = LabelEncoder()

        # Apply One-Hot Encoding to unordered categorical columns
        for column in categorical_features:
            if df[column].nunique() < 10:  # Assuming columns with < 10 unique values are unordered
                one_hot_encoded = pd.DataFrame(one_hot_encoder.fit_transform(df[[column]]),
                                               columns=one_hot_encoder.get_feature_names_out([column]))
                df = pd.concat([df, one_hot_encoded], axis=1).drop(column, axis=1)
            else:
                df[column] = label_encoder.fit_transform(df[column])

        # Step 3: Correlation Analysis
        correlation_threshold = 0.3
        correlations = df.corr().stack().reset_index()
        correlations.columns = ['Feature 1', 'Feature 2', 'Correlation']
        significant_correlations = correlations[(abs(correlations['Correlation']) > correlation_threshold) &
                                                (correlations['Feature 1'] != correlations['Feature 2'])]

        # Step 4: Clustering
        # Using K-Means clustering for simplicity, automatically determine number of clusters
        kmeans = KMeans(n_clusters=3)  # Assuming 3 clusters for demonstration
        df['Cluster'] = kmeans.fit_predict(df[numeric_features])

        # Step 5: Predictions
        # Identify potential target columns
        potential_targets = [col for col in df.columns if df[col].nunique() == 2 or df[col].nunique() < 10]
        prediction_results = {}

        for target in potential_targets:
            X = df.drop(columns=[target])
            y = df[target]

            # Split the data
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

            # Use RandomForestClassifier for predictions
            model = RandomForestClassifier()
            model.fit(X_train, y_train)
            predictions = model.predict(X_test)
            accuracy = accuracy_score(y_test, predictions)

            prediction_results[target] = {
                'accuracy': accuracy
            }

        # Prepare the response
        response = {
            "status": "success",
            "significant_correlations": significant_correlations.to_dict(orient='records'),
            "clustering": df['Cluster'].value_counts().to_dict(),
            "prediction_results": prediction_results
        }

        # Send back the processed data as a response
        return jsonify(response)

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400

if __name__ == "__main__":
    app.run(debug=True)