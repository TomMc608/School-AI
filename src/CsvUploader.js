import React, { useState } from "react";
import Papa from "papaparse";
import axios from 'axios';

const CsvUploader = () => {
  const [columns, setColumns] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [averageCorrelation, setAverageCorrelation] = useState(null);
  const [error, setError] = useState(null);
  const [errorLogs, setErrorLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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
          console.error("Error parsing CSV file:", error);
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
    setErrorLogs([]);
    setIsLoading(true);
    setAverageCorrelation(null);

    // Filter csvData to only include selected columns
    const filteredData = csvData.map(row => {
      let filteredRow = {};
      selectedColumns.forEach(col => {
        filteredRow[col] = row[col];
      });
      return filteredRow;
    });

    try {
      const response = await retryAxiosRequest(filteredData, selectedColumns);
      if (response.data.status === 'success') {
        if (response.data.average_correlation !== "N/A") {
          setAverageCorrelation(response.data.average_correlation);
        } else {
          setAverageCorrelation("N/A");
        }
        if (response.data.error_logs && response.data.error_logs.length > 0) {
          setErrorLogs(response.data.error_logs);
        }
      }
    } catch (e) {
      console.error("Error sending CSV data to API:", e);
      setError(`Error sending CSV data to API: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const retryAxiosRequest = async (data, selectedColumns, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await axios.post('http://127.0.0.1:5000/process', data, {
          headers: {
            'Content-Type': 'application/json',
          },
          params: {
            selected_columns: selectedColumns,
          },
          timeout: 120000
        });
      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error.message);
        if (i === retries - 1) throw error;
      }
    }
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

  return (
    <div style={{ width: '90%', margin: '0 auto' }}>
      <h2>Upload a CSV File</h2>
      <input type="file" accept=".csv" onChange={handleFileUpload} />

      {columns.length > 0 && (
        <div>
          <h3>Select Columns for Correlation Analysis:</h3>
          <div>
            {columns.map((column) => (
              <div key={column}>
                <input
                  type="checkbox"
                  id={column}
                  checked={selectedColumns.includes(column)}
                  onChange={() => handleColumnChange(column)}
                />
                <label htmlFor={column}>{column}</label>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={handleSubmit} style={{ marginTop: "20px", padding: "10px 20px" }}>Submit for Correlation Analysis</button>

      {isLoading && (
        <div>
          <p>Processing data, please wait...</p>
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {averageCorrelation !== null && (
        <div>
          <h3>Average Correlation:</h3>
          <p>{averageCorrelation !== "N/A" ? parseFloat(averageCorrelation).toFixed(4) : "N/A"}</p>
        </div>
      )}
      {errorLogs.length > 0 && (
        <div>
          <h3>Error Logs:</h3>
          <ul>
            {errorLogs.map((log, index) => (
              <li key={index}>{log}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CsvUploader;
