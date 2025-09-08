/**
 * Google Apps Script for handling feedback from Specifys.ai
 * This script receives POST requests and saves feedback to Google Sheets
 */

function doPost(e) {
  try {
    // Log the incoming request for debugging
    console.log('=== INCOMING REQUEST ===');
    console.log('Request type:', e.postData.type);
    console.log('Request contents:', e.postData.contents);
    console.log('Request length:', e.postData.contents.length);
    
    // Parse the incoming data (supports both JSON and form data)
    let data;
    try {
      // Try to parse as JSON first
      data = JSON.parse(e.postData.contents);
      console.log('✅ Parsed as JSON successfully');
    } catch (jsonError) {
      // If JSON fails, try to parse as form data
      console.log('❌ JSON parsing failed, trying form data');
      const formData = e.postData.contents;
      const params = new URLSearchParams(formData);
      data = {
        email: params.get('email') || 'Not provided',
        feedback: params.get('feedback') || '',
        type: params.get('type') || 'general',
        source: params.get('source') || 'unknown'
      };
      console.log('✅ Parsed as form data successfully');
    }
    
    console.log('Parsed data:', data);
    
    // Get the active spreadsheet and sheet
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getActiveSheet();
    
    // Create headers if they don't exist
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp',
        'User Email', 
        'Feedback Text',
        'Type',
        'Source',
        'Status'
      ]);
      
      // Style the header row
      const headerRange = sheet.getRange(1, 1, 1, 6);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#0078d4');
      headerRange.setFontColor('white');
      headerRange.setHorizontalAlignment('center');
    }
    
    // Prepare the data row
    const timestamp = new Date();
    const userEmail = data.email || 'Not provided';
    const feedbackText = data.feedback || '';
    const feedbackType = data.type || 'general';
    const source = data.source || 'unknown';
    const status = 'New';
    
    // Append the feedback data
    sheet.appendRow([
      timestamp,
      userEmail,
      feedbackText,
      feedbackType,
      source,
      status
    ]);
    
    // Auto-resize columns for better readability
    sheet.autoResizeColumns(1, 6);
    
    // Add some formatting to the new row
    const lastRow = sheet.getLastRow();
    const newRowRange = sheet.getRange(lastRow, 1, 1, 6);
    
    // Add borders
    newRowRange.setBorder(true, true, true, true, true, true);
    
    // Highlight new feedback
    if (status === 'New') {
      newRowRange.setBackground('#e8f5e8');
    }
    
    // Format timestamp column
    sheet.getRange(lastRow, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    
    // Log the successful operation
    console.log(`✅ Feedback saved successfully: ${userEmail} - ${feedbackText.substring(0, 50)}...`);
    console.log(`📊 Row added: ${lastRow}`);
    
    // Return success response
    const response = {
      success: true,
      message: 'Feedback saved to Google Sheets',
      timestamp: timestamp.toISOString(),
      row: lastRow
    };
    
    console.log('📤 Sending response:', response);
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Log the error
    console.error('❌ Error processing feedback:', error.toString());
    console.error('❌ Error stack:', error.stack);
    
    // Return error response
    const errorResponse = {
      success: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 Sending error response:', errorResponse);
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Function to manually test the script
 * Run this function to test if everything is working
 */
function testFeedback() {
  // Simulate a POST request
  const testData = {
    email: 'test@example.com',
    feedback: 'This is a test feedback message to verify the script is working correctly.',
    type: 'test',
    source: 'manual-test'
  };
  
  // Create a mock event object
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  // Call doPost with mock data
  const result = doPost(mockEvent);
  console.log('Test result:', result.getContent());
}

/**
 * Function to set up the spreadsheet with proper formatting
 * Run this once to set up your spreadsheet
 */
function setupSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  
  // Clear existing content
  sheet.clear();
  
  // Add headers
  const headers = [
    'Timestamp',
    'User Email', 
    'Feedback Text',
    'Type',
    'Source',
    'Status'
  ];
  
  sheet.appendRow(headers);
  
  // Style the header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#0078d4');
  headerRange.setFontColor('white');
  headerRange.setHorizontalAlignment('center');
  
  // Set column widths
  sheet.setColumnWidth(1, 150); // Timestamp
  sheet.setColumnWidth(2, 200); // User Email
  sheet.setColumnWidth(3, 400); // Feedback Text
  sheet.setColumnWidth(4, 100); // Type
  sheet.setColumnWidth(5, 150); // Source
  sheet.setColumnWidth(6, 100); // Status
  
  // Freeze the header row
  sheet.setFrozenRows(1);
  
  console.log('Spreadsheet setup completed successfully!');
}

/**
 * Function to get feedback statistics
 * Returns summary of feedback data
 */
function getFeedbackStats() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return 'No feedback data available';
  }
  
  const dataRange = sheet.getRange(2, 1, lastRow - 1, 6);
  const data = dataRange.getValues();
  
  let totalFeedback = data.length;
  let withEmail = 0;
  let withoutEmail = 0;
  let types = {};
  let sources = {};
  
  data.forEach(row => {
    // Count emails
    if (row[1] && row[1] !== 'Not provided') {
      withEmail++;
    } else {
      withoutEmail++;
    }
    
    // Count types
    const type = row[3] || 'unknown';
    types[type] = (types[type] || 0) + 1;
    
    // Count sources
    const source = row[4] || 'unknown';
    sources[source] = (sources[source] || 0) + 1;
  });
  
  const stats = {
    totalFeedback: totalFeedback,
    withEmail: withEmail,
    withoutEmail: withoutEmail,
    types: types,
    sources: sources,
    lastUpdated: new Date().toISOString()
  };
  
  console.log('Feedback Statistics:', JSON.stringify(stats, null, 2));
  return stats;
}
