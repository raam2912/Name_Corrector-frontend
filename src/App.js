import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { marked } from 'marked'; // For rendering Markdown in report preview
import './App.css'; // Import the CSS file for styling

// Configure your backend URL
const BACKEND_URL = 'https://name-corrector-backend.onrender.com'; // <<< IMPORTANT: REPLACE THIS WITH YOUR RENDER BACKEND URL

function App() {
    // --- State Management ---
    const [fullName, setFullName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [birthTime, setBirthTime] = useState('');
    const [birthPlace, setBirthPlace] = useState('');
    const [desiredOutcome, setDesiredOutcome] = useState('');

    const [clientProfile, setClientProfile] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [confirmedSuggestions, setConfirmedSuggestions] = useState([]);

    const [customNameInput, setCustomNameInput] = useState('');
    const [liveValidationOutput, setLiveValidationOutput] = useState(null); // For live client-side calcs
    const [backendValidationResult, setBackendValidationResult] = useState(null); // For backend validation

    const [reportPreviewContent, setReportPreviewContent] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]); // Stores messages for chat context
    const [isValidationChatMode, setIsValidationChatMode] = useState(false);
    const [validationChatSuggestedName, setValidationChatSuggestedName] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, message: '' });

    // Refs for auto-scrolling chat messages
    const chatMessagesRef = useRef(null);

    // --- Utility Functions ---
    const showAlert = (message) => {
        setModal({ isOpen: true, message });
    };

    const closeModal = () => {
        setModal({ isOpen: false, message: '' });
    };

    // Debounce function to limit how often a function is called
    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    };

    // Effect to auto-scroll chat messages to the bottom when new messages arrive
    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // --- Frontend Numerology Calculation Functions (for live display) ---
    // These functions mirror the backend's core numerology calculations for client-side feedback.
    const cleanName = (name) => {
        return name.replace(/[^a-zA-Z\s]/g, '').toUpperCase();
    };

    const getChaldeanValue = (char) => {
        const chaldeanMap = {
            'A': 1, 'I': 1, 'J': 1, 'Q': 1, 'Y': 1,
            'B': 2, 'K': 2, 'R': 2,
            'C': 3, 'G': 3, 'L': 3, 'S': 3,
            'D': 4, 'M': 4, 'T': 4,
            'E': 5, 'H': 5, 'N': 5, 'X': 5,
            'U': 6, 'V': 6, 'W': 6,
            'O': 7, 'Z': 7,
            'F': 8, 'P': 8
        };
        return chaldeanMap[char.toUpperCase()] || 0;
    };

    const calculateSingleDigit = (number, allowMasterNumbers = true) => {
        if (allowMasterNumbers && [11, 22, 33].includes(number)) {
            return number;
        }
        while (number > 9) {
            number = String(number).split('').reduce((sum, digit) => sum + parseInt(digit), 0);
        }
        return number;
    };

    const calculateExpressionNumber = (name) => {
        let total = 0;
        const cleaned = cleanName(name);
        for (const char of cleaned) {
            total += getChaldeanValue(char);
        }
        return calculateSingleDigit(total, true);
    };

    const calculateBirthDayNumber = (birthDateStr) => {
        try {
            const day = parseInt(birthDateStr.split('-')[2]);
            if (isNaN(day) || day < 1 || day > 31) return 0;
            return calculateSingleDigit(day, true);
        } catch {
            return 0;
        }
    };

    const calculateLifePathNumber = (birthDateStr) => {
        try {
            const [year, month, day] = birthDateStr.split('-').map(Number);
            const monthReduced = calculateSingleDigit(month, true);
            const dayReduced = calculateSingleDigit(day, true);
            const yearSum = String(year).split('').reduce((sum, digit) => sum + parseInt(digit), 0);
            const yearReduced = calculateSingleDigit(yearSum, true);
            const total = monthReduced + dayReduced + yearReduced;
            return calculateSingleDigit(total, true);
        } catch {
            return 0;
        }
    };

    const calculateSoulUrgeNumber = (name) => {
        const VOWELS = new Set('AEIOU');
        let total = 0;
        const cleaned = cleanName(name);
        for (const char of cleaned) {
            if (VOWELS.has(char)) {
                total += getChaldeanValue(char);
            }
        }
        return calculateSingleDigit(total, true);
    };

    const calculatePersonalityNumber = (name) => {
        const VOWELS = new Set('AEIOU');
        let total = 0;
        const cleaned = cleanName(name);
        for (const char of cleaned) {
            if (!VOWELS.has(char) && char !== ' ') {
                total += getChaldeanValue(char);
            }
        }
        return calculateSingleDigit(total, true);
    };

    const calculateLoShuGrid = (birthDateStr, nameExpressionNum = null) => {
        const gridCounts = {};
        for (let i = 1; i <= 9; i++) gridCounts[i] = 0;

        try {
            const dobDigits = String(birthDateStr).replace(/-/g, '').split('').map(Number);
            dobDigits.forEach(digit => {
                if (digit >= 1 && digit <= 9) {
                    gridCounts[digit]++;
                }
            });
        } catch {}

        if (nameExpressionNum !== null) {
            const gridFriendlyExp = calculateSingleDigit(nameExpressionNum, false); // Reduce master numbers for grid
            if (gridFriendlyExp >= 1 && gridFriendlyExp <= 9) {
                gridCounts[gridFriendlyExp]++;
            }
        }

        const missingNumbers = Object.keys(gridCounts).filter(key => gridCounts[key] === 0).map(Number).sort((a, b) => a - b);
        
        return {
            grid_counts: gridCounts,
            missing_numbers: missingNumbers,
            has_8: gridCounts[8] > 0,
            has_5: gridCounts[5] > 0,
            has_6: gridCounts[6] > 0
        };
    };

    // --- UI Display Functions ---
    // Formats the client profile data into HTML for display
    const formatProfileData = (profile) => {
        if (!profile) return '<p>No profile data available.</p>';
        return `
            <h3 class="font-bold">Basic Info:</h3>
            <p><b>Full Name:</b> ${profile.full_name}</p>
            <p><b>Birth Date:</b> ${profile.birth_date}</p>
            ${profile.birth_time ? `<p><b>Birth Time:</b> ${profile.birth_time}</p>` : ''}
            ${profile.birth_place ? `<p><b>Birth Place:</b> ${profile.birth_place}</p>` : ''}
            <p><b>Desired Outcome:</b> ${profile.desired_outcome}</p>
            <hr class="my-2">
            <h3 class="font-bold">Core Numbers:</h3>
            <p><b>Expression Number:</b> ${profile.expression_number} (${profile.expression_details?.planetary_ruler || 'N/A'})</p>
            <p><b>Life Path Number:</b> ${profile.life_path_number}</p>
            <p><b>Birth Day Number:</b> ${profile.birth_day_number}</p>
            <p><b>Soul Urge Number:</b> ${profile.soul_urge_number}</p>
            <p><b>Personality Number:</b> ${profile.personality_number}</p>
            <hr class="my-2">
            <h3 class="font-bold">Lo Shu Grid:</h3>
            <p><b>Counts:</b> ${JSON.stringify(profile.lo_shu_grid?.grid_counts || {})}</p>
            <p><b>Missing Numbers:</b> ${profile.lo_shu_grid?.missing_numbers?.join(', ') || 'None'}</p>
            <hr class="my-2">
            <h3 class="font-bold">Conceptual Astro-Numerology:</h3>
            <p><b>Ascendant:</b> ${profile.astro_info?.ascendant_info?.sign || 'N/A'} (${profile.astro_info?.ascendant_info?.ruler || 'N/A'})</p>
            <p><b>Moon Sign:</b> ${profile.astro_info?.moon_sign_info?.sign || 'N/A'} (${profile.astro_info?.moon_sign_info?.ruler || 'N/A'})</p>
            <p><b>Planetary Compatibility:</b> ${profile.astro_info?.planetary_compatibility?.compatibility_flags?.join('; ') || 'No specific flags'}</p>
            <hr class="my-2">
            <h3 class="font-bold">Phonetic Vibration:</h3>
            <p><b>Harmony:</b> ${profile.phonetic_vibration?.is_harmonious ? 'Harmonious' : 'Needs consideration'} (Score: ${profile.phonetic_vibration?.score?.toFixed(2) || 'N/A'})</p>
            <p><i>"${profile.phonetic_vibration?.qualitative_description || 'N/A'}"</i></p>
            <hr class="my-2">
            <h3 class="font-bold">Insights & Forecast:</h3>
            <p><b>Compatibility Insights:</b> ${profile.compatibility_insights?.description || 'N/A'}</p>
            <p><b>Karmic Lessons:</b> ${profile.karmic_lessons?.lessons_summary?.map(l => l.lesson).join('; ') || 'None'}</p>
            <p><b>Karmic Debts (Birth Date):</b> ${profile.karmic_lessons?.birth_date_karmic_debts?.join(', ') || 'None'}</p>
            <p><b>Edge Cases:</b> ${profile.edge_cases?.map(ec => ec.type).join('; ') || 'None'}</p>
            <p><b>Current Personal Year:</b> ${profile.timing_recommendations?.current_personal_year || 'N/A'}</p>
            <p><b>Success Areas:</b> ${profile.success_areas?.combined_strengths?.join(', ') || 'N/A'}</p>
        `;
    };

    // Debounced function for live validation display and backend call
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const updateLiveValidationDisplay = useCallback(
        debounce((name) => {
            if (!name.trim() || !clientProfile) {
                setLiveValidationOutput(null);
                setBackendValidationResult(null);
                return;
            }

            // Client-side calculations for immediate feedback
            const expNum = calculateExpressionNumber(name);
            const birthDateStr = clientProfile.birth_date;
            const loShu = calculateLoShuGrid(birthDateStr, expNum);
            const birthDayNum = calculateBirthDayNumber(birthDateStr);
            const lifePathNum = calculateLifePathNumber(birthDateStr);
            const soulUrgeNum = calculateSoulUrgeNumber(name);
            const personalityNum = calculatePersonalityNumber(name);

            setLiveValidationOutput({
                name,
                expression_number: expNum,
                birth_day_number: birthDayNum,
                life_path_number: lifePathNum,
                soul_urge_number: soulUrgeNum,
                personality_number: personalityNum,
                lo_shu_grid_counts: loShu.grid_counts,
                lo_shu_missing_numbers: loShu.missing_numbers,
            });

            // Trigger backend validation for comprehensive rules
            validateCustomNameBackend(name);
        }, 300),
        [clientProfile] // Dependency array: recreate debounce if clientProfile changes
    );

    // Effect to trigger live validation when customNameInput or clientProfile changes
    useEffect(() => {
        if (clientProfile) {
            updateLiveValidationDisplay(customNameInput);
        }
    }, [customNameInput, clientProfile, updateLiveValidationDisplay]);


    // --- API Call Functions ---
    const getInitialSuggestions = async () => {
        if (!fullName || !birthDate || !desiredOutcome) {
            showAlert("Please fill in Full Name, Birth Date, and Desired Outcome.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.post(`${BACKEND_URL}/initial_suggestions`, {
                full_name: fullName,
                birth_date: birthDate,
                birth_time: birthTime,
                birth_place: birthPlace,
                desired_outcome: desiredOutcome
            });

            setClientProfile(response.data.profile_data);
            setSuggestions(response.data.suggestions);
            // Reset confirmed suggestions, report preview, and chat history for a new profile
            setConfirmedSuggestions([]);
            setReportPreviewContent('');
            setChatHistory([]);
            setValidationChatSuggestedName('');

            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            console.error('Error fetching initial suggestions:', error);
            showAlert(`Failed to get suggestions: ${error.response?.data?.error || error.message}`);
        }
    };

    const validateCustomNameBackend = async (name) => {
        if (!clientProfile) {
            setBackendValidationResult({ is_valid: false, rationale: "No client profile loaded." });
            return;
        }
        if (!name.trim()) {
            setBackendValidationResult(null);
            return;
        }

        try {
            const response = await axios.post(`${BACKEND_URL}/validate_name`, {
                suggested_name: name,
                client_profile: clientProfile
            });
            setBackendValidationResult(response.data);
        } catch (error) {
            console.error('Error validating custom name backend:', error);
            setBackendValidationResult({ is_valid: false, rationale: `Backend validation failed: ${error.response?.data?.error || error.message}` });
        }
    };

    const generateTextReport = async () => {
        if (!clientProfile) {
            showAlert("Please get initial suggestions first to generate a client profile.");
            return;
        }
        if (confirmedSuggestions.length === 0) {
            showAlert("Please confirm at least one name suggestion before generating a report.");
            return;
        }

        setIsLoading(true);
        try {
            const reportData = { ...clientProfile, confirmed_suggestions: confirmedSuggestions };
            const response = await axios.post(`${BACKEND_URL}/generate_text_report`, reportData);
            setReportPreviewContent(response.data.report_content);
            setIsLoading(false);
        }
        catch (error) {
            setIsLoading(false);
            console.error('Error generating text report:', error);
            showAlert(`Failed to generate text report: ${error.response?.data?.error || error.message}`);
        }
    };

    const generatePdfReport = async () => {
        if (!clientProfile) {
            showAlert("Please get initial suggestions first to generate a client profile.");
            return;
        }
        if (confirmedSuggestions.length === 0) {
            showAlert("Please confirm at least one name suggestion before generating a report.");
            return;
        }

        setIsLoading(true);
        try {
            const reportData = { ...clientProfile, confirmed_suggestions: confirmedSuggestions };
            const response = await axios.post(`${BACKEND_URL}/generate_pdf_report`, reportData, {
                responseType: 'blob', // Important for PDF download
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Numerology_Report_${fullName.replace(/ /g, '_')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url); // Clean up the URL object

            setIsLoading(false);
            showAlert("PDF report downloaded successfully!");
        } catch (error) {
            setIsLoading(false);
            console.error('Error generating PDF report:', error);
            showAlert(`Failed to download PDF report: ${error.response?.data?.error || error.message}`);
        }
    };

    const sendChatMessage = async () => {
        const message = chatInput.trim();
        // For general chat, message is required. For validation chat, current_message can be empty if just switching context.
        if (!message && !isValidationChatMode) return; 

        let chatPayload = { message, type: 'general_chat' };

        // If in validation chat mode, include profile and suggested name
        if (isValidationChatMode) {
            if (!clientProfile || !validationChatSuggestedName) {
                showAlert("Please select a name for validation chat or provide client profile first.");
                return;
            }
            chatPayload = {
                type: 'validation_chat',
                original_profile: clientProfile,
                suggested_name: validationChatSuggestedName,
                current_message: message, // The current message from the user
                chat_history: chatHistory.map(msg => ({ type: msg.sender === 'user' ? 'human' : 'ai', content: msg.message })) // Full history for context
            };
        }

        setChatHistory(prev => [...prev, { message, sender: 'user' }]); // Add user message to history
        setChatInput(''); // Clear input field
        setIsLoading(true);

        try {
            const response = await axios.post(`${BACKEND_URL}/chat`, chatPayload);
            setChatHistory(prev => [...prev, { message: response.data.response, sender: 'ai' }]); // Add AI response to history
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            console.error('Error sending chat message:', error);
            setChatHistory(prev => [...prev, { message: `Error: ${error.response?.data?.error || error.message}`, sender: 'ai' }]);
        }
    };

    const handleConfirmSuggestion = (suggestion) => {
        // Prevent adding duplicates to confirmed suggestions
        if (!confirmedSuggestions.some(s => s.name === suggestion.name)) {
            setConfirmedSuggestions(prev => [...prev, suggestion]);
            showAlert(`"${suggestion.name}" confirmed for report generation!`);
        } else {
            showAlert(`"${suggestion.name}" is already confirmed.`);
        }
        // Set this name as the context for validation chat and switch mode
        setValidationChatSuggestedName(suggestion.name);
        setIsValidationChatMode(true);
        setChatInput(`Tell me more about the numerological implications of "${suggestion.name}".`);
        setChatHistory(prev => [...prev, { message: `Switched to Validation Chat for "${suggestion.name}".`, sender: 'system' }]);
    };

    const toggleChatMode = () => {
        setIsValidationChatMode(prevMode => {
            const newMode = !prevMode;
            if (newMode) {
                // If switching to validation chat, try to set a default name if available
                if (!validationChatSuggestedName && confirmedSuggestions.length > 0) {
                    setValidationChatSuggestedName(confirmedSuggestions[0].name); // Default to first confirmed
                    showAlert("Switched to Validation Chat. Discussing your first confirmed name.");
                } else if (!validationChatSuggestedName && customNameInput.trim()) {
                    setValidationChatSuggestedName(customNameInput.trim()); // Or the custom typed name
                    showAlert("Switched to Validation Chat. Discussing your custom entered name.");
                } else if (!validationChatSuggestedName) {
                    // If no name context, prevent switching and alert
                    showAlert("Please confirm a name or enter one in the custom validation section to start a validation chat.");
                    return prevMode; // Stay in general chat if no name context
                }
                setChatInput(`Tell me more about "${validationChatSuggestedName}".`);
                setChatHistory(prev => [...prev, { message: `Switched to Validation Chat for "${validationChatSuggestedName}".`, sender: 'system' }]);
            } else {
                // If switching to general chat, clear validation context
                setValidationChatSuggestedName('');
                setChatInput('');
                setChatHistory(prev => [...prev, { message: "Switched to General Numerology Chat.", sender: 'system' }]);
            }
            return newMode;
        });
    };

    return (
        <div className="app-container">
            <div className="main-content-wrapper">

                {/* Left Column: Input Form & Profile Display */}
                <div className="column">
                    <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Sheelaa's Numerology Portal</h1>

                    {/* Input Form */}
                    <div className="section-card input-form-card">
                        <h2>Client Information</h2>
                        <input type="text" placeholder="Full Name (e.g., Rama Narayanan V)" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                        <input type="date" className="input-field" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                        <input type="time" placeholder="Birth Time (HH:MM, optional)" className="input-field" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
                        <input type="text" placeholder="Birth Place (optional)" className="input-field" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
                        <input type="text" placeholder="Desired Outcome (e.g., Success, Love, Career)" className="input-field" value={desiredOutcome} onChange={(e) => setDesiredOutcome(e.target.value)} />
                        <button onClick={getInitialSuggestions} className="primary-btn">Get Initial Suggestions</button>
                    </div>

                    {/* Profile Display */}
                    {clientProfile && (
                        <div className="section-card profile-display-card">
                            <h2>Client Numerology Profile</h2>
                            <div className="profile-details-content" dangerouslySetInnerHTML={{ __html: formatProfileData(clientProfile) }}>
                            </div>
                        </div>
                    )}

                    {/* Custom Name Validation */}
                    {clientProfile && (
                        <div className="section-card custom-validation-card">
                            <h2>Validate Custom Name</h2>
                            <input
                                type="text"
                                placeholder="Enter a name to validate..."
                                className="input-field"
                                value={customNameInput}
                                onChange={(e) => setCustomNameInput(e.target.value)}
                            />
                            {liveValidationOutput && (
                                <div className="live-validation-output section-card" style={{backgroundColor: '#ffffff', border: '1px solid #e9eceb', boxShadow: 'none'}}>
                                    <p className="font-bold">Live Calculated Values:</p>
                                    <p><b>Name:</b> {liveValidationOutput.name}</p>
                                    <p><b>Expression Number:</b> {liveValidationOutput.expression_number}</p>
                                    <p><b>Birth Day Number:</b> {liveValidationOutput.birth_day_number}</p>
                                    <p><b>Life Path Number:</b> {liveValidationOutput.life_path_number}</p>
                                    <p><b>Soul Urge Number:</b> {liveValidationOutput.soul_urge_number}</p>
                                    <p><b>Personality Number:</b> {liveValidationOutput.personality_number}</p>
                                    <p><b>Lo Shu Grid:</b> {JSON.stringify(liveValidationOutput.lo_shu_grid_counts)}</p>
                                    <p><b>Missing Lo Shu:</b> {liveValidationOutput.lo_shu_missing_numbers.join(', ') || 'None'}</p>
                                    {backendValidationResult && (
                                        <>
                                            <hr className="my-2" />
                                            <p><b>Backend Validation:</b> <span className={backendValidationResult.is_valid ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{backendValidationResult.is_valid ? 'VALID' : 'INVALID'}</span></p>
                                            <p><b>Rationale:</b> {backendValidationResult.rationale}</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column: Suggestions, Reports, Chat */}
                <div className="column">
                    {/* Initial Suggestions Display */}
                    {suggestions.length > 0 && (
                        <div className="section-card suggestions-display-card">
                            <h2>Suggested Name Variations</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                {suggestions[0]?.reasoning || 'Overall reasoning for suggestions.'}
                            </p>
                            <div className="suggestions-list-content">
                                {suggestions.map((s, index) => (
                                    <div key={index} className="suggestions-list-item">
                                        <h3>{s.name} (Expression: {s.expression_number})</h3>
                                        <p>{s.rationale}</p>
                                        <button
                                            onClick={() => handleConfirmSuggestion(s)}
                                            className={`primary-btn mt-3 ${confirmedSuggestions.some(cs => cs.name === s.name) ? 'disabled-btn' : ''}`}
                                            disabled={confirmedSuggestions.some(cs => cs.name === s.name)}
                                        >
                                            {confirmedSuggestions.some(cs => cs.name === s.name) ? 'Confirmed!' : 'Confirm This Name'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Report Generation */}
                    {clientProfile && (
                        <div className="section-card report-generation-card">
                            <h2>Generate Reports</h2>
                            <div className="text-sm text-gray-700 mb-3">
                                Confirmed Names for Report: {confirmedSuggestions.map(s => s.name).join(', ') || 'None'}
                            </div>
                            <button onClick={generateTextReport} className="secondary-btn mb-2">Generate Text Report (Preview)</button>
                            <button onClick={generatePdfReport} className="secondary-btn">Download Full Report (PDF)</button>
                            {reportPreviewContent && (
                                <div className="report-preview-area" dangerouslySetInnerHTML={{ __html: marked.parse(reportPreviewContent) }}>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Chat Interface */}
                    {clientProfile && (
                        <div className="section-card chat-interface-card">
                            <h2>Numerology Chat Assistant</h2>
                            <div ref={chatMessagesRef} className="chat-messages">
                                {chatHistory.map((msg, index) => (
                                    <div key={index} className={`chat-message ${msg.sender}`}>
                                        {msg.message}
                                    </div>
                                ))}
                            </div>
                            <div className="chat-input-wrapper">
                                <input
                                    type="text"
                                    placeholder={isValidationChatMode ? `Ask about "${validationChatSuggestedName || 'a selected name'}"...` : "Ask a general numerology question..."}
                                    className="input-field"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyPress={(e) => { if (e.key === 'Enter') sendChatMessage(); }}
                                />
                                <button onClick={sendChatMessage} className="primary-btn" style={{width: 'auto', flexShrink: 0}}>Send</button>
                            </div>
                            <div style={{marginTop: '8px'}}>
                                <button onClick={toggleChatMode} className="secondary-btn">
                                    {isValidationChatMode ? 'Switch to General Chat' : 'Switch to Validation Chat'}
                                </button>
                                {isValidationChatMode && !validationChatSuggestedName && (
                                    <p className="text-red-500 text-sm mt-1">Please confirm a name or enter one in the custom validation section to use validation chat.</p>
                                )}
                                {isValidationChatMode && validationChatSuggestedName && (
                                    <p className="text-green-600 text-sm mt-1">Validation Chat active for: <b>{validationChatSuggestedName}</b></p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="loading-overlay">
                    <div className="loader"></div>
                    <p>Loading...</p>
                </div>
            )}

            {/* Custom Modal for Alerts */}
            {modal.isOpen && (
                <div className="custom-modal">
                    <div className="modal-content">
                        <p className="modal-message">{modal.message}</p>
                        <button onClick={closeModal} className="primary-btn">OK</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
