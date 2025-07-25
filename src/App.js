import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked'; // Import marked for Markdown parsing

// Assuming your CSS files are correctly linked in public/index.html or imported here
import './index.css';
import './App.css'; // Make sure this is imported to apply the new styles

// Main App component
const App = () => {
    // State variables for main report form inputs and display
    const [fullName, setFullName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [birthTime, setBirthTime] = useState(''); // NEW: Birth Time
    const [birthPlace, setBirthPlace] = useState(''); // NEW: Birth Place
    const [desiredOutcome, setDesiredOutcome] = useState('');
    const [reportContent, setReportContent] = useState(''); // Stores the Markdown response from backend
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentNumerology, setCurrentNumerology] = useState(null); // Stores client-side calculated numerology
    
    // State to hold the full report data for PDF generation, allowing modifications
    const [fullReportDataForPdf, setFullReportDataForPdf] = useState(null); 
    // Editable content for the main report (for practitioner tailoring)
    const [editableMainReportContent, setEditableMainReportContent] = useState('');
    // Editable list of final suggested names (for practitioner tailoring)
    const [finalSuggestedNamesList, setFinalSuggestedNamesList] = useState([]);
    // Editable validation summary (for practitioner tailoring)
    const [editableValidationSummary, setEditableValidationSummary] = useState('');
    // Editable practitioner notes (for practitioner tailoring)
    const [editablePractitionerNotes, setEditablePractitionerNotes] = useState('');


    // State variables for NEW conversational name validation feature
    const [suggestedNameForChat, setSuggestedNameForChat] = useState(''); // Input for the name to validate in chat
    const [validationChatMessages, setValidationChatMessages] = useState([]); // Stores chat history: [{ sender: 'user'/'ai', text: '...' }]
    const [currentValidationInput, setCurrentValidationInput] = useState(''); // Current message in validation chat input
    const [isValidationChatLoading, setIsValidationChatLoading] = useState(false);
    const [validationChatError, setValidationChatError] = useState('');

    const validationChatEndRef = useRef(null); // Ref for auto-scrolling chat

    // IMPORTANT: This is the base URL for your deployed Render Flask backend.
    const BACKEND_BASE_URL = "https://name-corrector-backend.onrender.com"; // <<<--- VERIFY THIS IS YOUR ACTUAL RENDER URL!

    // --- Numerology Core Logic (duplicated in frontend for immediate display) ---
    // This client-side calculation is for immediate display of current numbers,
    // the backend will perform its own comprehensive calculations.
    const CHALDEAN_NUMEROLOGY_MAP = {
        'A': 1, 'J': 1, 'S': 1,
        'B': 2, 'K': 2, 'T': 2,
        'C': 3, 'G': 3, 'L': 3, 'U': 3,
        'D': 4, 'M': 4, 'V': 4,
        'E': 5, 'H': 5, 'N': 5, 'X': 5,
        'F': 6, 'O': 6, 'W': 6,
        'P': 7, 'Z': 7,
        'I': 8, 'R': 8
        // Note: 9 is NEVER used in Chaldean letter assignments
    };

    const NUMEROLOGY_INTERPRETATIONS = {
        1: "Leadership, independence, and new beginnings, empowering you to forge your own path.",
        2: "Cooperation, balance, and diplomacy, fostering harmonious relationships and partnerships.",
        3: "Creativity, self-expression, and optimism, enhancing communication and joyful interactions.",
        4: "Stability, diligent hard work, and building strong foundations for lasting security.",
        5: "Freedom, dynamic change, and adventure, embracing versatility and new experiences.",
        6: "Responsibility, nurturing, harmony, and selfless service, fostering love in family and community.",
        7: "Spirituality, deep introspection, analytical thought, and profound wisdom.",
        8: "Abundance, power, and material success, especially in material and leadership endeavors.",
        9: "Humanitarianism, compassion, and completion, signifying a wise, selfless, and universally loving nature.",
        11: "Heightened intuition, spiritual insight, and illumination (a Master Number for 2), inspiring others.",
        22: "The Master Builder, signifying large-scale achievement and practical idealism (a Master Number for 4).",
        33: "The Master Healer/Teacher, embodying compassionate service and universal love (a Master Number for 6)."
    };

    // Helper to reduce numbers for numerology, preserving Master Numbers 11, 22, 33
    const reduceNumber = (num, allowMasterNumbers = false) => {
        if (allowMasterNumbers && (num === 11 || num === 22 || num === 33)) {
            return num;
        }
        while (num > 9) {
            if (allowMasterNumbers && (num === 11 || num === 22 || num === 33)) {
                break;
            }
            num = String(num).split('').reduce((sum, digit) => sum + parseInt(digit), 0);
        }
        return num;
    };

    // Helper to calculate Chaldean Name Number (Expression Number)
    const calculateNameNumber = (name) => {
        let total = 0;
        const cleanedName = name.toUpperCase().replace(/[^A-Z]/g, '');
        for (let i = 0; i < cleanedName.length; i++) {
            const letter = cleanedName[i];
            if (CHALDEAN_NUMEROLOGY_MAP[letter]) {
                total += CHALDEAN_NUMEROLOGY_MAP[letter];
            }
        }
        return reduceNumber(total, false); // Expression is usually reduced to single digit unless it's a Master Number
    };

    // Helper to calculate Life Path Number (preserves Master Numbers)
    const calculateLifePathNumber = (birthDateStr) => {
        if (!birthDateStr) return 0;
        try {
            const parts = birthDateStr.split('-');
            if (parts.length !== 3) throw new Error("Invalid date format.");
            let year = parseInt(parts[0]);
            let month = parseInt(parts[1]);
            let day = parseInt(parts[2]);
            if (isNaN(year) || isNaN(month) || isNaN(day)) return 0;

            // Reduce month, day, and year components, preserving master numbers
            month = reduceNumber(month, true);
            day = reduceNumber(day, true);
            year = reduceNumber(year, true);
            
            let total = month + day + year;
            return reduceNumber(total, true); // Final reduction for Life Path, preserving master numbers
        } catch (e) {
            console.error("Error in calculateLifePathNumber:", e);
            return 0;
        }
    };

    // Helper to calculate Birth Day Number (day of birth only, preserves Master Numbers)
    const calculateBirthDayNumber = (birthDateStr) => {
        if (!birthDateStr) return 0;
        try {
            const parts = birthDateStr.split('-');
            if (parts.length !== 3) throw new Error("Invalid date format.");
            let day = parseInt(parts[2]);
            if (isNaN(day)) return 0;
            return reduceNumber(day, true); // Birth Day Number can also be a Master Number
        } catch (e) {
            console.error("Error in calculateBirthDayNumber:", e);
            return 0;
        }
    };

    // Effect to scroll to the bottom of the chat when messages update
    useEffect(() => {
        if (validationChatEndRef.current) {
            validationChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [validationChatMessages]);


    // Function to handle PDF download (calls backend endpoint)
    const handleDownloadPdf = async () => {
        setIsLoading(true); // Use main loading indicator for PDF generation
        setError('');

        // Ensure fullReportDataForPdf is available from initial report generation
        if (!fullReportDataForPdf) {
            setError('No base report data available to download. Please generate an initial report first.');
            setIsLoading(false);
            return;
        }

        // Create a mutable copy of the base report data
        const payloadForPdf = { ...fullReportDataForPdf };

        // Overwrite the main report content with the editable version
        payloadForPdf.intro_response = editableMainReportContent;

        // Overwrite the suggested names with the final, practitioner-selected/edited list
        payloadForPdf.suggested_names = {
            suggestions: finalSuggestedNamesList,
            reasoning: "These suggested names have been refined and validated through a detailed consultation." // Or a dynamic reasoning
        };

        // Add optional validation summary and practitioner notes
        if (editableValidationSummary.trim()) {
            payloadForPdf.validation_summary = editableValidationSummary;
        }
        if (editablePractitionerNotes.trim()) {
            payloadForPdf.practitioner_notes = editablePractitionerNotes;
        }

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/generate_pdf_report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payloadForPdf),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate PDF.');
            }

            // Get the filename from the Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `Numerology_Report_${fullName.replace(/\s+/g, '_') || 'report'}.pdf`;
            if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            alert('PDF report downloaded successfully!');

        } catch (err) {
            console.error('Error downloading PDF:', err);
            setError(`Failed to download PDF: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Main form submission handler (for initial report generation)
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setReportContent(''); // Clear previous report
        // Clear all validation/PDF related states when generating a new main report
        setValidationChatMessages([]);
        setCurrentValidationInput('');
        setSuggestedNameForChat('');
        setValidationChatError('');
        setCurrentNumerology(null); 
        setFullReportDataForPdf(null); 
        setEditableMainReportContent('');
        setFinalSuggestedNamesList([]);
        setEditableValidationSummary('');
        setEditablePractitionerNotes('');


        if (!fullName || !birthDate || !desiredOutcome) {
            setError('Please fill in all required fields: Full Name, Birth Date, and Desired Outcome.');
            return;
        }

        setIsLoading(true);

        try {
            // Calculate current numerology on frontend for immediate display
            const currentExpNum = calculateNameNumber(fullName);
            const currentLifePathNum = calculateLifePathNumber(birthDate);
            const currentBirthDayNum = calculateBirthDayNumber(birthDate); // Calculate Birth Day Number

            if (currentExpNum === 0 || currentLifePathNum === 0 || currentBirthDayNum === 0) {
                setError('Could not calculate initial numerology. Please check your inputs, especially the name (letters only) and date (YYYY-MM-DD).');
                setIsLoading(false);
                return;
            }

            // Set current numerology state for display
            setCurrentNumerology({
                expression: currentExpNum,
                lifePath: currentLifePathNum,
                birthDayNumber: currentBirthDayNum, // Use Birth Day Number
                explanation: `Your current name's energy (${currentExpNum}) resonates with ${NUMEROLOGY_INTERPRETATIONS[currentExpNum] || "a unique path."}. ` +
                                     `Your life path (${currentLifePathNum}) indicates ${NUMEROLOGY_INTERPRETATIONS[currentLifePathNum] || "a unique life journey."}. ` +
                                     `Your birth day number (${currentBirthDayNum}) influences your daily characteristics and talents.`
            });

            // Construct the message for the AI agent on the backend for initial report
            // Include birthTime and birthPlace
            const message = `GENERATE_ADVANCED_REPORT: My full name is "${fullName}" and my birth date is "${birthDate}". My current Name (Expression) Number is ${currentExpNum} and Life Path Number is ${currentLifePathNum}. My birth time is "${birthTime}" and my birth place is "${birthPlace}". I desire the following positive outcome in my life: "${desiredOutcome}".`;

            // Make API call to your Flask backend's /chat endpoint
            const res = await fetch(`${BACKEND_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            setReportContent(data.response); // Store the raw Markdown response for display
            setEditableMainReportContent(data.response); // Initialize editable content
            setFullReportDataForPdf(data.full_report_data_for_pdf); // Store the full structured data for PDF generation
            
            // Initialize final suggested names from the initial report's suggestions
            if (data.full_report_data_for_pdf && data.full_report_data_for_pdf.suggested_names && data.full_report_data_for_pdf.suggested_names.suggestions) {
                setFinalSuggestedNamesList(data.full_report_data_for_pdf.suggested_names.suggestions);
            }


        } catch (err) {
            console.error('Error fetching data:', err);
            setError(`Failed to get a response from the AI: ${err.message}. Please ensure your backend is running and its URL is correct.`);
        } finally {
            setIsLoading(false);
        }
    };

    // Function to handle starting or continuing the validation chat
    const handleValidationChatSubmit = async (e) => {
        e.preventDefault();
        setValidationChatError('');

        // Ensure original profile data is available from the main form
        if (!fullName || !birthDate || !desiredOutcome) {
            setValidationChatError('Please fill in your Full Name, Birth Date, and Desired Outcome in the top form before starting name validation.');
            return;
        }

        // Determine if it's the very first message for this validation session
        const isInitialMessage = validationChatMessages.length === 0;
        let userMessageContent = currentValidationInput.trim();

        if (isInitialMessage) {
            if (!suggestedNameForChat.trim()) {
                setValidationChatError('Please enter a Suggested Name to Validate to start the chat.');
                return;
            }
            // For the initial message, include the suggested name and full profile context
            // Include birthTime and birthPlace in the initial chat message profile
            userMessageContent = `INITIATE_VALIDATION_CHAT: Suggested Name: "${suggestedNameForChat.trim()}". My original profile: Full Name: "${fullName}", Birth Date: "${birthDate}", Birth Time: "${birthTime}", Birth Place: "${birthPlace}", Desired Outcome: "${desiredOutcome}". My current Expression Number is ${calculateNameNumber(fullName)} and Life Path Number is ${calculateLifePathNumber(birthDate)}. My Birth Number is ${calculateBirthDayNumber(birthDate)}.`;
        } else {
            if (!userMessageContent) {
                setValidationChatError('Please type a message.');
                return;
            }
        }

        // Add user's message to chat history
        const newUserMessage = { sender: 'user', text: userMessageContent };
        setValidationChatMessages(prevMessages => [...prevMessages, newUserMessage]);
        setCurrentValidationInput(''); // Clear input field

        setIsValidationChatLoading(true);

        try {
            // Prepare the payload for the backend
            const payload = {
                type: 'validation_chat',
                original_profile: {
                    fullName: fullName,
                    birthDate: birthDate,
                    birthTime: birthTime, // NEW
                    birthPlace: birthPlace, // NEW
                    desiredOutcome: desiredOutcome,
                    currentExpressionNumber: calculateNameNumber(fullName),
                    currentLifePathNumber: calculateLifePathNumber(birthDate),
                    currentBirthNumber: calculateBirthDayNumber(birthDate), // Use Birth Day Number
                },
                suggested_name: suggestedNameForChat.trim(), // Always send the suggested name for context
                chat_history: [...validationChatMessages, newUserMessage], // Send the entire history
                current_message: userMessageContent // Send the latest message separately for backend parsing
            };

            const res = await fetch(`${BACKEND_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            const aiResponseText = data.response;

            // Add AI's response to chat history
            setValidationChatMessages(prevMessages => [...prevMessages, { sender: 'ai', text: aiResponseText }]);

        } catch (err) {
            console.error('Error in validation chat:', err);
            setValidationChatError(`Failed to get a response from the AI: ${err.message}.`);
            // If error, remove the last user message to allow retry
            setValidationChatMessages(prevMessages => prevMessages.slice(0, -1));
        } finally {
            setIsValidationChatLoading(false);
        }
    };

    // Function to reset the validation chat
    const resetValidationChat = () => {
        setSuggestedNameForChat('');
        setValidationChatMessages([]);
        setCurrentValidationInput('');
        setValidationChatError('');
        setEditableValidationSummary(''); // Clear summary when chat resets
    };

    // Function to handle adding/removing/editing suggested names in the final list
    const handleFinalSuggestedNameChange = (index, field, value) => {
        const updatedList = [...finalSuggestedNamesList];
        updatedList[index][field] = value;
        setFinalSuggestedNamesList(updatedList);
    };

    const addFinalSuggestedName = () => {
        setFinalSuggestedNamesList([...finalSuggestedNamesList, { name: '', rationale: '', expression_number: 0 }]);
    };

    const removeFinalSuggestedName = (index) => {
        const updatedList = finalSuggestedNamesList.filter((_, i) => i !== index);
        setFinalSuggestedNamesList(updatedList);
    };


    return (
        <div className="app-container">
            <div className="content-area"> {/* New wrapper for content */}
                <header className="header-section">
                    <h1 className="main-heading">
                        <span role="img" aria-label="sparkles">✨</span>Unlock Your Destiny
                    </h1>
                    <p className="sub-heading">
                        Discover the profound influence of your name and birth date. Get AI-powered corrections and validate your own name ideas.
                    </p>
                </header>

                {/* Section for Initial Report Generation */}
                <section className="card-section">
                    <h2 className="section-heading">
                        <span role="img" aria-label="form icon">📝</span>Generate Personalized Report
                    </h2>
                    <form onSubmit={handleSubmit} className="form-layout">
                        <div className="form-group">
                            <label htmlFor="fullName" className="form-label">
                                Your Full Name (as currently used) <span className="required-star">*</span>
                            </label>
                            <input
                                type="text"
                                id="fullName"
                                className="input-field"
                                placeholder="e.g., Emily Rose Thompson"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group-row"> {/* New Flex Container for Date and Time */}
                            <div className="form-group flex-item">
                                <label htmlFor="birthDate" className="form-label">
                                    Your Birth Date <span className="required-star">*</span>
                                </label>
                                <input
                                    type="date"
                                    id="birthDate"
                                    className="input-field"
                                    value={birthDate}
                                    onChange={(e) => setBirthDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group flex-item">
                                <label htmlFor="birthTime" className="form-label">
                                    Your Birth Time (Optional, for deeper insights)
                                </label>
                                <input
                                    type="time"
                                    id="birthTime"
                                    className="input-field"
                                    value={birthTime}
                                    onChange={(e) => setBirthTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="birthPlace" className="form-label">
                                Your Birth Place (City, Country - Optional, for deeper insights)
                            </label>
                            <input
                                type="text"
                                id="birthPlace"
                                className="input-field"
                                placeholder="e.g., London, UK"
                                value={birthPlace}
                                onChange={(e) => setBirthPlace(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="desiredOutcome" className="form-label">
                                What positive outcome do you desire in your life? <span className="required-star">*</span> <br/><span className="sub-heading-small">(e.g., more success, better relationships, inner peace)</span>
                            </label>
                            <textarea
                                id="desiredOutcome"
                                rows="4"
                                className="textarea-field"
                                placeholder="I wish for greater financial abundance and a harmonious family life."
                                value={desiredOutcome}
                                onChange={(e) => setDesiredOutcome(e.target.value)}
                                required
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            className="primary-button"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="flex-center">
                                    <div className="spinner"></div>
                                    Generating Insights...
                                </span>
                            ) : (
                                <span className="flex-center">
                                    <span role="img" aria-label="magic wand" className="emoji-icon">🪄</span>
                                    Get My Personalized Numerology
                                </span>
                            )}
                        </button>
                    </form>
                </section>

                {error && (
                    <div className="error-message" role="alert">
                        <p><strong>Error:</strong></p>
                        <p>{error}</p>
                    </div>
                )}

                {/* The numerology report content, now with an ID for PDF generation */}
                {currentNumerology && (
                    <section className="card-section">
                        <h2 className="section-heading">Your Numerology Profile</h2>

                        <div className="numerology-summary-box">
                            <h3>
                                <span role="img" aria-label="current numbers">🔢</span> Your Current Numerology:
                            </h3>
                            <p>
                                <span className="numerology-number-label">Name (Expression/Destiny) Number:</span> <span className="numerology-number-value">{currentNumerology.expression}</span>
                            </p>
                            <p>
                                <span className="numerology-number-label">Life Path Number:</span> <span className="numerology-number-value">{currentNumerology.lifePath}</span>
                            </p>
                            {/* Display Birth Day Number */}
                            <p>
                                <span className="numerology-number-label">Birth Day Number (Day of Birth):</span> <span className="numerology-number-value">{currentNumerology.birthDayNumber}</span>
                            </p>
                            <p className="numerology-explanation">{currentNumerology.explanation}</p>
                        </div>

                        {reportContent && (
                            <>
                                <h3 className="sub-section-heading">
                                    <span role="img" aria-label="lightbulb">💡</span> Personalized Name Corrections (Initial AI Suggestions):
                                </h3>
                                {/* Display the initial AI-generated report content in an editable textarea */}
                                <div className="form-group">
                                    <label htmlFor="editableMainReportContent" className="form-label">
                                        Edit Main Report Content:
                                    </label>
                                    {/* Render the report content fully using dangerouslySetInnerHTML */}
                                    <div 
                                        className="full-report-display" 
                                        dangerouslySetInnerHTML={{ __html: marked.parse(editableMainReportContent) }} 
                                    />
                                    {/* The textarea is still available for editing, but now it's below the rendered view */}
                                    <textarea
                                        id="editableMainReportContent"
                                        className="textarea-field"
                                        rows="15"
                                        value={editableMainReportContent}
                                        onChange={(e) => setEditableMainReportContent(e.target.value)}
                                        style={{marginTop: '20px'}} /* Add space between display and editor */
                                    ></textarea>
                                    <p className="hint-text">
                                        This content will be included in the PDF. You can edit it as needed. The view above is how it will appear.
                                    </p>
                                </div>
                            </>
                        )}
                        <p className="footer-text">
                            These suggestions are generated by AI based on numerological principles and your desired outcomes.
                            Remember, the power to choose your path lies within you.
                        </p>
                    </section>
                )}

                {/* Separator and Name Validation Section - NOW A CHAT INTERFACE */}
                {reportContent && ( // Only show validation if a report has been generated
                    <section className="card-section">
                        <h2 className="section-heading">
                            <span role="img" aria-label="validate icon">💬</span> Conversational Name Validation
                        </h2>
                        <p className="sub-heading">
                            Engage with the AI to explore and validate potential name changes. Provide a name to start, and the AI will guide you with questions.
                        </p>

                        <div className="validation-chat-container">
                            {/* Input for the suggested name (only visible if chat hasn't started) */}
                            {validationChatMessages.length === 0 && (
                                <div className="form-group">
                                    <label htmlFor="suggestedNameForChat" className="form-label">
                                        Suggested Name to Validate (e.g., Emily Rose) <span className="required-star">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="suggestedNameForChat"
                                        className="input-field"
                                        placeholder="Enter the name you want to validate"
                                        value={suggestedNameForChat}
                                        onChange={(e) => setSuggestedNameForChat(e.target.value)}
                                        required
                                        disabled={isValidationChatLoading}
                                    />
                                </div>
                            )}

                            {/* Chat display area */}
                            <div className="chat-messages-display">
                                {validationChatMessages.length === 0 && (
                                    <div className="chat-welcome-message">
                                        Enter a name above and click "Start Validation Chat" to begin.
                                    </div>
                                )}
                                {validationChatMessages.map((msg, index) => (
                                    <div key={index} className={`chat-message ${msg.sender}`}>
                                        <div className="message-bubble" dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }} />
                                    </div>
                                ))}
                                {isValidationChatLoading && (
                                    <div className="chat-message ai">
                                        <div className="message-bubble">
                                            <div className="spinner small"></div> AI is typing...
                                        </div>
                                    </div>
                                )}
                                <div ref={validationChatEndRef} /> {/* Scroll target */}
                            </div>

                            {validationChatError && (
                                <div className="error-message" role="alert" style={{marginTop: '15px'}}>
                                    <p><strong>Error:</strong></p>
                                    <p>{validationChatError}</p>
                                </div>
                            )}

                            {/* Chat input form */}
                            <form onSubmit={handleValidationChatSubmit} className="chat-input-form">
                                <textarea
                                    className="textarea-field chat-input"
                                    placeholder={validationChatMessages.length === 0 ? "Type your initial message or just click 'Start Validation Chat'" : "Type your reply (e.g., 'Final validation report for Emily Rose')..."}
                                    value={currentValidationInput}
                                    onChange={(e) => setCurrentValidationInput(e.target.value)}
                                    rows="2"
                                    disabled={isValidationChatLoading || (!suggestedNameForChat.trim() && validationChatMessages.length === 0)}
                                />
                                <button
                                    type="submit"
                                    className="primary-button chat-send-button"
                                    disabled={isValidationChatLoading || (!suggestedNameForChat.trim() && validationChatMessages.length === 0 && !currentValidationInput.trim())}
                                >
                                    {isValidationChatLoading ? (
                                        <div className="spinner small"></div>
                                    ) : (
                                        validationChatMessages.length === 0 ? "Start Validation Chat" : "Send"
                                    )}
                                </button>
                                {validationChatMessages.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={resetValidationChat}
                                        className="secondary-button reset-chat-button"
                                        disabled={isValidationChatLoading}
                                    >
                                        Reset Chat
                                    </button>
                                )}
                            </form>
                        </div>
                    </section>
                )}

                {/* Practitioner Customization Section (Editable Suggested Names, Validation Summary, Notes) */}
                {reportContent && ( // Only show this section if a report has been generated
                    <section className="card-section">
                        <h2 className="section-heading">
                            <span role="img" aria-label="customize icon">🛠️</span> Final Report Customization
                        </h2>
                        <p className="sub-heading">
                            Review and refine the suggested names, add validation conclusions, and include any personal notes before generating the final PDF.
                        </p>

                        {/* Editable Suggested Names List */}
                        <div className="customization-group">
                            <h3 className="sub-section-heading">
                                <span role="img" aria-label="name tag">🏷️</span> Final Suggested Names for PDF:
                            </h3>
                            {finalSuggestedNamesList.length === 0 && (
                                <p className="hint-text">
                                    No names added yet. Click "Add Name" to include suggestions in the PDF.
                                </p>
                            )}
                            {finalSuggestedNamesList.map((suggestion, index) => (
                                <div key={index} className="name-suggestion-item">
                                    <div className="form-group">
                                        <label className="form-label">Name:</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={suggestion.name}
                                            onChange={(e) => handleFinalSuggestedNameChange(index, 'name', e.target.value)}
                                            placeholder="e.g., Emily Rose"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Expression Number:</label>
                                        <input
                                            type="number"
                                            className="input-field"
                                            value={suggestion.expression_number}
                                            onChange={(e) => handleFinalSuggestedNameChange(index, 'expression_number', parseInt(e.target.value) || 0)}
                                            placeholder="e.g., 5"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Rationale:</label>
                                        <textarea
                                            className="textarea-field"
                                            rows="3"
                                            value={suggestion.rationale}
                                            onChange={(e) => handleFinalSuggestedNameChange(index, 'rationale', e.target.value)}
                                            placeholder="Explain the numerological benefits of this name."
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeFinalSuggestedName(index)}
                                        className="secondary-button remove-button"
                                    >
                                        Remove Name
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addFinalSuggestedName}
                                className="secondary-button add-button"
                            >
                                Add New Suggested Name
                            </button>
                        </div>

                        <div className="customization-group">
                            <h3 className="sub-section-heading">
                                <span role="img" aria-label="summary icon">📋</span> Validation Chat Summary (for PDF):
                            </h3>
                            <div className="form-group">
                                <textarea
                                    className="textarea-field"
                                    rows="8"
                                    value={editableValidationSummary}
                                    onChange={(e) => setEditableValidationSummary(e.target.value)}
                                    placeholder="Summarize the key conclusions from the validation chat here. This will be included in the PDF."
                                ></textarea>
                                <p className="hint-text">
                                    You can copy and paste the final validation report from the chat above, or write your own summary.
                                </p>
                            </div>
                        </div>

                        <div className="customization-group">
                            <h3 className="sub-section-heading">
                                <span role="img" aria-label="notes icon">✍️</span> Practitioner's Private Notes (for PDF):
                            </h3>
                            <div className="form-group">
                                <textarea
                                    className="textarea-field"
                                    rows="8"
                                    value={editablePractitionerNotes}
                                    onChange={(e) => setEditablePractitionerNotes(e.target.value)}
                                    placeholder="Add any additional private notes, observations, or specific guidance for the client that you want included in the PDF report."
                                ></textarea>
                                <p className="hint-text">
                                    This section is for any extra details you want to include in the final client report.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleDownloadPdf}
                            className="primary-button download-button"
                            disabled={isLoading || !fullReportDataForPdf}
                        >
                            <span className="flex-center">
                                <span role="img" aria-label="download icon" className="emoji-icon">⬇️</span>
                                Generate & Download Final PDF Report
                            </span>
                        </button>
                    </section>
                )}
            </div>
        </div>
    );
};

export default App;
