import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { marked } from 'marked'; // For rendering Markdown in report preview
import debounce from 'lodash.debounce'; // Correctly imported debounce

import './App.css'; // Import the CSS file for styling

// Configure your backend URL
const BACKEND_URL = 'https://name-corrector-backend.onrender.com'; // <<< IMPORTANT: REPLACE THIS WITH YOUR RENDER BACKEND URL


// --- Client-Side Numerology Calculation Functions (Ported from Backend) ---
// These are essential for live updates without constant server calls.

const CHALDEAN_MAP = {
    'A': 1, 'I': 1, 'J': 1, 'Q': 1, 'Y': 1,
    'B': 2, 'K': 2, 'R': 2,
    'C': 3, 'G': 3, 'L': 3, 'S': 3,
    'D': 4, 'M': 4, 'T': 4,
    'E': 5, 'H': 5, 'N': 5, 'X': 5,
    'U': 6, 'V': 6, 'W': 6,
    'O': 7, 'Z': 7,
    'F': 8, 'P': 8
};

const MASTER_NUMBERS = new Set([11, 22, 33]);
const KARMIC_DEBT_NUMBERS = new Set([13, 14, 16, 19]);
const VOWELS = new Set('AEIOU');

function cleanName(name) {
    return name.replace(/[^a-zA-Z\s]/g, '').toUpperCase();
}

function getChaldeanValue(char) {
    return CHALDEAN_MAP[char] || 0;
}

function calculateSingleDigit(number, allowMasterNumbers = true) {
    if (allowMasterNumbers && MASTER_NUMBERS.has(number)) {
        return number;
    }
    while (number > 9) {
        number = String(number).split('').reduce((sum, digit) => sum + parseInt(digit, 10), 0);
        if (allowMasterNumbers && MASTER_NUMBERS.has(number)) {
            break; // Stop reduction if a Master Number is reached and allowed
        }
    }
    return number;
}

function calculateFirstNameValue(fullName) {
    const cleanedName = cleanName(fullName);
    const firstName = cleanedName.split(' ')[0];
    let total = 0;
    for (const char of firstName) {
        total += getChaldeanValue(char);
    }
    return calculateSingleDigit(total, false); // First name value usually reduced to single digit
}

function calculateExpressionNumber(fullName) {
    const cleanedName = cleanName(fullName);
    let total = 0;
    for (const char of cleanedName) {
        total += getChaldeanValue(char);
    }
    return calculateSingleDigit(total, true); // Expression number preserves Master Numbers
}

function calculateSoulUrgeNumber(fullName) {
    const cleanedName = cleanName(fullName);
    let total = 0;
    for (const char of cleanedName) {
        if (VOWELS.has(char)) {
            total += getChaldeanValue(char);
        }
    }
    return calculateSingleDigit(total, true); // Soul Urge preserves Master Numbers
}

function calculatePersonalityNumber(fullName) {
    const cleanedName = cleanName(fullName);
    let total = 0;
    for (const char of cleanedName) {
        if (!VOWELS.has(char) && char !== ' ') {
            total += getChaldeanValue(char);
        }
    }
    return calculateSingleDigit(total, true); // Personality preserves Master Numbers
}

function checkKarmicDebt(fullName) {
    const cleanedName = cleanName(fullName);
    let total = 0;
    for (const char of cleanedName) {
        total += getChaldeanValue(char);
    }
    // Karmic debt is checked on the unreduced sum
    return KARMIC_DEBT_NUMBERS.has(total);
}

function calculateBirthDayNumber(birthDateStr) {
    try {
        const day = parseInt(birthDateStr.split('-')[2], 10);
        if (isNaN(day) || day < 1 || day > 31) return 0;
        return calculateSingleDigit(day, true);
    } catch {
        return 0;
    }
}

function calculateLifePathNumber(birthDateStr) {
    try {
        const [year, month, day] = birthDateStr.split('-').map(Number);
        const totalSumAllDigits = String(year) + String(month) + String(day);
        let sum = 0;
        for(const digit of totalSumAllDigits) {
            sum += parseInt(digit, 10);
        }
        return calculateSingleDigit(sum, true);
    } catch {
        return 0;
    }
}

function calculateLoShuGrid(birthDateStr, nameExpressionNum = null) {
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
}


// --- End Client-Side Numerology Calculation Functions ---


function App() {
    // --- State Management ---
    const [fullName, setFullName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [birthTime, setBirthTime] = useState('');
    const [birthPlace, setBirthPlace] = useState('');
    const [desiredOutcome, setDesiredOutcome] = useState('');

    const [clientProfile, setClientProfile] = useState(null);
    // Use a ref to always have the latest clientProfile available in callbacks
    const clientProfileRef = useRef(clientProfile);
    useEffect(() => {
        clientProfileRef.current = clientProfile;
    }, [clientProfile]);


    const [suggestions, setSuggestions] = useState([]); // Original suggestions from backend
    const [editableSuggestions, setEditableSuggestions] = useState([]); // Suggestions with edit state and live calculated values
    const [confirmedSuggestions, setConfirmedSuggestions] = useState([]);
    const [currentPage, setCurrentPage] = useState(0); // For paginating suggestions table

    const [customNameInput, setCustomNameInput] = useState('');
    const [liveValidationOutput, setLiveValidationOutput] = useState(null); // For live client-side calcs of custom input
    const [backendValidationResult, setBackendValidationResult] = useState(null); // For custom validation section

    const [reportPreviewContent, setReportPreviewContent] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, message: '' });
    const [isTableFullscreen, setIsTableFullscreen] = useState(false); // New state for fullscreen table

    // --- Modal Functions ---
    const openModal = useCallback((message) => {
        setModal({ isOpen: true, message });
    }, [setModal]);

    const closeModal = useCallback(() => {
        setModal({ isOpen: false, message: '' });
    }, [setModal]);

    // --- Fullscreen Toggle Function ---
    const toggleTableFullscreen = useCallback(() => {
        setIsTableFullscreen(prev => {
            // Toggle 'fullscreen-active' class on the app-container for visual effect
            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                if (!prev) {
                    appContainer.classList.add('fullscreen-active');
                } else {
                    appContainer.classList.remove('fullscreen-active');
                }
            }
            return !prev;
        });
    }, []);

    // Effect to handle Esc key to exit fullscreen
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && isTableFullscreen) {
                toggleTableFullscreen();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Clean up event listener on component unmount or when fullscreen state changes
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            // Also ensure app-container class is removed if component unmounts while fullscreen
            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                appContainer.classList.remove('fullscreen-active');
            }
        };
    }, [isTableFullscreen, toggleTableFullscreen]);


    // --- formatProfileData Function ---
    const formatProfileData = useCallback((profile) => {
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
            <p><b>Expression Number:</b> ${profile.expression_number} (Ruled by ${profile.expression_details?.planetary_ruler || 'N/A'})</p>
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
            <p><b>Ascendant:</b> ${profile.astro_info?.ascendant_info?.sign || 'N/A'} (Ruler: ${profile.astro_info?.ascendant_info?.ruler || 'N/A'})</p>
            <p><b>Moon Sign:</b> ${profile.astro_info?.moon_sign_info?.sign || 'N/A'} (Ruler: ${profile.astro_info?.moon_sign_info?.ruler || 'N/A'})</p>
            <p><b>Planetary Compatibility:</b> ${profile.astro_info?.planetary_compatibility?.compatibility_flags?.join('; ') || 'No specific flags'}</p>
            <hr class="my-2">
            <h3 class="font-bold">Phonetic Vibration:</h3>
            <p><b>Harmony:</b> ${profile.phonetic_vibration?.is_harmonious ? 'Harmonious' : 'Needs consideration'} (Score: ${profile.phonetic_vibration?.score?.toFixed(2) || 'N/A'})</p>
            <p><i>"${profile.phonetic_vibration?.qualitative_description || 'N/A'}"</i></p>
            <hr class="my-2">
            <h3 class="font-bold">Insights & Forecast:</h3>
            <p><b>Compatibility Insights:</b> ${profile.compatibility_insights?.description || 'N/A'}</p>
            <p><b>Karmic Lessons:</b> ${profile.karmic_lessons?.lessons_summary?.map(l => l.lesson).join('; ') || 'None'}</p>
            <p><b>Karmic Debts (Birth Date):</b> ${profile.karmic_lessons?.birth_date_karmic_debts?.join('; ') || 'None'}</p>
            <p><b>Edge Cases:</b> ${profile.edge_cases?.map(ec => ec.type).join('; ') || 'None'}</p>
            <p><b>Current Personal Year:</b> ${profile.timing_recommendations?.current_personal_year || 'N/A'}</p>
            <p><b>Success Areas:</b> ${profile.success_areas?.combined_strengths?.join(', ') || 'N/A'}</p>
        `;
    }, []);

    // --- API Call Functions (Wrapped in useCallback for stability) ---

    const getInitialSuggestions = useCallback(async () => {
        if (!fullName || !birthDate || !desiredOutcome) {
            openModal("Please fill in Full Name, Birth Date, and Desired Outcome to get suggestions.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.post(`${BACKEND_URL}/initial_suggestions`, {
                full_name: fullName,
                birth_date: birthDate,
                birth_time: birthTime,
                birth_place: birthPlace,
                desired_outcome: desiredOutcome,
            });
            setSuggestions(response.data.suggestions);
            
            // Ensure profile_data is present and an object before setting clientProfile
            if (response.data.profile_data && typeof response.data.profile_data === 'object') {
                setClientProfile(response.data.profile_data); 
                console.log("Client Profile set successfully:", response.data.profile_data);
            } else {
                console.error("Backend did not return valid profile_data in initial_suggestions response:", response.data.profile_data);
                openModal("Failed to load client profile due to invalid data from backend. Please try again or contact support.");
            }
            setConfirmedSuggestions([]);
            setCurrentPage(0); // Reset to first page of table on new suggestions
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            // Display specific error from backend if available, otherwise a generic one
            openModal(error.response?.data?.error || 'Failed to get suggestions. Please check your backend server.');
        } finally {
            setIsLoading(false);
        }
    }, [fullName, birthDate, birthTime, birthPlace, desiredOutcome, openModal, setSuggestions, setClientProfile, setConfirmedSuggestions, setIsLoading, setCurrentPage]);

    // handleValidateName now accepts the currentClientProfile directly
    const handleValidateName = useCallback(async (nameToValidate, currentClientProfile, isCustom = false, suggestionIndex = null) => {
        // Use the passed currentClientProfile
        if (!currentClientProfile) {
            openModal("Please get initial suggestions first to generate your numerology profile before validating names.");
            console.error("Validation attempted with null clientProfile. Aborting API call.");
            return;
        }
        
        // If nameToValidate is empty, clear the validation result and return without API call
        if (!nameToValidate.trim()) {
            if (!isCustom) {
                setEditableSuggestions(prev => prev.map((s, idx) =>
                    idx === suggestionIndex ? { ...s, validationResult: null } : s
                ));
            } else {
                setBackendValidationResult(null);
            }
            console.log(`Validation skipped: Name is empty or whitespace for ${isCustom ? 'custom input' : `suggestion ${suggestionIndex}`}`);
            return; // Exit function if name is empty
        }

        setIsLoading(true);
        try {
            console.log(`Sending validation request for: "${nameToValidate}"`);
            console.log('Client Profile for validation (sent to backend):', currentClientProfile); // Log currentClientProfile here
            const response = await axios.post(`${BACKEND_URL}/validate_name`, {
                suggested_name: nameToValidate,
                client_profile: currentClientProfile, // Use the passed currentClientProfile
            });
            if (isCustom) {
                setBackendValidationResult(response.data);
            } else {
                 setEditableSuggestions(prev => prev.map((s, idx) =>
                    idx === suggestionIndex ? { ...s, validationResult: response.data, isEdited: true } : s
                ));
            }
            console.log('Validation successful:', response.data);
        } catch (error) {
            console.error('Error validating name:', error);
            // Display specific error from backend if available, otherwise a generic one
            openModal(error.response?.data?.error || 'Failed to validate name. Please check your backend server.');
        } finally {
            setIsLoading(false);
        }
    }, [openModal, setEditableSuggestions, setBackendValidationResult, setIsLoading]);

    const handleGenerateReport = useCallback(async () => {
        if (!clientProfile || confirmedSuggestions.length === 0) {
            openModal("Please generate your profile and confirm at least one name suggestion before generating the report.");
            return;
        }

        setIsLoading(true);
        try {
            // First, get the text report for preview
            const textReportResponse = await axios.post(`${BACKEND_URL}/generate_text_report`, {
                full_name: clientProfile.full_name,
                birth_date: clientProfile.birth_date,
                birth_time: clientProfile.birth_time,
                birth_place: clientProfile.birth_place,
                desired_outcome: clientProfile.desired_outcome,
                confirmed_suggestions: confirmedSuggestions,
            });
            setReportPreviewContent(textReportResponse.data.report_content);

            // Then, trigger PDF download (this will open a new tab/download)
            const pdfResponse = await axios.post(`${BACKEND_URL}/generate_pdf_report`, {
                full_name: clientProfile.full_name,
                birth_date: clientProfile.birth_date,
                birth_time: clientProfile.birth_time,
                birth_place: clientProfile.birth_place,
                desired_outcome: desiredOutcome,
                confirmed_suggestions: confirmedSuggestions,
            }, {
                responseType: 'blob', // Important for downloading files
            });

            // Create a blob from the response data and create a download link
            const url = window.URL.createObjectURL(new Blob([pdfResponse.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Numerology_Report_${clientProfile.full_name.replace(/ /g, '_')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url); // Clean up the URL object

        } catch (error) {
            console.error('Error generating report:', error);
            openModal(error.response?.data?.error || 'Failed to generate report. Please check your backend server.');
        } finally {
            setIsLoading(false);
        }
    }, [clientProfile, confirmedSuggestions, openModal, setReportPreviewContent, setIsLoading, desiredOutcome]);

    // --- Effects ---
    // Initialize editableSuggestions when suggestions from backend are received
    useEffect(() => {
        if (suggestions.length > 0) {
            const initialEditable = suggestions.map((s, index) => {
                // Calculate initial live values for each suggestion
                const firstNameValue = calculateFirstNameValue(s.name);
                const expressionNumber = calculateExpressionNumber(s.name);
                const soulUrgeNumber = calculateSoulUrgeNumber(s.name);
                const personalityNumber = calculatePersonalityNumber(s.name);
                const karmicDebtPresent = checkKarmicDebt(s.name);

                return {
                    ...s,
                    id: index, // Add a stable id
                    currentName: s.name, // The full name the user can edit
                    originalName: s.name, // The original full name suggested by LLM
                    firstNameValue,
                    expressionNumber,
                    soulUrgeNumber,
                    personalityNumber,
                    karmicDebtPresent,
                    isEdited: false, // Flag to track if user has edited this suggestion
                    validationResult: null // Clear any previous validation results
                };
            });
            setEditableSuggestions(initialEditable);
        }
    }, [suggestions]);


    // Core logic for live validation display (not debounced)
    // This function now takes currentClientProfile directly
    const updateLiveValidationDisplayCore = useCallback((name, currentClientProfile) => {
        if (!name.trim() || !currentClientProfile) {
            setLiveValidationOutput(null);
            setBackendValidationResult(null);
            return;
        }

        // Client-side calculations for immediate feedback
        const expNum = calculateExpressionNumber(name);
        const birthDateStr = currentClientProfile.birth_date; // Use passed profile
        const loShu = calculateLoShuGrid(birthDateStr, expNum);
        const birthDayNum = calculateBirthDayNumber(birthDateStr);
        const lifePathNum = calculateLifePathNumber(birthDateStr);
        const soulUrgeNum = calculateSoulUrgeNumber(name);
        const personalityNum = calculatePersonalityNumber(name);
        const karmicDebtPresent = checkKarmicDebt(name);

        setLiveValidationOutput({
            name,
            firstNameValue: calculateFirstNameValue(name), // Live first name value
            expressionNumber: expNum,
            soulUrgeNumber: soulUrgeNum,
            personalityNumber: personalityNum,
            karmicDebtPresent: karmicDebtPresent,
            birthDayNumber: birthDayNum,
            lifePathNumber: lifePathNum,
            loShuGridCounts: loShu.grid_counts,
            loShuMissingNumbers: loShu.missing_numbers,
        });

        // Trigger backend validation for comprehensive rules
        // Pass clientProfileRef.current to handleValidateName
        handleValidateName(name, currentClientProfile, true, null); // custom validation doesn't need suggestion index
    }, [handleValidateName]);

    // Debounced version of updateLiveValidationDisplayCore
    const debouncedUpdateLiveValidationDisplay = useRef(
        debounce((name, profile) => updateLiveValidationDisplayCore(name, profile), 300)
    ).current;

    // Effect to trigger live validation when customNameInput or clientProfile changes
    useEffect(() => {
        // Only trigger if clientProfile is available AND customNameInput is not empty
        // Use clientProfileRef.current to ensure the latest value is captured by the debounce
        if (clientProfileRef.current && customNameInput.trim()) { 
            debouncedUpdateLiveValidationDisplay(customNameInput, clientProfileRef.current);
        } else {
            setLiveValidationOutput(null);
            setBackendValidationResult(null);
        }
    }, [customNameInput, debouncedUpdateLiveValidationDisplay]);

    // --- Confirmation Logic ---
    const handleConfirmSuggestion = useCallback((suggestion) => {
        // Use the editedName if available, otherwise the original name
        const nameToConfirm = suggestion.currentName;
        
        const isAlreadyConfirmed = confirmedSuggestions.some(
            (s) => s.name === nameToConfirm
        );

        if (isAlreadyConfirmed) {
            openModal(`'${nameToConfirm}' is already in your confirmed list.`);
            return;
        }

        // Add the current edited name and its original rationale to confirmed list
        const expressionToConfirm = suggestion.expressionNumber;

        setConfirmedSuggestions(prev => [
            ...prev,
            {
                name: nameToConfirm, // Use the current edited name
                expression_number: expressionToConfirm, // Use the live calculated expression
                rationale: suggestion.validationResult?.rationale || suggestion.rationale, // Use new rationale if available
            }
        ]);
        openModal(`'${nameToConfirm}' has been added to your confirmed list.`);

    }, [confirmedSuggestions, openModal]);

    const handleRemoveConfirmedSuggestion = useCallback((nameToRemove) => {
        setConfirmedSuggestions(prev => prev.filter(s => s.name !== nameToRemove));
        openModal(`'${nameToRemove}' has been removed from confirmed list.`);
    }, [openModal]);


    // --- Handlers for Editable Suggestions Table ---
    // Core logic for backend suggestion validation (not debounced)
    const validateSuggestionNameBackendCore = useCallback((name, index) => {
        if (clientProfileRef.current) {
            handleValidateName(name, clientProfileRef.current, false, index);
        } else {
            console.warn("Cannot validate suggestion: clientProfile is null.");
            openModal("Please get initial suggestions first to generate your numerology profile before validating names.");
        }
    }, [handleValidateName, openModal]);

    // Debounced version
    const debouncedValidateSuggestionNameBackend = useRef(
        debounce((name, index) => validateSuggestionNameBackendCore(name, index), 500)
    ).current;

    const handleNameTableCellChange = useCallback((index, newFullName) => {
        setEditableSuggestions(prev => prev.map((s, idx) => {
            if (idx === index) {
                const updatedSuggestion = { ...s, currentName: newFullName, isEdited: true };

                // Recalculate all live numerology values
                updatedSuggestion.firstNameValue = calculateFirstNameValue(newFullName);
                updatedSuggestion.expressionNumber = calculateExpressionNumber(newFullName);
                updatedSuggestion.soulUrgeNumber = calculateSoulUrgeNumber(newFullName);
                updatedSuggestion.personalityNumber = calculatePersonalityNumber(newFullName);
                updatedSuggestion.karmicDebtPresent = checkKarmicDebt(newFullName);

                if (newFullName.trim()) {
                    debouncedValidateSuggestionNameBackend(newFullName, index);
                } else {
                    updatedSuggestion.validationResult = null; // Clear validation on empty
                }
                return updatedSuggestion;
            }
            return s;
        }));
    }, [debouncedValidateSuggestionNameBackend]);
    
    // --- Pagination Logic ---
    const SUGGESTIONS_PER_PAGE = 5;
    const pageCount = Math.ceil(editableSuggestions.length / SUGGESTIONS_PER_PAGE);
    const paginatedSuggestions = editableSuggestions.slice(
        currentPage * SUGGESTIONS_PER_PAGE,
        (currentPage + 1) * SUGGESTIONS_PER_PAGE
    );

    const goToNextPage = () => {
        setCurrentPage((page) => Math.min(page + 1, pageCount - 1));
    };

    const goToPreviousPage = () => {
        setCurrentPage((page) => Math.max(page - 1, 0));
    };

    return (
        // Apply fullscreen-active class to app-container
        <div className={`app-container ${isTableFullscreen ? 'fullscreen-active' : ''}`}>
            <div className="main-content-wrapper">
                <h1 className="main-title">Sheelaa's Numerology Portal</h1>

                {/* Input Form */}
                <div className="section-card input-form-card">
                    <h2>Client Information</h2>
                    <div className="input-group">
                        <label htmlFor="fullName" className="input-label">Full Name:</label>
                        <input type="text" id="fullName" placeholder="e.g., John Doe" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="birthDate" className="input-label">Birth Date:</label>
                        <input type="date" id="birthDate" className="input-field" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="birthTime" className="input-label">Birth Time (optional):</label>
                        <input type="time" id="birthTime" placeholder="HH:MM" className="input-field" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="birthPlace" className="input-label">Birth Place (optional):</label>
                        <input type="text" id="birthPlace" placeholder="City, Country" className="input-field" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="desiredOutcome" className="input-label">Desired Outcome:</label>
                        <input type="text" id="desiredOutcome" placeholder="e.g., Success, Love, Career" className="input-field" value={desiredOutcome} onChange={(e) => setDesiredOutcome(e.target.value)} />
                    </div>
                    <button onClick={getInitialSuggestions} className="primary-btn">Get Initial Suggestions</button>
                </div>

                {/* Profile Display */}
                {clientProfile ? (
                    <div className="section-card profile-display-card">
                        <h2>Client Numerology Profile</h2>
                        <div className="profile-details-content" dangerouslySetInnerHTML={{ __html: formatProfileData(clientProfile) }}>
                        </div>
                    </div>
                ) : (
                    <div className="section-card profile-display-card">
                        <h2>Client Numerology Profile</h2>
                        <p className="text-gray-600">Please fill in your details and click "Get Initial Suggestions" to load your numerology profile.</p>
                    </div>
                )}

                {/* Custom Name Validation */}
                {clientProfile && (
                    <div className="section-card custom-validation-card">
                        <h2>Validate Custom Name</h2>
                        <div className="input-group">
                            <label htmlFor="customNameInput" className="input-label">Name to Validate:</label>
                            <input
                                type="text"
                                id="customNameInput"
                                placeholder="Enter a name to validate..."
                                className="input-field"
                                value={customNameInput}
                                onChange={(e) => setCustomNameInput(e.target.value)}
                            />
                        </div>
                        {liveValidationOutput && (
                            <div className="live-validation-output section-card" style={{backgroundColor: '#ffffff', border: '1px solid #e9eceb', boxShadow: 'none'}}>
                                <p className="font-bold">Live Calculated Values:</p>
                                <p><b>Name:</b> {customNameInput}</p>
                                <p><b>First Name Value:</b> {liveValidationOutput.firstNameValue}</p>
                                <p><b>Expression Number:</b> {liveValidationOutput.expressionNumber}</p>
                                <p><b>Karmic Debt:</b> {liveValidationOutput.karmicDebtPresent ? 'Yes ⚠️' : 'No'}</p>
                                {backendValidationResult && (
                                    <>
                                        <hr className="my-2" />
                                        <p><b>Backend Validation:</b> <span className={backendValidationResult.is_valid ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{backendValidationResult.is_valid ? 'VALID' : 'INVALID'}</span></p>
                                        <p><b>Rationale:</b> {backendValidationResult.rationale}</p>
                                    </>
                                )}
                            </div>
                        )}
                        <button onClick={() => handleValidateName(customNameInput, clientProfileRef.current, true, null)} className="primary-btn" disabled={!clientProfile || !customNameInput.trim()}>Validate Custom Name</button>
                    </div>
                )}

                {/* --- NEW PAGINATED SUGGESTIONS TABLE --- */}
                {editableSuggestions.length > 0 && (
                    <div className={`section-card suggestions-display-card ${isTableFullscreen ? 'table-fullscreen' : ''}`}>
                        <div className="table-header-controls">
                            <h2>Suggested Name Variations</h2>
                            <button onClick={toggleTableFullscreen} className="secondary-btn small-btn">
                                {isTableFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
                            </button>
                        </div>
                        <p className="text-sm text-gray-700 mb-3">
                           Here are the suggested names. You can edit, validate, and confirm them directly in the table.
                        </p>
                        <div className="table-responsive">
                            <table className="name-suggestion-table">
                                <thead>
                                    <tr>
                                    <th>Name</th>
                                    <th>FNV (First Name Value)</th>
                                    <th>EN (Expression Number)</th>
                                    <th>Valid</th>
                                    <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSuggestions.map((s) => (
                                        <tr key={s.id}>
                                            <td data-label="Name">
                                                <input
                                                    type="text"
                                                    value={s.currentName}
                                                    onChange={(e) => handleNameTableCellChange(s.id, e.target.value)}
                                                    className="table-input"
                                                    aria-label={`Edit name for ${s.originalName}`}
                                                />
                                            </td>
                                            <td data-label="FNV">{s.firstNameValue}</td>
                                            <td data-label="EN">{s.expressionNumber}</td>
                                            <td data-label="Valid">
                                                {s.validationResult ? (
                                                    s.validationResult.is_valid ? '✅' : '❌'
                                                ) : (
                                                    '--'
                                                )}
                                            </td>
                                            <td data-label="Actions" className="actions-cell">
                                                <button 
                                                    onClick={() => handleValidateName(s.currentName, clientProfileRef.current, false, s.id)} 
                                                    className="secondary-btn small-btn" 
                                                    disabled={!clientProfile || !s.currentName.trim()}
                                                    title="Re-validate this name with the backend"
                                                >
                                                    Validate
                                                </button>
                                                <button
                                                    onClick={() => handleConfirmSuggestion(s)}
                                                    className={`primary-btn small-btn ${confirmedSuggestions.some(cs => cs.name === s.currentName) ? 'disabled-btn' : ''}`}
                                                    disabled={confirmedSuggestions.some(cs => cs.name === s.currentName)}
                                                     title="Confirm this name for the report"
                                                >
                                                    {confirmedSuggestions.some(cs => cs.name === s.currentName) ? '✓' : 'Confirm'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="pagination-controls">
                            <button onClick={goToPreviousPage} disabled={currentPage === 0} className="secondary-btn">
                                Previous
                            </button>
                            <span>Page {currentPage + 1} of {pageCount}</span>
                            <button onClick={goToNextPage} disabled={currentPage >= pageCount - 1} className="secondary-btn">
                                Next
                            </button>
                        </div>
                    </div>
                )}


                {/* Report Generation */}
                {clientProfile && (
                    <div className="section-card report-generation-card">
                        <h2>Generate Reports</h2>
                         {confirmedSuggestions.length > 0 ? (
                            <div className="confirmed-suggestions-list mt-4 mb-4">
                                <h3 className="font-bold text-lg mb-2">Your Confirmed Names:</h3>
                                {confirmedSuggestions.map((s, index) => (
                                    <div key={index} className="confirmed-item">
                                        <span>{s.name} (Exp: {s.expression_number})</span>
                                        <button 
                                            onClick={() => handleRemoveConfirmedSuggestion(s.name)} 
                                            className="remove-btn"
                                            title="Remove this name from the confirmed list"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-700 mb-3">Confirm names from the table above to include them in the report.</p>
                        )}
                        <button onClick={handleGenerateReport} className="primary-btn" disabled={!clientProfile || confirmedSuggestions.length === 0}>Generate Comprehensive Report (PDF & Preview)</button>
                        {reportPreviewContent && (
                            <div className="report-preview-area" dangerouslySetInnerHTML={{ __html: marked.parse(String(reportPreviewContent || '')) }}>
                            </div>
                        )}
                    </div>
                )}
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
// END OF App.js - DO NOT DELETE THIS LINE
