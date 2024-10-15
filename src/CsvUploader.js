import React, { useState } from "react";
import Papa from "papaparse";

const CsvUploader = () => {
  const [columns, setColumns] = useState([]);
  const [firstRow, setFirstRow] = useState({});
  const [emptyColumns, setEmptyColumns] = useState([]);
  const [csvData, setCsvData] = useState([]);  // State to hold full CSV data

  const handleFileUpload = (e) => {
    const file = e.target.files[0];

    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          // Store the full CSV data
          setCsvData(result.data);

          // Set the column names and the first row
          const firstRowData = result.data[0];
          setColumns(Object.keys(firstRowData));
          setFirstRow(firstRowData);

          // Identify columns with no data or 'None'
          const emptyCols = Object.keys(firstRowData).filter(key => !firstRowData[key] || firstRowData[key] === "None" || firstRowData[key] === null);
          setEmptyColumns(emptyCols);
        },
        error: (error) => {
          console.error("Error parsing CSV file:", error);
        },
      });
    }
  };

  const sendCsvToApi = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(csvData),
      });
      const result = await response.json();
      console.log("Processed data:", result);
    } catch (error) {
      console.error("Error sending CSV data to API:", error);
    }
  };

  return (
    <div style={{ width: '90%', margin: '0 auto' }}>
      <h2>Upload a CSV File</h2>
      <input type="file" accept=".csv" onChange={handleFileUpload} />

      {columns.length > 0 && (
        <>
          <div style={{ overflowX: 'auto', marginTop: '20px', maxWidth: '100%', border: '1px solid #ccc', padding: '10px' }}>
            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  {columns.map((key) => (
                    <th key={key} style={{ padding: '10px', border: '1px solid #ccc', backgroundColor: '#333', color: '#fff' }}>{key}</th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>

          <div style={{ overflowX: 'auto', marginTop: '20px', maxWidth: '100%', border: '1px solid #ccc', padding: '10px' }}>
            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
              <tbody>
                <tr>
                  {columns.map((key) => (
                    <td key={key} style={{ padding: '10px', border: '1px solid #ccc' }}>{firstRow[key]}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {emptyColumns.length > 0 && (
            <div style={{ marginTop: '20px', color: '#fff' }}>
              <p>No data for this student in the following columns:</p>
              <ul>
                {emptyColumns.map((col) => (
                  <li key={col}>{col}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Button to send CSV data to API */}
          <button onClick={sendCsvToApi} style={{ marginTop: "20px", padding: "10px 20px" }}>
            Send Data to API
          </button>
        </>
      )}
    </div>
  );
};

export default CsvUploader;
