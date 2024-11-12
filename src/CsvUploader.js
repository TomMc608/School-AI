import React, { useState } from "react";
import Papa from "papaparse";
import axios from "axios";
import CsvAnalysisDashboard from "./CsvAnalysisDashboard";

const CsvUploader = () => {
  const [columns, setColumns] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [columnTypes, setColumnTypes] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);

  const isDateFormat = (value) => {
    const datePatterns = [
      /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/, 
      /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/,    
      /^\d{1,2}[/-][A-Za-z]{3}[/-]\d{2,4}$/
    ];
    return datePatterns.some(pattern => pattern.test(value));
  };

  const isPercentage = (value) => {
    return typeof value === 'string' && value.trim().endsWith('%');
  };

  const parsePercentage = (value) => {
    if (typeof value !== 'string') return null;
    const cleaned = value.trim().replace('%', '');
    const number = parseFloat(cleaned);
    return !isNaN(number) ? number : null;
  };

  const categorizeColumns = (data) => {
    const types = {};
    const firstRow = data[0];

    Object.keys(firstRow).forEach(column => {
      const sampleValues = data
        .slice(0, 100)
        .map(row => row[column])
        .filter(val => val !== null && val !== "");

      if (sampleValues.length === 0) {
        types[column] = "empty";
        return;
      }

      if (sampleValues.some(val => isDateFormat(val))) {
        types[column] = "datetime";
        return;
      }

      if (sampleValues.some(val => isPercentage(val))) {
        const numericValues = sampleValues.map(parsePercentage).filter(val => val !== null);
        const uniqueValues = new Set(numericValues);
        types[column] = uniqueValues.size < 10 ? "categorical-numeric" : "numeric";
        return;
      }

      const isNumeric = sampleValues.every(val => !isNaN(val) && !isNaN(parseFloat(val)));
      
      const isBool = sampleValues.every(val => 
        ["true", "false", "0", "1", "yes", "no", "y", "n"].includes(val.toString().toLowerCase())
      );

      const uniqueValues = new Set(sampleValues);
      const uniqueCount = uniqueValues.size;

      if (isNumeric) {
        types[column] = uniqueCount < 10 ? "categorical-numeric" : "numeric";
      } else if (isBool) {
        types[column] = "boolean";
      } else if (uniqueCount < 10) {
        types[column] = "categorical";
      } else {
        types[column] = "text";
      }
    });

    return types;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadProgress(0);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => {
          return header.replace(/^\uFEFF/, '').trim();
        },
        complete: (result) => {
          console.log("Parse complete", result.data);
          setCsvData(result.data);
          const columns = Object.keys(result.data[0] || {});
          setColumns(columns);
          setColumnTypes(categorizeColumns(result.data));
          setSelectedColumns([]);
          setResults(null);
          setUploadProgress(100);
          setError(null);
        },
        error: (error) => {
          console.error("Parse error:", error);
          setError("Error reading CSV file. Please make sure it's a valid CSV file.");
          setUploadProgress(0);
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
    setResults(null);

    try {
        const response = await axios.post(
            "https://school-ai-backend.onrender.com/process",
            {
                data: csvData,
                selected_columns: selectedColumns,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        if (response.data.status === "success") {
            setResults(response.data.results);
        } else {
            setError(response.data.message || "Error analyzing data:");
        }
    } catch (e) {
        console.error("Analysis error:", e);
        setError(e.response?.data?.message || `Error analyzing CSV data: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
};


  const handleColumnChange = (column) => {
    setSelectedColumns((prev) =>
      prev.includes(column)
        ? prev.filter((col) => col !== column)
        : [...prev, column]
    );
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'numeric': return '🔢';
      case 'categorical-numeric': return '📊';
      case 'categorical': return '📝';
      case 'datetime': return '📅';
      case 'boolean': return '✓';
      case 'text': return '📄';
      case 'percentage': return '%';
      default: return '❔';
    }
  };

  const getTypeColor = (type) => {
    switch(type) {
      case 'numeric': return 'bg-purple-100 text-purple-800';
      case 'categorical-numeric': return 'bg-blue-100 text-blue-800';
      case 'categorical': return 'bg-green-100 text-green-800';
      case 'datetime': return 'bg-yellow-100 text-yellow-800';
      case 'boolean': return 'bg-red-100 text-red-800';
      case 'text': return 'bg-gray-100 text-gray-800';
      case 'percentage': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const groupedColumns = Object.entries(columnTypes).reduce((acc, [column, type]) => {
    if (!acc[type]) acc[type] = [];
    acc[type].push(column);
    return acc;
  }, {});

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
        <h2 className="text-xl font-bold mb-6">CSV Data Analysis</h2>
        
        {/* File Upload Section */}
        <div className="mb-8">
          <label className="block text-lg font-semibold mb-2">Upload CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="w-full p-2 border border-gray-300 rounded"
          />
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}
        </div>
        
        {/* Column Selection Section */}
        {columns.length > 0 && (
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-4">Select Columns for Analysis</h4>
            <div className="space-y-4">
              {Object.entries(groupedColumns).map(([type, cols]) => (
                <div key={type} className="border rounded-lg p-4">
                  <h5 className="font-medium mb-2 flex items-center">
                    {getTypeIcon(type)} {' '}
                    <span className={`ml-2 px-2 py-1 rounded-full text-sm ${getTypeColor(type)}`}>
                      {type.charAt(0).toUpperCase() + type.slice(1)} Columns
                    </span>
                    <span className="ml-2 text-sm text-gray-500">({cols.length})</span>
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {cols.map((column) => (
                      <label key={column} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(column)}
                          onChange={() => handleColumnChange(column)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm truncate" title={column}>{column}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Selected Columns Summary */}
            <div className="mt-4">
              <h5 className="font-medium mb-2">Selected Columns ({selectedColumns.length})</h5>
              <div className="flex flex-wrap gap-2">
                {selectedColumns.map(column => (
                  <span key={column} 
                    className={`px-3 py-1 rounded-full text-sm ${getTypeColor(columnTypes[column])} flex items-center`}
                  >
                    {getTypeIcon(columnTypes[column])} {column}
                    <button
                      onClick={() => handleColumnChange(column)}
                      className="ml-2 hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || selectedColumns.length < 2}
          className={`w-full px-4 py-2 rounded ${
            isLoading || selectedColumns.length < 2
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isLoading ? "Analyzing..." : "Analyze Selected Columns"}
        </button>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-500 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Results Dashboard */}
      {results && (
        <CsvAnalysisDashboard
          results={results}
          selectedColumns={selectedColumns}
        />
      )}
    </div>
  );
};

export default CsvUploader;