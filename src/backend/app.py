from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from scipy.stats import chi2_contingency
from itertools import combinations
from joblib import Parallel, delayed
import logging
import time
import sys
import json
import ast

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)

def analyze_ncea_results(results_str):
    """Extract and analyze NCEA results from the string representation."""
    try:
        results = ast.literal_eval(results_str)
        if not results or not isinstance(results, list):
            return None
        
        # Calculate average credits and achievement levels
        total_credits = 0
        achievement_counts = {
            'Excellence': 0,
            'Merit': 0,
            'Achieved': 0
        }
        
        for result in results:
            if isinstance(result, dict):
                total_credits += result.get('Credits', 0)
                level = result.get('Achievement Level')
                if level in achievement_counts:
                    achievement_counts[level] += 1
        
        avg_credits = total_credits / len(results) if results else 0
        primary_achievement = max(achievement_counts.items(), key=lambda x: x[1])[0]
        
        return {
            'average_credits': avg_credits,
            'primary_achievement': primary_achievement
        }
    except:
        return None

def analyze_categorical_relationship(series1, series2, col1_name, col2_name):
    """Analyze the relationship between two categorical variables in detail."""
    try:
        # Handle lists stored as strings
        if series1.dtype == object:
            series1 = series1.apply(lambda x: str(x).strip('[]').split(',')[0].strip() if isinstance(x, str) else str(x))
        if series2.dtype == object:
            series2 = series2.apply(lambda x: str(x).strip('[]').split(',')[0].strip() if isinstance(x, str) else str(x))

        contingency = pd.crosstab(series1, series2)
        chi2, p_value, dof, expected = chi2_contingency(contingency)
        
        # Get unique categories for both variables
        categories1 = contingency.index.unique()
        categories2 = contingency.columns.unique()
        
        # Calculate associations for all combinations
        associations = []
        for cat1 in categories1:
            for cat2 in categories2:
                observed = contingency.loc[cat1, cat2]
                expected_val = (contingency.loc[cat1].sum() * contingency[cat2].sum()) / contingency.values.sum()
                
                if expected_val > 0:
                    difference = observed - expected_val
                    strength = (difference / expected_val) * 100
                    
                    # Add row and column totals
                    row_total = contingency.loc[cat1].sum()
                    col_total = contingency[cat2].sum()
                    
                    associations.append({
                        'category1': str(cat1),
                        'category2': str(cat2),
                        'observed': float(observed),
                        'expected': float(expected_val),
                        'strength': float(strength),
                        'row_total': float(row_total),
                        'col_total': float(col_total),
                        'row_percentage': float(observed / row_total * 100),
                        'col_percentage': float(observed / col_total * 100)
                    })
        
        # Sort associations by absolute strength
        associations.sort(key=lambda x: abs(x['strength']), reverse=True)
        
        # Add category summaries
        category_summaries = {
            'primary': {cat: contingency.loc[cat].sum() for cat in categories1},
            'secondary': {cat: contingency[cat].sum() for cat in categories2}
        }
        
        return {
            'chi2': float(chi2),
            'p_value': float(p_value),
            'dof': int(dof),
            'associations': associations,  # Now includes all combinations
            'total_observations': int(contingency.values.sum()),
            'category_summaries': category_summaries
        }
        
    except Exception as e:
        print(f"Error in analyze_categorical_relationship: {str(e)}")
        return None

def process_pair(data_dict, col1, col2):
    """Process a single pair of columns with detailed analysis."""
    try:
        series1 = pd.Series(data_dict[col1], name=col1)
        series2 = pd.Series(data_dict[col2], name=col2)
        
        # Calculate Cramér's V
        contingency = pd.crosstab(series1, series2)
        chi2 = chi2_contingency(contingency, correction=False)[0]
        n = contingency.values.sum()
        min_dim = min(contingency.shape) - 1
        
        if min_dim <= 0:
            return {
                'col1': col1,
                'col2': col2,
                'value': 0,
                'details': None
            }
            
        cramer_v = np.sqrt(chi2 / (n * min_dim))
        
        # Get detailed analysis
        details = analyze_categorical_relationship(series1, series2, col1, col2)
        
        return {
            'col1': col1,
            'col2': col2,
            'value': float(cramer_v),
            'details': details
        }
        
    except Exception as e:
        print(f"Error processing pair {col1}, {col2}: {str(e)}")
        return {
            'col1': col1,
            'col2': col2,
            'value': 0,
            'details': None
        }
    
    # Sort associations by absolute strength
    associations.sort(key=lambda x: abs(x['strength']), reverse=True)
    
    return {
        'chi2': float(chi2),
        'p_value': float(p_value),
        'associations': associations[:5],  # Top 5 strongest associations
        'row_percentages': row_pcts.to_dict(),
        'column_percentages': col_pcts.to_dict()
    }

def calculate_cramers_v_with_details(series1, series2, col1_name, col2_name):
    """Calculate Cramér's V statistic and detailed categorical analysis."""
    try:
        # Special handling for NCEA Results
        if col1_name == 'NCEA Results' or col2_name == 'NCEA Results':
            ncea_col = series1 if col1_name == 'NCEA Results' else series2
            other_col = series2 if col1_name == 'NCEA Results' else series1
            
            # Process NCEA results
            processed_ncea = pd.Series([
                analyze_ncea_results(result)['primary_achievement'] 
                if analyze_ncea_results(result) else 'Unknown'
                for result in ncea_col
            ])
            
            contingency = pd.crosstab(processed_ncea, other_col)
            detailed_analysis = analyze_categorical_relationship(
                processed_ncea, 
                other_col,
                'NCEA Achievement Level',
                col2_name if col1_name == 'NCEA Results' else col1_name
            )
        else:
            contingency = pd.crosstab(series1, series2)
            detailed_analysis = analyze_categorical_relationship(series1, series2, col1_name, col2_name)
        
        # Calculate Cramér's V
        chi2 = chi2_contingency(contingency, correction=False)[0]
        n = contingency.values.sum()
        min_dim = min(contingency.shape) - 1
        
        if min_dim <= 0:
            return 0, None
            
        cramer_v = np.sqrt(chi2 / (n * min_dim))
        
        return cramer_v, detailed_analysis
        
    except Exception as e:
        print(f"Error in calculate_cramers_v_with_details: {str(e)}")
        return 0, None

def process_pair(data_dict, col1, col2):
    """Process a single pair of columns with detailed analysis."""
    try:
        series1 = pd.Series(data_dict[col1], name=col1)
        series2 = pd.Series(data_dict[col2], name=col2)
        cramer_v, details = calculate_cramers_v_with_details(series1, series2, col1, col2)
        
        return {
            'col1': col1,
            'col2': col2,
            'value': cramer_v,
            'details': details
        }
    except Exception as e:
        print(f"Error processing pair {col1}, {col2}: {str(e)}")
        return {
            'col1': col1,
            'col2': col2,
            'value': 0,
            'details': None
        }

def process_batches_with_eta(df, selected_columns, batch_size=20):
    try:
        if len(selected_columns) < 2:
            raise ValueError("Please select at least two columns for analysis")

        column_pairs = list(combinations(selected_columns, 2))
        total_pairs = len(column_pairs)
        
        # Convert DataFrame to dictionary for pickling
        data_dict = {col: df[col].values for col in selected_columns}
        
        # Process in batches
        results = []
        start_time = time.time()
        
        for i in range(0, total_pairs, batch_size):
            batch_pairs = column_pairs[i:i + batch_size]
            
            # Process batch in parallel
            batch_results = Parallel(n_jobs=-1)(
                delayed(process_pair)(data_dict, col1, col2) 
                for col1, col2 in batch_pairs
            )
            
            results.extend(batch_results)
            
            # Calculate and display ETA
            elapsed_time = time.time() - start_time
            processed_pairs = min(i + batch_size, total_pairs)
            remaining_pairs = total_pairs - processed_pairs
            eta_seconds = (elapsed_time / processed_pairs) * remaining_pairs if processed_pairs > 0 else 0
            
            sys.stdout.write(f"\rETA: {format_eta(eta_seconds)}")
            sys.stdout.flush()

        sys.stdout.write('\n')
        
        # Calculate final results
        valid_results = [r['value'] for r in results if r['value'] is not None and not np.isnan(r['value'])]
        average_cramers_v = sum(valid_results) / len(valid_results) if valid_results else 0
        
        return {
            "average_cramers_v": float(average_cramers_v),
            "valid_pairs": len(valid_results),
            "pairs": results
        }

    except Exception as e:
        logging.error(f"Error in batch processing: {str(e)}")
        raise

def format_eta(seconds):
    """Format ETA in hours, minutes, and seconds."""
    hours, remainder = divmod(int(seconds), 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours}h {minutes}m {seconds}s"

@app.route('/process', methods=['POST'])
def process_csv():
    try:
        content = request.get_json()
        if not content:
            return jsonify({
                "status": "error",
                "message": "No data provided"
            }), 400
        
        data = content.get('data', [])
        selected_columns = content.get('selected_columns', [])
        
        if not data:
            return jsonify({
                "status": "error",
                "message": "No data provided in JSON"
            }), 400

        if not selected_columns or len(selected_columns) < 2:
            return jsonify({
                "status": "error",
                "message": "Please select at least two columns for analysis"
            }), 400

        print(f"Received data length: {len(data)}")
        print(f"Selected columns: {selected_columns}")
        
        # Create DataFrame and select only the requested columns
        df = pd.DataFrame(data)
        
        # Verify all selected columns exist in the DataFrame
        missing_cols = [col for col in selected_columns if col not in df.columns]
        if missing_cols:
            return jsonify({
                "status": "error",
                "message": f"Columns not found in data: {missing_cols}"
            }), 400
            
        df_selected = df[selected_columns]
        
        # Process the data
        try:
            results = process_batches_with_eta(df_selected, selected_columns)
            
            # Ensure results is not None and has the expected structure
            if not results:
                return jsonify({
                    "status": "error",
                    "message": "Analysis produced no results"
                }), 400

            # Validate results structure
            required_keys = ["average_cramers_v", "valid_pairs", "pairs"]
            if not all(key in results for key in required_keys):
                return jsonify({
                    "status": "error",
                    "message": "Invalid results structure"
                }), 400

            return jsonify({
                "status": "success",
                "results": results
            })

        except Exception as e:
            print(f"Error in processing data: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Error processing data: {str(e)}"
            }), 400

    except Exception as e:
        print(f"Error in process_csv: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400

if __name__ == "__main__":
    app.run(debug=False, threaded=True)