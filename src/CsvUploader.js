/* CsvUploader.js */
import React, { useState } from "react";
import Papa from "papaparse";
import axios from "axios";
import CsvAnalysisDashboard from "./CsvAnalysisDashboard";

const CsvUploader = () => {
  const [columns, setColumns] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [averageCramersV, setAverageCramersV] = useState(null);
  const [chiSquareResults, setChiSquareResults] = useState([]);
  const [logisticRegressionResults, setLogisticRegressionResults] = useState([]);
  const [decisionTreeResults, setDecisionTreeResults] = useState([]);
  const [randomForestResults, setRandomForestResults] = useState([]);
  const [multiVariableResults, setMultiVariableResults] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepsCompleted, setStepsCompleted] = useState([]);
  const [eta, setEta] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          setCsvData(result.data);
          const firstRowData = result.data[0];
          setColumns(Object.keys(firstRowData));
        },
        error: (error) => {
          setError("Error reading CSV data. Please make sure the file is a valid CSV file.");
        },
      });
    }
  };

  const handleSubmit = async () => {
    if (csvData.length === 0) {
      setError("Please upload a CSV file first.");
      return;
    }
    if (selectedColumns.length < 2) {
      setError("Please select at least 2 columns.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setAverageCramersV(null);
    setChiSquareResults([]);
    setLogisticRegressionResults([]);
    setDecisionTreeResults([]);
    setRandomForestResults([]);
    setMultiVariableResults([]);
    setProgress(0);
    setStepsCompleted([]);
    setEta(null);

    const payload = {
      data: csvData,
      selected_columns: selectedColumns,
    };

    try {
      const response = await axios.post("https://school-ai-backend.onrender.com/process", payload, {
  headers: {
    "Content-Type": "application/json",
  },
});

      if (response.data.status === "processing") {
        const taskId = response.data.task_id;
        pollProgress(taskId);
      } else {
        setError(response.data.message || "An error occurred during processing.");
        setIsLoading(false);
      }
    } catch (e) {
      setError(`Error sending CSV data to API: ${e.message}`);
      setIsLoading(false);
    }
  };

  const pollProgress = (taskId) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`https://school-ai-backend.onrender.com/progress/${taskId}`);

        if (response.data.status === "processing") {
          setProgress(response.data.progress);
          setStepsCompleted(response.data.steps_completed || []);
          setEta(response.data.eta);
        } else if (response.data.status === "success") {
          // Set results in state to be passed to the dashboard
          setAverageCramersV(response.data.average_cramers_v);
          setChiSquareResults(response.data.chi_square_results || []);
          setLogisticRegressionResults(response.data.logistic_regression_results || []);
          setDecisionTreeResults(response.data.decision_tree_results || []);
          setRandomForestResults(response.data.random_forest_results || []);
          setMultiVariableResults(response.data.multi_variable_results || []);
          setError(null);
          clearInterval(interval);
          setIsLoading(false);
        } else if (response.data.status === "error") {
          setError(response.data.message || "An error occurred during processing.");
          clearInterval(interval);
          setIsLoading(false);
        }
      } catch (e) {
        setError(`Error polling progress: ${e.message}`);
        clearInterval(interval);
        setIsLoading(false);
      }
    }, 1000);
  };

  const handleColumnChange = (column) => {
    setSelectedColumns((prevSelectedColumns) => {
      if (prevSelectedColumns.includes(column)) {
        return prevSelectedColumns.filter((col) => col !== column);
      } else {
        return [...prevSelectedColumns, column];
      }
    });
  };

  const formatEta = (seconds) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-8">Upload and Analyze Your CSV</h2>
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold mb-4">Upload a CSV File</h3>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="w-full p-2 mb-4 border border-gray-300 rounded focus:ring focus:ring-blue-500 focus:outline-none"
        />
        {columns.length > 0 && (
          <div className="mb-4">
            <h4 className="text-lg font-semibold mb-2">Select Columns for Analysis:</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {columns.map((column) => (
                <label key={column} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={column}
                    checked={selectedColumns.includes(column)}
                    onChange={() => handleColumnChange(column)}
                    className="form-checkbox h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm">{column}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={handleSubmit}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full transition duration-150 ease-in-out"
        >
          Submit for Analysis
        </button>
        {error && <p className="text-red-500 mt-4">{error}</p>}
        {isLoading && (
          <div className="mt-4">
            <p>Processing data, please wait...</p>
            <progress value={progress} max="100" className="w-full h-4 bg-gray-200 rounded-md overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${progress}%` }}></div>
            </progress>
            <p>{Math.round(progress)}% completed</p>
            <p>Estimated time remaining: {formatEta(eta)}</p>
          </div>
        )}
      </div>

      {/* Render the CsvAnalysisDashboard if analysis is complete */}
      {!isLoading && averageCramersV && (
        <CsvAnalysisDashboard
          averageCramersV={averageCramersV}
          chiSquareResults={chiSquareResults}
          logisticRegressionResults={logisticRegressionResults}
          decisionTreeResults={decisionTreeResults}
          randomForestResults={randomForestResults}
          multiVariableResults={multiVariableResults}
          selectedColumns={selectedColumns}
        />
      )}
    </div>
  );
};

export default CsvUploader;
