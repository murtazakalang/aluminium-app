export const downloadCSV = (csvContent: string, filename: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const formatCSVRow = (row: (string | number)[]): string => {
  return row.map(cell => 
    typeof cell === 'string' && cell.includes(',') 
      ? `"${cell.replace(/"/g, '""')}"` 
      : cell.toString()
  ).join(',');
};

export const arrayToCSV = (data: (string | number)[][]): string => {
  return data.map(row => formatCSVRow(row)).join('\n');
}; 