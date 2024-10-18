/* App.js */
import React from "react";
import CsvUploader from "./CsvUploader";
import "./App.css";

function App() {
  return (
    <div className="App bg-gray-100 min-h-screen">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <h1 className="text-3xl font-bold">CSV Analysis Tool</h1>
      </header>
      <main className="container mx-auto mt-8 p-4">
        <CsvUploader />
      </main>
      <footer className="bg-gray-200 text-center p-4 mt-8">
        <p>&copy; 2024 CSV Analysis Tool. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
