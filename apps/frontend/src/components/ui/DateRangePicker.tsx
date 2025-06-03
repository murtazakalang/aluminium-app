import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

interface DateRangePickerProps {
  startDate?: Date | null;
  endDate?: Date | null;
  onDateChange: (startDate: Date | null, endDate: Date | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onDateChange,
  placeholder = 'Select date range',
  className = '',
  disabled = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleStartDateChange = (date: Date | null) => {
    onDateChange(date, endDate || null);
  };

  const handleEndDateChange = (date: Date | null) => {
    onDateChange(startDate || null, date);
  };

  const clearDates = () => {
    onDateChange(null, null);
  };

  const formatDateRange = () => {
    if (startDate && endDate) {
      return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    } else if (startDate) {
      return `From ${startDate.toLocaleDateString()}`;
    } else if (endDate) {
      return `Until ${endDate.toLocaleDateString()}`;
    }
    return placeholder;
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`
          flex items-center justify-between w-full px-3 py-2 text-sm border border-gray-300 rounded-md 
          cursor-pointer bg-white hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 
          focus-within:border-blue-500 transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`${startDate || endDate ? 'text-gray-900' : 'text-gray-500'}`}>
          {formatDateRange()}
        </span>
        <Calendar className="h-4 w-4 text-gray-400" />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <div className="flex flex-col space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <DatePicker
                selected={startDate}
                onChange={handleStartDateChange}
                maxDate={endDate || undefined}
                placeholderText="Select start date"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                calendarClassName="!font-sans"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                End Date
              </label>
              <DatePicker
                selected={endDate}
                onChange={handleEndDateChange}
                minDate={startDate || undefined}
                placeholderText="Select end date"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                calendarClassName="!font-sans"
              />
            </div>

            <div className="flex justify-between pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={clearDates}
                className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay to close picker when clicking outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
} 