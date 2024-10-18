/* CsvAnalysisDashboard.js */
import React from 'react';

const CsvAnalysisDashboard = ({ 
  averageCramersV, 
  chiSquareResults, 
  logisticRegressionResults, 
  decisionTreeResults, 
  randomForestResults,
  multiVariableResults,
  selectedColumns = [] 
}) => {

  const formatPValue = (pValue) => {
    if (!pValue) return "N/A";
    return pValue < 0.001 ? "< 0.001" : pValue.toFixed(3);
  };

  const explainAccuracy = (accuracy, target) => {
    const percentage = (accuracy * 100).toFixed(2);
    return `
      For ${target}, the model can correctly predict this characteristic ${percentage}% of the time,
      based on the other selected columns in your dataset.
      This means that if we use this model to make 100 predictions about ${target} for new data
      with similar characteristics, about ${Math.round(accuracy * 100)} of those predictions would be correct.
    `;
  };

  const renderModelResults = (results, title) => {
    if (!results || results.length === 0) return null;

    return (
      <div className="mt-4 p-4 border rounded">
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="mb-2">
          This model uses the information from your selected columns to predict specific characteristics.
          Here are the top 5 characteristics it can predict most accurately:
        </p>
        <ul className="list-disc pl-5">
          {results.slice(0, 5).map((result, index) => (
            <li key={index} className="mb-2">
              <strong>{result.target}:</strong> {(result.accuracy * 100).toFixed(2)}% accuracy
              <p className="mt-1 text-sm text-gray-600">{explainAccuracy(result.accuracy, result.target)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Note: High accuracy doesn't always mean the model is perfect. It's important to consider factors like data balance,
          potential biases in the dataset, and the ethical implications of making such predictions.
        </p>
      </div>
    );
  };

  const renderMultiVariableResults = () => {
    if (!multiVariableResults || multiVariableResults.length === 0) return null;

    return (
      <div className="mb-4 p-4 border rounded">
        <h3 className="text-xl font-bold mb-2">Top 5 Strongest Relationships Among Multiple Variables</h3>
        <p className="mb-2">
          This section shows which combinations of variables from your selection have the strongest connections:
        </p>
        <ul className="list-disc pl-5">
          {multiVariableResults.slice(0, 5).map((result, index) => {
            const variablesString = Array.isArray(result.variables) 
              ? result.variables.join(", ") 
              : "Unknown variables";
            
            return (
              <li key={index} className="mb-2">
                <strong>{variablesString}</strong>:
                <ul className="list-disc pl-5">
                  <li>Strength: {result.interpretation} (Cramér's V = {result.cramers_v ? result.cramers_v.toFixed(4) : 'N/A'})</li>
                  <li>Statistical significance: p-value {formatPValue(result.p_value)}</li>
                </ul>
                <p className="mt-1 text-sm text-gray-600">
                  This {result.interpretation.toLowerCase()} relationship suggests that 
                  {result.interpretation === 'Very weak' ? " there's little to no connection among these variables." :
                   result.interpretation === 'Weak' ? " there's a slight connection among these variables, but it's not very prominent." :
                   result.interpretation === 'Moderate' ? " there's a noticeable connection among these variables that might be worth exploring further." :
                   " these variables are closely related and might have complex interactions or influences on each other."}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Note: These relationships are among variables from different categories within your selection. Complex relationships among multiple variables can provide deeper insights into your data but should be interpreted carefully.
        </p>
      </div>
    );
  };

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">CSV Analysis Results</h2>
      {selectedColumns.length > 0 && (
        <p className="mb-4">Analysis based on selected columns: {selectedColumns.join(', ')}</p>
      )}
      
      {averageCramersV && (
        <div className="mb-4 p-4 border rounded">
          <h3 className="text-xl font-bold mb-2">Overall Association Strength</h3>
          <p>The average association strength between your selected variables is {averageCramersV.value.toFixed(4)}, which is considered <strong>{averageCramersV.interpretation || 'N/A'}</strong>.</p>
          <p className="mt-2 text-sm text-gray-600">
            This means that, on average, the variables you selected have a {averageCramersV.interpretation.toLowerCase()} relationship with each other. 
            {averageCramersV.interpretation === 'Weak' ? " This suggests that most of your selected variables don't strongly influence each other." : 
             averageCramersV.interpretation === 'Strong' ? " This indicates that many of your selected variables are closely related and may influence each other." : 
             " Some of your selected variables may have notable relationships, but it's not a dominant pattern across all of them."}
          </p>
        </div>
      )}

      {chiSquareResults && chiSquareResults.length > 0 && (
        <div className="mb-4 p-4 border rounded">
          <h3 className="text-xl font-bold mb-2">Top 5 Strongest Relationships Between Selected Variables</h3>
          <p className="mb-2">
            This section shows which pairs of your selected variables have the strongest connections:
          </p>
          <ul className="list-disc pl-5">
            {chiSquareResults.slice(0, 5).map((result, index) => (
              <li key={index} className="mb-2">
                <strong>{result.variable_1}</strong> and <strong>{result.variable_2}</strong>:
                <ul className="list-disc pl-5">
                  <li>Strength: {result.interpretation} (Cramér's V = {result.cramers_v ? result.cramers_v.toFixed(4) : 'N/A'})</li>
                  <li>Statistical significance: p-value {formatPValue(result.p_value)}</li>
                </ul>
                <p className="mt-1 text-sm text-gray-600">
                  This {result.interpretation.toLowerCase()} relationship suggests that 
                  {result.interpretation === 'Very weak' ? " there's little to no connection between these variables." :
                   result.interpretation === 'Weak' ? " there's a slight connection, but it's not very prominent." :
                   result.interpretation === 'Moderate' ? " there's a noticeable connection that might be worth exploring further." :
                   " these variables are closely related and one might strongly influence the other."}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-gray-600">
            Note: These relationships are between variables from different categories within your selection. We don't compare variables within the same category (e.g., different types of learning difficulties) as such comparisons wouldn't be meaningful.
          </p>
        </div>
      )}

      {renderMultiVariableResults()}

      {renderModelResults(logisticRegressionResults, "Logistic Regression Predictive Power")}
      {renderModelResults(decisionTreeResults, "Decision Tree Predictive Power")}
      {renderModelResults(randomForestResults, "Random Forest Predictive Power")}

      {!averageCramersV && (!chiSquareResults || chiSquareResults.length === 0) && 
       (!multiVariableResults || multiVariableResults.length === 0) &&
       (!logisticRegressionResults || !logisticRegressionResults.length) && 
       (!decisionTreeResults || !decisionTreeResults.length) && 
       (!randomForestResults || !randomForestResults.length) && (
        <div className="mb-4 p-4 border rounded">
          <h3 className="text-xl font-bold mb-2">No Results</h3>
          <p>No analysis results are available for your selected columns. This could be due to insufficient data or processing errors. Please check the error logs for more information.</p>
        </div>
      )}

      <div className="mt-8 p-4 border rounded bg-gray-100">
        <h3 className="text-xl font-bold mb-2">Understanding the Analysis</h3>
        <p className="mb-2">This analysis provides insights into relationships between different variables in your selected dataset and the ability to predict certain characteristics based on other information. Here's what each section means:</p>
        <ul className="list-disc pl-5">
          <li><strong>Overall Association Strength:</strong> This gives a general idea of how closely related all your selected variables are to each other.</li>
          <li><strong>Strongest Relationships Between Selected Variables:</strong> This highlights which specific pairs of your selected variables have the strongest connections, which could indicate important patterns or influences in your data.</li>
          <li><strong>Strongest Relationships Among Multiple Variables:</strong> This section shows complex interactions between multiple variables, potentially revealing deeper patterns in your data.</li>
          <li><strong>Predictive Power:</strong> The three model results (Logistic Regression, Decision Tree, and Random Forest) show how accurately we can predict certain characteristics based on the other information in your selected columns. Higher accuracy means the model is better at making correct predictions.</li>
        </ul>
        <p className="mt-2">
          Remember, while these results can provide valuable insights, they should be interpreted cautiously. Correlation doesn't always mean causation, and there may be other factors not captured in your selected data that influence these relationships and predictions.
        </p>
      </div>
    </div>
  );
};

export default CsvAnalysisDashboard;
