async function generateSpecificationOriginal() {
  console.log('Starting generateSubmissionFromProcessingNoviceJs');
  
  // Prepare form data
  const yesNoQuestions = [
    "Does your app require a user account system?",
    "Does your app use or integrate with AI features?",
    "Will your app be free to use?",
    "Does your app need to send notifications?",
    "Does your app need to work offline?",
    "Will your app support multiple languages?",
    "Does your app require integration with social media?",
    "Will your app collect user data for analytics?"
  ];

  const formData = {
    idea: answers[0] || '',
    topic: 'App Development',
    platform: 'Mobile (iOS and Android)',
    answers: {
      "0": answers[0] || '',
      "1": answers[1] || '',
      "2": answers[2] || '',
      "3": answers[3] || '',
      "4": answers[4] || '',
      "5": yesNoQuestions.reduce((acc, _, index) => {
        acc[`yesNo_${index}`] = answers[`yesNo_${index}`] || 'No';
        return acc;
      }, {}),
      "6": answers[6] || ''
    }
  };

  console.log('Form data:', JSON.stringify(formData, null, 2));

  try {
    const response = await fetch('https://newnocodespec.shalom-cohen-111.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    console.log('API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API error:', errorData);
      throw new Error(`API request failed: ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Generated content length:', data.specification.length);

    localStorage.setItem('generatedContent', data.specification);
    console.log('Redirecting to: result-novice.html');
    window.location.href = 'result-novice.html';
  } catch (error) {
    console.error('Error in generateSpecificationOriginal:', error.message);
    throw error;
  }
}