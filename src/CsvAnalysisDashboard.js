import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const CsvAnalysisDashboard = ({ results, selectedColumns }) => {
  const [selectedPair, setSelectedPair] = useState(null);

  const barChartData = useMemo(() => {
    if (!results?.pairs) return [];
    return results.pairs
      .map(pair => ({
        name: `${pair.col1} - ${pair.col2}`,
        value: parseFloat(pair.value.toFixed(4)),
        pair: pair
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [results?.pairs]);

  const heatmapData = useMemo(() => {
    if (!results?.pairs || !selectedColumns?.length) return {};
    
    const matrix = {};
    selectedColumns.forEach(col1 => {
      matrix[col1] = {};
      selectedColumns.forEach(col2 => {
        matrix[col1][col2] = { value: col1 === col2 ? 1 : 0 };
      });
    });

    results.pairs.forEach(pair => {
      if (matrix[pair.col1] && matrix[pair.col2]) {
        matrix[pair.col1][pair.col2] = { 
          value: parseFloat(pair.value.toFixed(4)),
          details: pair.details 
        };
        matrix[pair.col2][pair.col1] = { 
          value: parseFloat(pair.value.toFixed(4)),
          details: pair.details 
        };
      }
    });

    return matrix;
  }, [results?.pairs, selectedColumns]);

  const renderDetailedAnalysis = (details, pair) => {
    console.log("Details:", details);
    console.log("Pair:", pair);

    if (!details || !pair || !Array.isArray(details.associations)) {
      return null;
    }

    // Safely access values with default values if undefined
    const safeNumber = (num) => {
      return num !== undefined && num !== null ? Number(num) : 0;
    };

    // Process associations
    const relationships = details.associations.map(assoc => ({
      category1: (assoc.category1 || '').replace(/['"]/g, ''),
      category2: (assoc.category2 || '').replace(/['"]/g, ''),
      impact: safeNumber(assoc.strength),
      observed: safeNumber(assoc.observed),
      expected: safeNumber(assoc.expected)
    }));

    return (
      <div className="mt-4 space-y-6">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h4 className="text-xl font-semibold mb-4">
            Detailed Analysis: {pair.col1} vs {pair.col2}
          </h4>
          
          {/* Summary Statistics */}
          <div className="mb-6">
            <h5 className="text-lg font-medium mb-3">Summary Statistics</h5>
            <table className="min-w-full border-collapse">
              <tbody>
                <tr>
                  <td className="border px-4 py-2 bg-gray-50 font-medium">Statistical Strength (Cramér's V)</td>
                  <td className="border px-4 py-2">{(safeNumber(pair.value) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="border px-4 py-2 bg-gray-50 font-medium">Sample Size</td>
                  <td className="border px-4 py-2">{details.total_observations || "N/A"}</td>
                </tr>
                <tr>
                  <td className="border px-4 py-2 bg-gray-50 font-medium">Statistical Significance</td>
                  <td className="border px-4 py-2">p-value = {safeNumber(details.p_value).toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Detailed Relationship Analysis */}
          <div className="mb-6">
            <h5 className="text-lg font-medium mb-3">Detailed Relationship Analysis</h5>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-4 py-2">{pair.col1}</th>
                    <th className="border px-4 py-2">{pair.col2}</th>
                    <th className="border px-4 py-2">Impact</th>
                    <th className="border px-4 py-2">Observed</th>
                    <th className="border px-4 py-2">Expected</th>
                    <th className="border px-4 py-2">Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {relationships.map((rel, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border px-4 py-2 font-medium">{rel.category1}</td>
                      <td className="border px-4 py-2">{rel.category2}</td>
                      <td className={`border px-4 py-2 ${
                        rel.impact > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {rel.impact > 0 ? '+' : ''}{rel.impact.toFixed(1)}%
                      </td>
                      <td className="border px-4 py-2">{rel.observed}</td>
                      <td className="border px-4 py-2">{rel.expected.toFixed(1)}</td>
                      <td className="border px-4 py-2 text-sm">
                        {rel.impact > 0 
                          ? `Higher association than expected by ${rel.impact.toFixed(1)}%`
                          : `Lower association than expected by ${Math.abs(rel.impact).toFixed(1)}%`
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h5 className="font-medium text-blue-800 mb-2">How to Interpret These Results</h5>
            <div className="text-sm text-blue-900 space-y-2">
              <p>• The Impact percentage shows how much more or less likely these categories are to occur together compared to what we would expect by chance.</p>
              <p>• A positive impact (e.g., +12.2%) means these categories appear together more often than expected.</p>
              <p>• A negative impact (e.g., -12.5%) means these categories appear together less often than expected.</p>
              <p>• "Expected Count" shows what we would expect if there was no relationship between the categories.</p>
              <p>• The relationship is {
                safeNumber(pair.value) < 0.1 ? "very weak" :
                safeNumber(pair.value) < 0.3 ? "weak" :
                safeNumber(pair.value) < 0.5 ? "moderate" :
                safeNumber(pair.value) < 0.7 ? "strong" :
                "very strong"
              } (Cramér's V = {(safeNumber(pair.value) * 100).toFixed(1)}%) and is {
                safeNumber(details.p_value) < 0.05 ? "statistically significant" : "not statistically significant"
              }.</p>
            </div>
          </div>
        </div>
      </div>
    );
  };
    

  if (!results || !selectedColumns?.length) return null;

  const sortedPairs = results.pairs
    ? [...results.pairs].sort((a, b) => b.value - a.value)
    : [];

  return (
    <div className="mt-8 space-y-6">
      {/* Overview Section */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">Analysis Results</h2>
        <div className="mb-4">
          <p className="text-lg">Selected Columns: {selectedColumns.join(", ")}</p>
          <p className="text-lg mt-2">
            Average Cramér's V: {results.average_cramers_v.toFixed(4)}
          </p>
          <p className="text-lg">Number of Valid Pairs: {results.valid_pairs}</p>
        </div>
      </div>

      {/* Detailed Analysis View */}
      {selectedPair && selectedPair.details && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          {renderDetailedAnalysis(selectedPair.details, selectedPair)}
        </div>
      )}

      {/* Bar Chart Section */}
      {barChartData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4">Top 10 Strongest Relationships</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} layout="vertical" margin={{ top: 20, right: 30, left: 100, bottom: 5 }}>
                <XAxis type="number" domain={[0, 1]} />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip />
                <Bar 
                  dataKey="value" 
                  fill="#3b82f6"
                  onClick={(data) => {
                    console.log("Bar clicked:", data);
                    setSelectedPair(data.pair);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Heatmap Section */}
      {selectedColumns.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4">Correlation Heatmap</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 border border-gray-200 bg-gray-100"></th>
                  {selectedColumns.map(col => (
                    <th key={col} className="p-2 border border-gray-200 bg-gray-100 text-sm transform -rotate-45 origin-bottom-left h-24 w-24">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedColumns.map(row => (
                  <tr key={row}>
                    <th className="p-2 border border-gray-200 bg-gray-100 text-left">{row}</th>
                    {selectedColumns.map(col => {
                      const cell = heatmapData[row]?.[col];
                      const value = cell?.value ?? 0;
                      return (
                        <td
                          key={`${row}-${col}`}
                          className="p-2 border border-gray-200 w-16 h-16 text-center cursor-pointer hover:opacity-80"
                          style={{
                            backgroundColor: getColorIntensity(value),
                            color: value > 0.5 ? 'white' : 'black'
                          }}
                          onClick={() => {
                            if (cell?.details) {
                              console.log("Heatmap cell clicked:", row, col);
                              setSelectedPair({
                                col1: row,
                                col2: col,
                                value: value,
                                details: cell.details
                              });
                            }
                          }}
                        >
                          {value.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Results Table */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">Detailed Results (Ranked by Strength)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-200 px-4 py-2">Rank</th>
                <th className="border border-gray-200 px-4 py-2">Column 1</th>
                <th className="border border-gray-200 px-4 py-2">Column 2</th>
                <th className="border border-gray-200 px-4 py-2">Cramér's V</th>
                <th className="border border-gray-200 px-4 py-2">Strength</th>
                <th className="border border-gray-200 px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPairs.map((pair, index) => {
                const strength = pair.value < 0.1 ? 'Very Weak' :
                              pair.value < 0.3 ? 'Weak' :
                              pair.value < 0.5 ? 'Moderate' :
                              pair.value < 0.7 ? 'Strong' : 'Very Strong';
                
                return (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-200 px-4 py-2 text-center">{index + 1}</td>
                    <td className="border border-gray-200 px-4 py-2">{pair.col1}</td>
                    <td className="border border-gray-200 px-4 py-2">{pair.col2}</td>
                    <td className="border border-gray-200 px-4 py-2">{pair.value.toFixed(4)}</td>
                    <td className="border border-gray-200 px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-sm ${getStrengthBadgeColor(strength)}`}>
                        {strength}
                      </span>
                    </td>
                    <td className="border border-gray-200 px-4 py-2">
                      <button
                        onClick={() => {
                          console.log("View Details clicked:", pair);
                          setSelectedPair(pair);
                        }}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const getStrengthBadgeColor = (strength) => {
  switch(strength) {
    case 'Very Strong': return 'bg-blue-700 text-white';
    case 'Strong': return 'bg-blue-500 text-white';
    case 'Moderate': return 'bg-blue-300 text-black';
    case 'Weak': return 'bg-blue-200 text-black';
    default: return 'bg-blue-100 text-black';
  }
};

const getColorIntensity = (value) => {
  if (value === undefined || value === null) return 'rgb(255, 255, 255)';
  const intensity = Math.floor(value * 255);
  return `rgb(${255 - intensity}, ${255 - intensity}, 255)`;
};

export default CsvAnalysisDashboard;
