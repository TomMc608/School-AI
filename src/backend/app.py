from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.preprocessing import OneHotEncoder, LabelEncoder, MultiLabelBinarizer
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import datetime

app = Flask(__name__)
CORS(app)

@app.route('/process', methods=['POST'])
def process_csv():
    try:
        # Get the JSON data from the request
        data = request.get_json()

        # Validate input data
        if not data or not isinstance(data, list) or len(data) == 0:
            raise ValueError("Input data is empty or not properly formatted.")

        # Convert the JSON data to a Pandas DataFrame
        df = pd.DataFrame(data)

        if df.empty:
            raise ValueError("The uploaded CSV contains no data.")

        # ================================
        # Step 1: Data Cleaning & Preprocessing
        # ================================

        # 1. Process 'NSN' column to extract 'StudentID'
        if 'NSN' in df.columns:
            df['StudentID'] = df['NSN'].str.replace('^NSN', '', regex=True).astype(int)
            df.drop(columns=['NSN'], inplace=True)

        # 2. Convert 'Gender' to numerical values
        if 'Gender' in df.columns:
            gender_map = {'Male': 0, 'Female': 1, 'Nonbinary': 2}
            df['Gender'] = df['Gender'].map(gender_map)

        # 3. Convert 'Ethnicity' to numerical values
        if 'Ethnicity' in df.columns:
            df['Ethnicity'] = df['Ethnicity'].astype('category').cat.codes

        # 4. Convert 'Date of Birth' to 'Age'
        if 'Date of Birth' in df.columns:
            df['Date of Birth'] = pd.to_datetime(df['Date of Birth'], dayfirst=True, errors='coerce')
            current_date = pd.to_datetime('today')
            df['Age'] = (current_date - df['Date of Birth']).astype('<m8[Y]').astype(int)
            df.drop(columns=['Date of Birth'], inplace=True)

        # 5. Process 'Year Level' to remove 'Year' at the start
        if 'Year Level' in df.columns:
            df['Year Level'] = df['Year Level'].str.replace('Year', '').astype(int)

        # 6. Convert 'Contributing Primary School' to numerical values
        if 'Contributing Primary School' in df.columns:
            le_school = LabelEncoder()
            df['Contributing Primary School'] = le_school.fit_transform(df['Contributing Primary School'].astype(str))

        # 7. Process 'Extra-curricular Activities'
        if 'Extra-curricular Activities' in df.columns:
            # Convert string representation of list to actual list
            df['Extra-curricular Activities'] = df['Extra-curricular Activities'].apply(lambda x: eval(x) if pd.notnull(x) else [])
            mlb = MultiLabelBinarizer()
            df_activities = pd.DataFrame(mlb.fit_transform(df['Extra-curricular Activities']), columns=mlb.classes_)
            df = pd.concat([df, df_activities], axis=1)
            df.drop(columns=['Extra-curricular Activities'], inplace=True)

        # 8. Process 'NCEA Results'
        if 'NCEA Results' in df.columns:
            # Convert string representation of list of dicts to actual list
            df['NCEA Results'] = df['NCEA Results'].apply(lambda x: eval(x) if pd.notnull(x) else [])
            # Function to extract total credits and credits per subject
            def process_ncea_results(ncea_list):
                total_credits = 0
                credits_by_subject = {}
                for result in ncea_list:
                    credits = result.get('Credits', 0)
                    subject = result.get('Subject', 'Unknown')
                    total_credits += credits
                    credits_by_subject[subject] = credits_by_subject.get(subject, 0) + credits
                data = {'Total Credits': total_credits}
                # Include credits per subject
                for subject, credits in credits_by_subject.items():
                    data[f'Credits_{subject}'] = credits
                return pd.Series(data)
            df_ncea = df['NCEA Results'].apply(process_ncea_results)
            df = pd.concat([df, df_ncea], axis=1)
            df.drop(columns=['NCEA Results'], inplace=True)

        # 9. Convert teacher names to numerical values
        teacher_columns = ['Year 11 Teacher', 'Year 12 Teacher', 'Year 13 Teacher', 'Form Teacher']
        for col in teacher_columns:
            if col in df.columns:
                df[col] = df[col].astype(str)
                df[col] = LabelEncoder().fit_transform(df[col])

        # 10. Calculate 'Leaving Date' from current date
        if 'Leaving Date' in df.columns:
            df['Leaving Date'] = pd.to_datetime(df['Leaving Date'], dayfirst=True, errors='coerce')
            df['Days Until Leaving'] = (df['Leaving Date'] - current_date).dt.days
            df.drop(columns=['Leaving Date'], inplace=True)

        # 11. Convert specified columns to numerical values
        columns_to_encode = ['Primary Language', 'First Language', 'Secondary Language',
                             'Term 1 Intervention', 'Term 2 Intervention', 'Term 3 Intervention', 'Term 4 Intervention',
                             'Major Life Event', 'Learning Difficulty', 'Pastoral Care_Incident',
                             'Pastoral Care_Action Taken', 'Pastoral Care_Follow-up', 'Pastoral Care']

        for col in columns_to_encode:
            if col in df.columns:
                df[col] = df[col].astype(str)
                df[col] = LabelEncoder().fit_transform(df[col])

        # Handle missing values by filling with median for numerical or mode for categorical
        for column in df.columns:
            if pd.api.types.is_numeric_dtype(df[column]):
                df[column].fillna(df[column].median(), inplace=True)
            else:
                df[column].fillna(df[column].mode()[0], inplace=True)

        # Identify column types
        numeric_features = df.select_dtypes(include=['number']).columns.tolist()
        categorical_features = df.select_dtypes(include=['object']).columns.tolist()

        # ================================
        # Step 2: Encoding Remaining Categorical Features
        # ================================
        one_hot_encoder = OneHotEncoder(sparse_output=False, drop='first')
        label_encoder = LabelEncoder()

        # Apply encoding to categorical columns
        for column in categorical_features:
            unique_values = df[column].nunique()
            if unique_values < 10:
                if df[column].isnull().all():
                    continue
                one_hot_encoded = pd.DataFrame(one_hot_encoder.fit_transform(df[[column]]),
                                               columns=one_hot_encoder.get_feature_names_out([column]))
                df = pd.concat([df, one_hot_encoded], axis=1).drop(column, axis=1)
            elif unique_values < 100:
                if df[column].isnull().all():
                    continue
                df[column] = label_encoder.fit_transform(df[column])
            else:
                df.drop(columns=[column], inplace=True)

        # ================================
        # Step 3: Correlation Analysis
        # ================================
        correlation_threshold = 0.3
        correlations = df.corr().stack().reset_index()
        correlations.columns = ['Feature 1', 'Feature 2', 'Correlation']
        significant_correlations = correlations[(abs(correlations['Correlation']) > correlation_threshold) &
                                                (correlations['Feature 1'] != correlations['Feature 2'])]

        # ================================
        # Step 4: Clustering
        # ================================
        if len(numeric_features) > 0:
            kmeans = KMeans(n_clusters=3, random_state=42)
            df['Cluster'] = kmeans.fit_predict(df[numeric_features])
        else:
            df['Cluster'] = []  # No clustering performed if no numeric features

        # ================================
        # Step 5: Predictions
        # ================================
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
            "clustering": df['Cluster'].value_counts().to_dict() if 'Cluster' in df else {},
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
