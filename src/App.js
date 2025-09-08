import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, Download, Table, Eye, Trash2, CheckCircle, BarChart3, Search, Filter, Grid3X3, Zap, Shield, Cpu, Database, FileSearch, TrendingUp } from 'lucide-react';

const PDFReaderTable = () => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('text');
  const [dragActive, setDragActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingStep, setProcessingStep] = useState('');

  const extractTextFromPDF = async (file) => {
    try {
      setProcessingStep('Reading PDF file...');
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let extractedText = '';
      
      setProcessingStep('Parsing PDF content...');
      
      // Convert to string for processing
      const pdfString = new TextDecoder('latin1').decode(uint8Array);
      
      // Method 1: Extract text from text objects (BT...ET blocks)
      const textObjects = pdfString.match(/BT(.*?)ET/gs) || [];
      let textFromObjects = '';
      
      textObjects.forEach(obj => {
        // Look for text showing commands like Tj, TJ, '
        const textCommands = obj.match(/\((.*?)\)\s*(?:Tj|TJ|')/g) || [];
        textCommands.forEach(cmd => {
          const text = cmd.match(/\((.*?)\)/);
          if (text && text[1]) {
            textFromObjects += text[1] + ' ';
          }
        });
        
        // Also look for array text commands
        const arrayCommands = obj.match(/\[(.*?)\]\s*TJ/g) || [];
        arrayCommands.forEach(cmd => {
          const matches = cmd.match(/\((.*?)\)/g) || [];
          matches.forEach(match => {
            const text = match.replace(/[()]/g, '');
            textFromObjects += text + ' ';
          });
        });
      });
      
      // Method 2: Extract from stream objects
      setProcessingStep('Extracting from data streams...');
      const streamObjects = pdfString.match(/stream\s*(.*?)\s*endstream/gs) || [];
      let textFromStreams = '';
      
      streamObjects.forEach(stream => {
        const content = stream.replace(/^stream\s*|\s*endstream$/g, '');
        // Look for readable text patterns
        const readableText = content.match(/[A-Za-z0-9\s.,;:!?'"@#$%&*()_+=\-\[\]{}|\\`~<>/]{4,}/g) || [];
        readableText.forEach(text => {
          if (text.trim().length > 3 && /[A-Za-z]/.test(text)) {
            textFromStreams += text + ' ';
          }
        });
      });
      
      // Method 3: Simple text extraction from the entire PDF
      setProcessingStep('Cleaning and formatting text...');
      const simpleTextMatches = pdfString.match(/\((.*?)\)/g) || [];
      let simpleText = '';
      
      simpleTextMatches.forEach(match => {
        const text = match.replace(/[()]/g, '');
        if (text.length > 1 && /[A-Za-z0-9]/.test(text)) {
          simpleText += text + ' ';
        }
      });
      
      // Combine all extraction methods
      extractedText = [textFromObjects, textFromStreams, simpleText]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Clean up the text
      extractedText = extractedText
        .replace(/[^\x20-\x7E\n\r\t]/g, '') // Remove non-printable characters
        .replace(/\s+/g, ' ')
        .trim();
      
      if (extractedText.length < 10) {
        throw new Error('Unable to extract readable text from this PDF. The file may be image-based, encrypted, or corrupted.');
      }
      
      setProcessingStep('Text extraction completed!');
      return extractedText;
    } catch (error) {
      throw error;
    }
  };

  const parseExtractedText = (text, fileName) => {
    try {
      setProcessingStep('Analyzing document structure...');
      const lines = text.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 0);
      const data = [];
      
      // Enhanced parsing patterns
      const patterns = {
        keyValue: [
          /^([A-Za-z\s]{2,40}):\s*(.{1,200})$/,
          /^([A-Za-z\s]{2,40})\s*[-=]\s*(.{1,200})$/,
          /^([A-Za-z\s]{2,40})\s+([A-Za-z0-9@.,\s$%#]{2,100})$/
        ],
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
        phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
        date: /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g,
        currency: /\$[\d,]+\.?\d*/g,
        number: /\b\d{1,10}(?:,\d{3})*(?:\.\d{1,4})?\b/g,
        url: /https?:\/\/[^\s]+/gi,
        zipcode: /\b\d{5}(?:-\d{4})?\b/g
      };
      
      // Try to find structured data
      let structuredData = [];
      let currentRecord = {};
      let recordCount = 0;
      
      setProcessingStep('Identifying data patterns...');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let foundPattern = false;
        
        // Try each key-value pattern
        for (const pattern of patterns.keyValue) {
          const match = line.match(pattern);
          if (match && match[1] && match[2]) {
            const key = match[1].trim();
            const value = match[2].trim();
            
            if (key.length > 1 && value.length > 0 && key !== value) {
              currentRecord[key] = value;
              foundPattern = true;
              break;
            }
          }
        }
        
        // If we have accumulated data and hit a non-matching line, save the record
        if (!foundPattern && Object.keys(currentRecord).length >= 2) {
          structuredData.push({ ...currentRecord, 'Record ID': ++recordCount });
          currentRecord = {};
        }
        
        // Also check for table-like data (multiple values separated by spaces/tabs)
        if (!foundPattern) {
          const parts = line.split(/\s{2,}|\t+/).filter(part => part.trim().length > 0);
          if (parts.length >= 3 && parts.length <= 8) {
            const tableRecord = {};
            parts.forEach((part, index) => {
              tableRecord[`Column ${index + 1}`] = part.trim();
            });
            if (Object.keys(tableRecord).length >= 2) {
              tableRecord['Record ID'] = ++recordCount;
              structuredData.push(tableRecord);
            }
          }
        }
      }
      
      // Save any remaining record
      if (Object.keys(currentRecord).length >= 2) {
        structuredData.push({ ...currentRecord, 'Record ID': ++recordCount });
      }
      
      setProcessingStep('Extracting metadata and statistics...');
      
      // Extract various data types
      const emails = text.match(patterns.email) || [];
      const phones = text.match(patterns.phone) || [];
      const dates = text.match(patterns.date) || [];
      const currencies = text.match(patterns.currency) || [];
      const urls = text.match(patterns.url) || [];
      const zipcodes = text.match(patterns.zipcode) || [];
      
      // Create comprehensive analysis
      const words = text.split(/\s+/).filter(word => word.length > 0);
      const uniqueWords = [...new Set(words.map(w => w.toLowerCase()))];
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 10);
      
      // Add document summary
      data.push({
        'Analysis Type': 'Document Summary',
        'File Name': fileName,
        'File Size': `${Math.round(uploadedFile?.size / 1024)} KB`,
        'Total Characters': text.length.toString(),
        'Total Words': words.length.toString(),
        'Unique Words': uniqueWords.length.toString(),
        'Sentences': sentences.length.toString(),
        'Paragraphs': paragraphs.length.toString(),
        'Processing Date': new Date().toLocaleString()
      });
      
      // Add data type analysis
      data.push({
        'Analysis Type': 'Data Pattern Analysis',
        'Email Addresses': emails.length.toString(),
        'Phone Numbers': phones.length.toString(),
        'Date Patterns': dates.length.toString(),
        'Currency Values': currencies.length.toString(),
        'URLs Found': urls.length.toString(),
        'Zip Codes': zipcodes.length.toString(),
        'Structured Records': structuredData.length.toString(),
        'Text Density': `${Math.round(words.length / Math.max(1, paragraphs.length))} words/paragraph`
      });
      
      // Add found emails
      [...new Set(emails)].slice(0, 10).forEach((email, index) => {
        data.push({
          'Data Type': 'Email Address',
          'Index': (index + 1).toString(),
          'Value': email,
          'Context': 'Found in document',
          'Verification': 'Pattern Match',
          'Source': fileName
        });
      });
      
      // Add found phone numbers
      [...new Set(phones)].slice(0, 10).forEach((phone, index) => {
        data.push({
          'Data Type': 'Phone Number',
          'Index': (index + 1).toString(),
          'Value': phone,
          'Context': 'Found in document',
          'Verification': 'Pattern Match',
          'Source': fileName
        });
      });
      
      // Add found dates
      [...new Set(dates)].slice(0, 10).forEach((date, index) => {
        data.push({
          'Data Type': 'Date',
          'Index': (index + 1).toString(),
          'Value': date,
          'Context': 'Found in document',
          'Verification': 'Pattern Match',
          'Source': fileName
        });
      });
      
      // Add structured data records
      structuredData.slice(0, 50).forEach(record => {
        data.push({
          ...record,
          'Data Type': 'Structured Data',
          'Source': fileName
        });
      });
      
      // If no structured data found, create word frequency analysis
      if (structuredData.length === 0) {
        setProcessingStep('Generating word frequency analysis...');
        const wordFreq = {};
        words.forEach(word => {
          const cleanWord = word.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
          if (cleanWord.length > 3) {
            wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
          }
        });
        
        const topWords = Object.entries(wordFreq)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 20);
        
        topWords.forEach(([word, count], index) => {
          data.push({
            'Analysis Type': 'Word Frequency',
            'Rank': (index + 1).toString(),
            'Word': word,
            'Frequency': count.toString(),
            'Percentage': `${((count / words.length) * 100).toFixed(2)}%`,
            'Source': fileName
          });
        });
      }
      
      setProcessingStep('Data analysis completed!');
      return data;
    } catch (parseError) {
      console.error('Parse error:', parseError);
      return [{
        'Error': 'Parse Error',
        'Message': parseError.message,
        'File': fileName,
        'Timestamp': new Date().toISOString()
      }];
    }
  };

  const handleFileUpload = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Please select a valid PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size too large. Please select a file smaller than 10MB.');
      return;
    }

    setUploadedFile(file);
    setLoading(true);
    setError('');
    setPdfText('');
    setTableData([]);
    setProcessingStep('Initializing...');

    try {
      const extractedText = await extractTextFromPDF(file);
      setPdfText(extractedText);
      
      const parsedData = parseExtractedText(extractedText, file.name);
      setTableData(parsedData);
      
      if (parsedData.length > 0) {
        setActiveTab('table');
      }
      setProcessingStep('');
    } catch (err) {
      setError(`Error processing PDF: ${err.message}`);
      setProcessingStep('');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const clearFile = () => {
    setUploadedFile(null);
    setPdfText('');
    setTableData([]);
    setError('');
    setActiveTab('text');
    setSearchTerm('');
    setProcessingStep('');
  };

  const downloadCSV = () => {
    if (tableData.length === 0) return;
    
    const headers = Object.keys(tableData[0]);
    const csvContent = [
      headers.join(','),
      ...tableData.map(row => headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${uploadedFile?.name?.replace('.pdf', '') || 'extracted_data'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    if (tableData.length === 0) return;
    
    const jsonContent = JSON.stringify(tableData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${uploadedFile?.name?.replace('.pdf', '') || 'extracted_data'}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredTableData = tableData.filter(row =>
    Object.values(row).some(value =>
      value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const getDataTypeColor = (dataType) => {
    const colors = {
      'Email Address': 'bg-blue-50 text-blue-700',
      'Phone Number': 'bg-green-50 text-green-700',
      'Date': 'bg-purple-50 text-purple-700',
      'Structured Data': 'bg-orange-50 text-orange-700',
      'Word Frequency': 'bg-gray-50 text-gray-700',
      'Document Summary': 'bg-indigo-50 text-indigo-700',
      'Data Pattern Analysis': 'bg-pink-50 text-pink-700'
    };
    return colors[dataType] || 'bg-gray-50 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Enhanced Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-white/20">
        <div className="max-w-8xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Database className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  DocuMind Pro
                </h1>
                <p className="text-sm text-gray-600">Advanced PDF Data Extraction & Analysis</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-4 py-2 bg-green-50 rounded-full border border-green-200">
                <Shield className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">Secure Processing</span>
              </div>
              <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-200">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">AI-Powered</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-8xl mx-auto px-6 py-8">
        {/* Enhanced Upload Card */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-xl border border-white/30 overflow-hidden mb-8">
          <div className="p-10">
            <div 
              className={`relative border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-500 ${
                dragActive 
                  ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-purple-50 scale-[1.02] shadow-lg' 
                  : uploadedFile 
                    ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 hover:shadow-lg'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {loading ? (
                <div className="space-y-8">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-gray-200 mx-auto"></div>
                    <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-transparent border-t-blue-600 animate-spin mx-auto"></div>
                    <div className="absolute inset-4 w-16 h-16 rounded-full border-4 border-transparent border-t-purple-600 animate-spin mx-auto animate-reverse"></div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-gray-800">Processing Document</h3>
                    <p className="text-lg text-gray-600">{processingStep || 'Analyzing your PDF...'}</p>
                    <div className="w-80 h-3 bg-gray-200 rounded-full mx-auto overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ) : !uploadedFile ? (
                <div className="space-y-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                    <Upload className="w-12 h-12 text-white" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-3xl font-bold text-gray-800">Upload Your PDF Document</h3>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                      Our advanced AI will extract, analyze, and structure all the data from your PDF. 
                      Support for forms, tables, contact information, and more.
                    </p>
                  </div>
                  <label className="group inline-flex items-center px-10 py-5 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white font-bold rounded-2xl hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl">
                    <FileSearch className="w-6 h-6 mr-4" />
                    Choose PDF File
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileUpload(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4" />
                      <span>Secure Processing</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4" />
                      <span>Max 10MB</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Database className="w-4 h-4" />
                      <span>Smart Extraction</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-gray-800">Document Ready for Analysis</h3>
                    <div className="flex items-center justify-center space-x-6 p-6 bg-white/80 rounded-2xl max-w-lg mx-auto shadow-lg">
                      <FileText className="w-8 h-8 text-blue-600" />
                      <div className="text-left">
                        <p className="font-bold text-gray-800 truncate max-w-64">{uploadedFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {Math.round(uploadedFile.size / 1024)} KB • PDF Document
                        </p>
                      </div>
                      <button
                        onClick={clearFile}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Error Alert */}
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-2xl p-8 mb-8 shadow-lg">
            <div className="flex items-start">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mr-6">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-800 mb-2">Processing Error</h3>
                <p className="text-red-700 text-lg">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Results Section */}
        {(pdfText || tableData.length > 0) && !loading && (
          <div className="space-y-8">
            {/* Enhanced Navigation Tabs */}
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-xl border border-white/30 overflow-hidden">
              <div className="border-b border-gray-100">
                <nav className="flex">
                  <button
                    onClick={() => setActiveTab('text')}
                    className={`flex items-center px-8 py-6 text-sm font-bold transition-all duration-300 ${
                      activeTab === 'text'
                        ? 'border-b-4 border-blue-600 text-blue-600 bg-gradient-to-br from-blue-50 to-purple-50'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <Eye className="w-6 h-6 mr-4" />
                    <div className="text-left">
                      <div className="text-lg">Extracted Text</div>
                      <div className="text-xs font-normal text-gray-500">
                        {pdfText.split('\n').filter(l => l.trim()).length} lines • {pdfText.split(' ').length} words
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('table')}
                    className={`flex items-center px-8 py-6 text-sm font-bold transition-all duration-300 ${
                      activeTab === 'table'
                        ? 'border-b-4 border-blue-600 text-blue-600 bg-gradient-to-br from-blue-50 to-purple-50'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <Database className="w-6 h-6 mr-4" />
                    <div className="text-left">
                      <div className="text-lg">Structured Data</div>
                      <div className="text-xs font-normal text-gray-500">
                        {tableData.length} records • {tableData.length > 0 ? Object.keys(tableData[0]).length : 0} fields
                      </div>
                    </div>
                  </button>
                </nav>
              </div>

              <div className="p-10">
                {activeTab === 'text' && (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-800">Raw Document Content</h3>
                        <p className="text-gray-600 mt-2 text-lg">Complete extracted text from your PDF document</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                          <BarChart3 className="w-5 h-5 text-blue-600" />
                          <span className="text-blue-700 font-bold">{pdfText.split(' ').length.toLocaleString()} words</span>
                        </div>
                        <div className="flex items-center space-x-3 px-4 py-2 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                          <Grid3X3 className="w-5 h-5 text-purple-600" />
                          <span className="text-purple-700 font-bold">{pdfText.length.toLocaleString()} chars</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-gray-700 p-8 max-h-[600px] overflow-y-auto shadow-2xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                        <span className="text-gray-400 text-sm font-mono">extracted_text.txt</span>
                      </div>
                      <pre className="text-sm text-green-400 font-mono leading-relaxed whitespace-pre-wrap overflow-wrap-anywhere">
                        {pdfText}
                      </pre>
                    </div>
                  </div>
                )}

                {activeTab === 'table' && (
                  <div className="space-y-8">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-800">Intelligent Data Analysis</h3>
                        <p className="text-gray-600 mt-2 text-lg">AI-extracted and structured information from your document</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search extracted data..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-4 py-3 w-64 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white/80 backdrop-blur-sm shadow-sm"
                          />
                        </div>
                        <button
                          onClick={downloadCSV}
                          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Export CSV
                        </button>
                        <button
                          onClick={downloadJSON}
                          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Export JSON
                        </button>
                      </div>
                    </div>

                    {filteredTableData.length > 0 ? (
                      <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gradient-to-r from-gray-50 via-blue-50 to-purple-50">
                              <tr>
                                <th className="w-20 px-6 py-5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  <div className="flex items-center space-x-2">
                                    <span>#</span>
                                    <TrendingUp className="w-4 h-4" />
                                  </div>
                                </th>
                                {Object.keys(filteredTableData[0]).map((header) => (
                                  <th key={header} className="px-6 py-5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-l border-gray-200">
                                    <div className="flex items-center space-x-2">
                                      <span className="truncate max-w-32">{header}</span>
                                      {header.toLowerCase().includes('type') && <Filter className="w-4 h-4" />}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white/50 backdrop-blur-sm divide-y divide-gray-100">
                              {filteredTableData.map((row, index) => (
                                <tr key={index} className="hover:bg-white/80 transition-all duration-200 hover:shadow-sm">
                                  <td className="px-6 py-4 text-sm font-bold text-gray-500">
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                                      {index + 1}
                                    </div>
                                  </td>
                                  {Object.entries(row).map(([key, value], cellIndex) => (
                                    <td key={cellIndex} className="px-6 py-4 text-sm border-l border-gray-100">
                                      <div className="flex items-center space-x-2">
                                        {key === 'Data Type' && (
                                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${getDataTypeColor(value)}`}>
                                            {value}
                                          </div>
                                        )}
                                        {key !== 'Data Type' && (
                                          <div className="font-medium text-gray-800 truncate max-w-xs" title={value}>
                                            {value}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Pagination info */}
                        <div className="bg-gray-50/80 backdrop-blur-sm px-6 py-4 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                              Showing <span className="font-semibold">{filteredTableData.length}</span> of{' '}
                              <span className="font-semibold">{tableData.length}</span> records
                            </div>
                            {searchTerm && (
                              <div className="flex items-center space-x-2 text-sm">
                                <Search className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">
                                  Filtered by: <span className="font-semibold">"{searchTerm}"</span>
                                </span>
                                <button
                                  onClick={() => setSearchTerm('')}
                                  className="text-blue-600 hover:text-blue-800 font-semibold ml-2"
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : tableData.length === 0 ? (
                      <div className="text-center py-20 bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 rounded-2xl border-2 border-dashed border-gray-300">
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                          <Database className="w-10 h-10 text-gray-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-4">No Data Extracted</h3>
                        <p className="text-gray-600 max-w-md mx-auto text-lg">
                          This PDF doesn't contain recognizable structured data. The document might be image-based or contain unstructured text only.
                        </p>
                        <div className="mt-6 p-4 bg-blue-50 rounded-xl max-w-lg mx-auto">
                          <p className="text-sm text-blue-700">
                            <strong>Tip:</strong> Try uploading PDFs with forms, tables, contact lists, or other organized data for best results.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-16 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl border-2 border-dashed border-yellow-300">
                        <div className="w-16 h-16 bg-yellow-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Search className="w-8 h-8 text-yellow-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">No matches found</h3>
                        <p className="text-gray-600">
                          No data matches your search term "<span className="font-semibold">{searchTerm}</span>". Try a different search.
                        </p>
                        <button
                          onClick={() => setSearchTerm('')}
                          className="mt-4 px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold"
                        >
                          Clear Search
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Analytics Dashboard */}
            {uploadedFile && tableData.length > 0 && (
              <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-xl border border-white/30 p-10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800 flex items-center space-x-3">
                      <TrendingUp className="w-7 h-7 text-blue-600" />
                      <span>Document Analytics</span>
                    </h3>
                    <p className="text-gray-600 mt-2">Comprehensive analysis of your extracted data</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="group p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                        <Database className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-blue-800">{tableData.length}</div>
                        <div className="text-sm font-semibold text-blue-600">Total Records</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="group p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border border-green-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                        <Grid3X3 className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-green-800">{tableData.length > 0 ? Object.keys(tableData[0]).length : 0}</div>
                        <div className="text-sm font-semibold text-green-600">Data Fields</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="group p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border border-purple-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                        <FileText className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-purple-800">{Math.round(uploadedFile.size / 1024)}</div>
                        <div className="text-sm font-semibold text-purple-600">File Size (KB)</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="group p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border border-orange-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                        <BarChart3 className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-orange-800">{pdfText.split(' ').length.toLocaleString()}</div>
                        <div className="text-sm font-semibold text-orange-600">Words Extracted</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Type Distribution */}
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h4 className="text-lg font-bold text-gray-800 mb-4">Data Type Distribution</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(
                      tableData.reduce((acc, item) => {
                        const type = item['Data Type'] || item['Analysis Type'] || 'Other';
                        acc[type] = (acc[type] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between p-3 bg-white/60 rounded-xl border border-gray-100">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${getDataTypeColor(type)}`}>
                          {type}
                        </div>
                        <span className="font-bold text-gray-700">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFReaderTable;
                        
