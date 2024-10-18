from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from scipy.stats import chi2_contingency
from itertools import combinations, product
import logging
import threading
import uuid
import time

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)

progress_store = {}
progress_store_lock = threading.Lock()

def interpret_cramers_v(v):
    if v < 0.1:
        return "Very weak"
    elif v < 0.3:
        return "Weak"
    elif v < 0.5:
        return "Moderate"
    elif v < 0.7:
        return "Strong"
    else:
        return "Very strong"

def interpret_model_accuracy(accuracy):
    if accuracy < 0.6:
        return "Poor"
    elif accuracy < 0.7:
        return "Fair"
    elif accuracy < 0.8:
        return "Good"
    elif accuracy < 0.9:
        return "Very good"
    else:
        return "Excellent"

@app.route('/process', methods=['POST'])
def process_csv():
    try:
        logging.info("Received request for data processing.")
        content = request.get_json()
        data = content.get('data')
        selected_columns = content.get('selected_columns')

        if not data or not isinstance(data, list) or len(data) == 0:
            raise ValueError("Input data is empty or not properly formatted.")

        if not selected_columns or not isinstance(selected_columns, list):
            raise ValueError("Selected columns are missing or not in the correct format.")

        logging.info(f"Received selected_columns: {selected_columns}")

        task_id = str(uuid.uuid4())
        progress_store[task_id] = {
            "progress": 0,
            "status": "processing",
            "steps_completed": [],
            "eta": None,
            "start_time": time.time()
        }

        thread = threading.Thread(target=process_data_task, args=(content, task_id))
        thread.start()

        return jsonify({"status": "processing", "task_id": task_id})
    except Exception as e:
        logging.error(f"Unhandled error: {str(e)}")
        return jsonify({"status": "error", "message": str(e), "steps_completed": []}), 400

def process_data_task(content, task_id):
    try:
        data = content.get('data')
        selected_columns = content.get('selected_columns')
        error_logs = []

        steps = [
            "Preprocessing Data",
            "Computing Average Cramér's V",
            "Logistic Regression Analysis",
            "Decision Tree Analysis",
            "Random Forest Analysis",
            "Chi-Square Tests",
            "Multi-Variable Analysis"
        ]
        total_steps = len(steps)
        progress_data = progress_store[task_id]
        start_time = progress_data["start_time"]

        # Initialize results
        average_cramers_v = None
        logistic_regression_results = []
        decision_tree_results = []
        random_forest_results = []
        chi_square_results = []
        multi_variable_results = []

        # Step 1: Preprocess Data
        update_progress(task_id, steps[0], 1, total_steps)
        df_selected = preprocess_dataframe(pd.DataFrame(data)[selected_columns], error_logs)
        update_eta(task_id, start_time, total_steps, 1)

        # Step 2: Compute Average Cramér's V
        update_progress(task_id, steps[1], 2, total_steps)
        average_cramers_v = compute_average_cramers_v(df_selected, error_logs)
        update_eta(task_id, start_time, total_steps, 2)

        # Step 3: Logistic Regression Analysis
        update_progress(task_id, steps[2], 3, total_steps)
        logistic_regression_results = logistic_regression_analysis(df_selected, error_logs)
        update_eta(task_id, start_time, total_steps, 3)

        # Step 4: Decision Tree Analysis
        update_progress(task_id, steps[3], 4, total_steps)
        decision_tree_results = decision_tree_analysis(df_selected, error_logs)
        update_eta(task_id, start_time, total_steps, 4)

        # Step 5: Random Forest Analysis
        update_progress(task_id, steps[4], 5, total_steps)
        random_forest_results = random_forest_analysis(df_selected, error_logs)
        update_eta(task_id, start_time, total_steps, 5)

        # Step 6: Chi-Square Tests
        update_progress(task_id, steps[5], 6, total_steps)
        chi_square_results = chi_square_tests(df_selected, error_logs)
        update_eta(task_id, start_time, total_steps, 6)

        # Step 7: Multi-Variable Analysis
        update_progress(task_id, steps[6], 7, total_steps)
        multi_variable_results = multi_variable_analysis(df_selected, error_logs)
        update_eta(task_id, start_time, total_steps, 7)

        # Store the final result
        with progress_store_lock:
            progress_store[task_id] = {
                "status": "success",
                "progress": 100,
                "steps_completed": steps,
                "eta": 0,
                "average_cramers_v": average_cramers_v,
                "logistic_regression_results": logistic_regression_results,
                "decision_tree_results": decision_tree_results,
                "random_forest_results": random_forest_results,
                "chi_square_results": chi_square_results,
                "multi_variable_results": multi_variable_results,
                "error_logs": error_logs
            }
    except Exception as e:
        logging.error(f"Error in processing data task: {str(e)}")
        with progress_store_lock:
            progress_store[task_id] = {
                "status": "error",
                "message": str(e),
                "steps_completed": progress_store[task_id].get("steps_completed", []),
                "error_logs": error_logs
            }

def update_progress(task_id, step_name, current_step, total_steps):
    progress = (current_step / total_steps) * 100
    with progress_store_lock:
        steps_completed = progress_store[task_id].get("steps_completed", [])
        steps_completed.append(step_name)
        progress_store[task_id]["progress"] = progress
        progress_store[task_id]["steps_completed"] = steps_completed
    logging.info(f"Task {task_id}: Completed {step_name} ({progress:.2f}%).")

def update_eta(task_id, start_time, total_steps, current_step):
    elapsed_time = time.time() - start_time
    avg_time_per_step = elapsed_time / current_step
    steps_remaining = total_steps - current_step
    eta = avg_time_per_step * steps_remaining
    with progress_store_lock:
        progress_store[task_id]["eta"] = eta

@app.route('/progress/<task_id>', methods=['GET'])
def get_progress(task_id):
    with progress_store_lock:
        progress = progress_store.get(task_id)
        if progress is None:
            return jsonify({"status": "error", "message": "Invalid task ID.", "steps_completed": []}), 404
        else:
            if "steps_completed" not in progress or not isinstance(progress["steps_completed"], list):
                progress["steps_completed"] = []
            return jsonify(progress)

def preprocess_dataframe(df, error_logs):
    try:
        df_processed = df.copy()
        df_processed = df_processed.fillna(method='ffill').fillna(method='bfill')
        df_processed = reduce_cardinality(df_processed, error_logs)
        return pd.get_dummies(df_processed, drop_first=True)
    except Exception as e:
        error_logs.append(f"Error processing dataframe: {str(e)}")
        logging.error(f"Error processing dataframe: {str(e)}")
        return df

def reduce_cardinality(df, error_logs, threshold=0.05):
    try:
        for col in df.columns:
            if df[col].dtype == 'object':
                value_counts = df[col].value_counts(normalize=True)
                to_replace = value_counts[value_counts < threshold].index
                df[col] = df[col].replace(to_replace, 'Other')
        return df
    except Exception as e:
        error_logs.append(f"Error reducing cardinality: {str(e)}")
        logging.error(f"Error reducing cardinality: {str(e)}")
        return df

def compute_average_cramers_v(df, error_logs, max_unique_values=10):
    try:
        logging.info("Computing average Cramér's V.")
        categorical_cols = [col for col in df.columns if df[col].nunique() <= max_unique_values]
        if len(categorical_cols) < 2:
            error_logs.append("Not enough variables for correlation analysis after filtering.")
            return None

        pairs = list(combinations(categorical_cols, 2))
        total_cramers_v = 0
        valid_pairs = 0

        for col1, col2 in pairs:
            crosstab = pd.crosstab(df[col1], df[col2])
            if crosstab.size == 0:
                continue
            chi2, _, _, _ = chi2_contingency(crosstab)
            n = crosstab.sum().sum()
            cramers_v = np.sqrt(chi2 / (n * (min(crosstab.shape) - 1)))
            if not np.isnan(cramers_v):
                total_cramers_v += cramers_v
                valid_pairs += 1

        if valid_pairs == 0:
            error_logs.append("No valid pairs for computing average Cramér's V.")
            return None

        average_cramers_v = total_cramers_v / valid_pairs
        interpretation = interpret_cramers_v(average_cramers_v)
        logging.info(f"Average Cramér's V computed successfully: {average_cramers_v}")
        return {
            "value": average_cramers_v,
            "interpretation": interpretation
        }
    except Exception as e:
        error_logs.append(f"Error computing average Cramér's V: {str(e)}")
        logging.error(f"Error computing average Cramér's V: {str(e)}")
        return None

def logistic_regression_analysis(df, error_logs):
    results = []
    try:
        logging.info("Starting logistic regression analysis.")
        columns = df.columns.tolist()

        for target_col in columns:
            predictors = [col for col in columns if col != target_col]
            X = df[predictors]
            y = df[target_col]

            model = LogisticRegression(max_iter=1000)
            model.fit(X, y)
            score = model.score(X, y)
            interpretation = interpret_model_accuracy(score)

            results.append({
                "target": target_col,
                "predictors": predictors,
                "accuracy": score,
                "interpretation": interpretation
            })

        top_results = sorted(results, key=lambda x: x['accuracy'], reverse=True)
        logging.info("Logistic regression analysis completed.")
        return top_results
    except Exception as e:
        error_logs.append(f"Error during logistic regression analysis: {str(e)}.")
        logging.error(f"Error during logistic regression analysis: {str(e)}")
        return []

def decision_tree_analysis(df, error_logs):
    results = []
    try:
        logging.info("Starting decision tree analysis.")
        columns = df.columns.tolist()

        for target_col in columns:
            predictors = [col for col in columns if col != target_col]
            X = df[predictors]
            y = df[target_col]

            model = DecisionTreeClassifier()
            model.fit(X, y)
            score = model.score(X, y)
            interpretation = interpret_model_accuracy(score)

            results.append({
                "target": target_col,
                "predictors": predictors,
                "accuracy": score,
                "interpretation": interpretation
            })

        top_results = sorted(results, key=lambda x: x['accuracy'], reverse=True)
        logging.info("Decision tree analysis completed.")
        return top_results
    except Exception as e:
        error_logs.append(f"Error during decision tree analysis: {str(e)}.")
        logging.error(f"Error during decision tree analysis: {str(e)}")
        return []

def random_forest_analysis(df, error_logs):
    results = []
    try:
        logging.info("Starting random forest analysis.")
        columns = df.columns.tolist()

        for target_col in columns:
            predictors = [col for col in columns if col != target_col]
            X = df[predictors]
            y = df[target_col]

            model = RandomForestClassifier()
            model.fit(X, y)
            score = model.score(X, y)
            interpretation = interpret_model_accuracy(score)

            results.append({
                "target": target_col,
                "predictors": predictors,
                "accuracy": score,
                "interpretation": interpretation
            })

        top_results = sorted(results, key=lambda x: x['accuracy'], reverse=True)
        logging.info("Random forest analysis completed.")
        return top_results
    except Exception as e:
        error_logs.append(f"Error during random forest analysis: {str(e)}.")
        logging.error(f"Error during random forest analysis: {str(e)}")
        return []

def chi_square_tests(df, error_logs):
    results = []
    try:
        logging.info("Performing chi-square tests.")
        columns = df.columns.tolist()
        if len(columns) < 2:
            error_logs.append("Not enough variables for chi-square tests.")
            return []
        
        # Group columns by their prefix (before the underscore)
        column_groups = {}
        for col in columns:
            prefix = col.split('_')[0]
            if prefix not in column_groups:
                column_groups[prefix] = []
            column_groups[prefix].append(col)
        
        # Compare columns from different groups
        for group1, group2 in combinations(column_groups.keys(), 2):
            for col1 in column_groups[group1]:
                for col2 in column_groups[group2]:
                    crosstab = pd.crosstab(df[col1], df[col2])
                    if crosstab.size == 0:
                        continue
                    chi2, p, _, _ = chi2_contingency(crosstab)
                    n = crosstab.sum().sum()
                    cramers_v = np.sqrt(chi2 / (n * (min(crosstab.shape) - 1)))
                    interpretation = interpret_cramers_v(cramers_v)
                    results.append({
                        "variable_1": col1,
                        "variable_2": col2,
                        "chi2": chi2,
                        "p_value": p,
                        "cramers_v": cramers_v,
                        "interpretation": interpretation
                    })

        top_results = sorted(results, key=lambda x: x['cramers_v'], reverse=True)
        logging.info("Chi-square tests completed.")
        return top_results
    except Exception as e:
        error_logs.append(f"Error during chi-square tests: {str(e)}.")
        logging.error(f"Error during chi-square tests: {str(e)}")
        return []

def multi_variable_analysis(df, error_logs):
    results = []
    try:
        logging.info("Performing multi-variable analysis.")
        columns = df.columns.tolist()
        if len(columns) < 2:
            error_logs.append("Not enough variables for multi-variable analysis.")
            return []
        
        # Group columns by their prefix (before the underscore)
        column_groups = {}
        for col in columns:
            prefix = col.split('_')[0]
            if prefix not in column_groups:
                column_groups[prefix] = []
            column_groups[prefix].append(col)
        
        # Generate all possible combinations of columns from different groups
        group_combinations = []
        for r in range(2, len(column_groups) + 1):
            group_combinations.extend(combinations(column_groups.keys(), r))

        for groups in group_combinations:
            for columns in product(*[column_groups[group] for group in groups]):
                # Skip if all columns are from the same group
                if len(set(col.split('_')[0] for col in columns)) < 2:
                    continue
                
                # Create a frequency table for multiple variables
                freq_table = df.groupby(list(columns)).size().unstack(fill_value=0)
                
                # Perform chi-square test
                chi2, p, dof, expected = chi2_contingency(freq_table)
                
                n = freq_table.sum().sum()
                min_dim = min(freq_table.shape) - 1
                if min_dim == 0:
                    continue
                
                cramers_v = np.sqrt(chi2 / (n * min_dim))
                interpretation = interpret_cramers_v(cramers_v)
                results.append({
                    "variables": list(columns),
                    "chi2": chi2,
                    "p_value": p,
                    "cramers_v": cramers_v,
                    "interpretation": interpretation
                })

        top_results = sorted(results, key=lambda x: x['cramers_v'], reverse=True)
        logging.info("Multi-variable analysis completed.")
        return top_results
    except Exception as e:
        error_logs.append(f"Error during multi-variable analysis: {str(e)}.")
        logging.error(f"Error during multi-variable analysis: {str(e)}")
        return []

if __name__ == "__main__":
    app.run(debug=True)