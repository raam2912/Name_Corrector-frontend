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
    const [suggestions, setSuggestions] = useState([]); // Original suggestions from backend
    const [editableSuggestions, setEditableSuggestions] = useState([]); // Suggestions with edit state and live calculated values
    const [confirmedSuggestions, setConfirmedSuggestions] = useState([]);

    const [customNameInput, setCustomNameInput] = useState('');
    const [liveValidationOutput, setLiveValidationOutput] = useState(null); // For live client-side calcs of custom input
    const [backendValidationResult, setBackendValidationResult] = useState(null); // For custom validation section

    const [reportPreviewContent, setReportPreviewContent] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, message: '' });

    // --- Modal Functions ---
    const openModal = useCallback((message) => {
        setModal({ isOpen: true, message });
    }, [setModal]);

    const closeModal = useCallback(() => {
        setModal({ isOpen: false, message: '' });
    }, [setModal]);

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
            
            // CRITICAL FIX: Ensure profile_data is present before setting clientProfile
            if (response.data.profile_data) {
                setClientProfile(response.data.profile_data); 
                console.log("Client Profile set:", response.data.profile_data);
            } else {
                console.error("Backend did not return profile_data in initial_suggestions response.");
                openModal("Failed to load client profile. Please try again or contact support.");
            }
            setConfirmedSuggestions([]);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            // Display specific error from backend if available, otherwise a generic one
            openModal(error.response?.data?.error || 'Failed to get suggestions. Please check your backend server.');
        } finally {
            setIsLoading(false);
        }
    }, [fullName, birthDate, birthTime, birthPlace, desiredOutcome, openModal, setSuggestions, setClientProfile, setConfirmedSuggestions, setIsLoading]);

    const handleValidateName = useCallback(async (nameToValidate, isCustom = false, suggestionIndex = null) => {
        // CRITICAL FIX: Ensure clientProfile is NOT null before proceeding
        if (!clientProfile) {
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
            console.log('Client Profile for validation (sent to backend):', clientProfile); // Log clientProfile here
            const response = await axios.post(`${BACKEND_URL}/validate_name`, {
                suggested_name: nameToValidate,
                client_profile: clientProfile, // clientProfile should be available here
            });
            if (isCustom) {
                setBackendValidationResult(response.data);
            } else {
                setEditableSuggestions(prev => prev.map((s, idx) =>
                    idx === suggestionIndex ? { ...s, validationResult: response.data } : s
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
    }, [clientProfile, openModal, setEditableSuggestions, setBackendValidationResult, setIsLoading]); // clientProfile is a dependency

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
                desired_outcome: clientProfile.desired_outcome,
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
    }, [clientProfile, confirmedSuggestions, openModal, setReportPreviewContent, setIsLoading]);

    // --- Effects ---
    // Initialize editableSuggestions when suggestions from backend are received
    useEffect(() => {
        if (suggestions.length > 0) {
            const initialEditable = suggestions.map(s => {
                // Calculate initial live values for each suggestion
                const firstNameValue = calculateFirstNameValue(s.name);
                const expressionNumber = calculateExpressionNumber(s.name);
                const soulUrgeNumber = calculateSoulUrgeNumber(s.name);
                const personalityNumber = calculatePersonalityNumber(s.name);
                const karmicDebtPresent = checkKarmicDebt(s.name);

                return {
                    ...s,
                    currentName: s.name, // The name the user can edit
                    originalName: s.name, // The original name suggested by LLM
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
    }, [suggestions, setEditableSuggestions]);

    // Core logic for live validation display (not debounced)
    const updateLiveValidationDisplayCore = useCallback((name, profile) => {
        if (!name.trim() || !profile) {
            setLiveValidationOutput(null);
            setBackendValidationResult(null);
            return;
        }

        // Client-side calculations for immediate feedback
        const expNum = calculateExpressionNumber(name);
        const birthDateStr = profile.birth_date;
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
        handleValidateName(name, true);
    }, [handleValidateName, setLiveValidationOutput, setBackendValidationResult]);

    // Debounced version of updateLiveValidationDisplayCore
    const debouncedUpdateLiveValidationDisplay = useRef(
        debounce((name, profile) => updateLiveValidationDisplayCore(name, profile), 300)
    ).current;

    // Effect to trigger live validation when customNameInput or clientProfile changes
    useEffect(() => {
        if (clientProfile) { // Only trigger if clientProfile is available
            debouncedUpdateLiveValidationDisplay(customNameInput, clientProfile);
        } else {
            setLiveValidationOutput(null);
            setBackendValidationResult(null);
        }
    }, [customNameInput, clientProfile, debouncedUpdateLiveValidationDisplay, setLiveValidationOutput, setBackendValidationResult]);


    // --- Highlighting Logic ---
    const simpleRenderHighlightedName = useCallback((originalText, currentText) => {
        const originalChars = originalText.split('');
        const currentChars = currentText.split('');
        const maxLength = Math.max(originalChars.length, currentChars.length);

        return Array.from({ length: maxLength }).map((_, i) => {
            const originalChar = originalChars[i];
            const currentChar = currentChars[i];

            if (originalChar === currentChar) {
                return <span key={i}>{currentChar}</span>;
            } else {
                // If characters differ or one is missing, highlight the current one
                // Use a non-breaking space if currentChar is undefined to maintain layout
                return <u key={i} className="highlighted-char">{currentChar || '\u00A0'}</u>;
            }
        });
    }, []);

    // --- Confirmation Logic ---
    const handleConfirmSuggestion = useCallback((suggestion) => {
        // Use the editedName if available, otherwise the original name
        const nameToConfirm = suggestion.isEdited ? suggestion.currentName : suggestion.originalName;
        
        const isAlreadyConfirmed = confirmedSuggestions.some(
            (s) => s.name === nameToConfirm
        );

        if (isAlreadyConfirmed) {
            openModal(`'${nameToConfirm}' is already in your confirmed list.`);
            return;
        }

        // Add the current edited name and its original rationale to confirmed list
        // The rationale is stored with the original suggestion and passed along
        const originalSuggestionData = suggestions.find(s => s.originalName === suggestion.originalName);
        
        // Use the live calculated expression number
        const expressionToConfirm = suggestion.expressionNumber;

        if (originalSuggestionData) {
             setConfirmedSuggestions(prev => [
                ...prev,
                {
                    name: nameToConfirm, // Use the current edited name or original
                    expression_number: expressionToConfirm, // Use the live calculated expression
                    rationale: originalSuggestionData.rationale, // Use the original rationale from LLM
                }
            ]);
            openModal(`'${nameToConfirm}' has been added to your confirmed list.`);
        } else {
            openModal("Could not find original rationale for this suggestion. Please try again.");
        }
    }, [confirmedSuggestions, suggestions, openModal, setConfirmedSuggestions]);

    const handleRemoveConfirmedSuggestion = useCallback((nameToRemove) => {
        setConfirmedSuggestions(prev => prev.filter(s => s.name !== nameToRemove));
        openModal(`'${nameToRemove}' has been removed from confirmed list.`);
    }, [openModal, setConfirmedSuggestions]);


    // --- New Handlers for Editable Suggestions ---
    const handleEditSuggestion = useCallback((index) => {
        setEditableSuggestions(prev => prev.map((s, idx) => 
            idx === index ? { ...s, isEditing: true, currentName: s.currentName, validationResult: null } : { ...s, isEditing: false } // Only one can be edited at a time
        ));
    }, [setEditableSuggestions]);

    // Core logic for backend suggestion validation (not debounced)
    const validateSuggestionNameBackendCore = useCallback((name, index) => {
        // Ensure clientProfile is not null before calling handleValidateName
        if (clientProfile) {
            handleValidateName(name, false, index); // Call the main validation handler
        } else {
            console.warn("Cannot validate suggestion: clientProfile is null. Please get initial suggestions first.");
            openModal("Please get initial suggestions first to generate your numerology profile before validating names.");
        }
    }, [handleValidateName, clientProfile, openModal]); // clientProfile is a dependency

    // Debounced version of validateSuggestionNameBackendCore
    const debouncedValidateSuggestionNameBackend = useRef(
        debounce((name, index) => validateSuggestionNameBackendCore(name, index), 500)
    ).current;

    const handleEditedNameChange = useCallback((index, newName) => {
        setEditableSuggestions(prev => prev.map((s, idx) => {
            if (idx === index) {
                // Update the current name
                const updatedSuggestion = { ...s, currentName: newName, isEdited: true };
                // Recalculate live numerology values for the edited name
                updatedSuggestion.firstNameValue = calculateFirstNameValue(newName);
                updatedSuggestion.expressionNumber = calculateExpressionNumber(newName);
                updatedSuggestion.soulUrgeNumber = calculateSoulUrgeNumber(newName);
                updatedSuggestion.personalityNumber = calculatePersonalityNumber(newName);
                updatedSuggestion.karmicDebtPresent = checkKarmicDebt(newName);

                // IMPORTANT FIX: Only trigger backend validation if the name is NOT empty or just whitespace
                if (newName.trim()) {
                    debouncedValidateSuggestionNameBackend(newName, index);
                } else {
                    // If the name becomes empty, clear the validation result immediately on the frontend
                    updatedSuggestion.validationResult = null;
                }
                return updatedSuggestion;
            }
            return s;
        }));
    }, [debouncedValidateSuggestionNameBackend, setEditableSuggestions]);

    const handleSaveEdit = useCallback((index) => {
        setEditableSuggestions(prev => prev.map((s, idx) => {
            if (idx === index) {
                const newExpressionNumber = calculateExpressionNumber(s.currentName);
                const newFirstNameValue = calculateFirstNameValue(s.currentName);
                const newSoulUrgeNumber = calculateSoulUrgeNumber(s.currentName);
                const newPersonalityNumber = calculatePersonalityNumber(s.currentName);
                const newKarmicDebtPresent = checkKarmicDebt(s.currentName);

                return {
                    ...s,
                    name: s.currentName, // This becomes the new "base" name for this suggestion item
                    expression_number: newExpressionNumber,
                    firstNameValue: newFirstNameValue,
                    soulUrgeNumber: newSoulUrgeNumber,
                    personalityNumber: newPersonalityNumber,
                    karmicDebtPresent: newKarmicDebtPresent,
                    rationale: s.validationResult ? s.validationResult.rationale : s.rationale, // Use validation rationale if available
                    isEditing: false,
                    isEdited: true, // Keep edited flag true after saving
                };
            }
            return s;
        }));
        openModal("Name updated successfully!");
    }, [openModal, setEditableSuggestions]);

    const handleCancelEdit = useCallback((index) => {
        setEditableSuggestions(prev => prev.map((s, idx) => 
            idx === index ? { 
                ...s, 
                currentName: s.originalName, // Revert to original LLM suggested name
                firstNameValue: calculateFirstNameValue(s.originalName),
                expressionNumber: calculateExpressionNumber(s.originalName),
                soulUrgeNumber: calculateSoulUrgeNumber(s.originalName),
                personalityNumber: calculatePersonalityNumber(s.originalName),
                karmicDebtPresent: checkKarmicDebt(s.originalName),
                isEditing: false, 
                isEdited: false, // Reset edited flag
                validationResult: null // Clear validation result
            } : s
        ));
        openModal("Edit cancelled. Name reverted to original suggestion.");
    }, [openModal, setEditableSuggestions]);


    return (
        <div className="app-container">
            <div className="main-content-wrapper">

                {/* Left Column: Input Form & Profile Display */}
                <div className="column">
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
                    {clientProfile ? ( // Display profile if available
                        <div className="section-card profile-display-card">
                            <h2>Client Numerology Profile</h2>
                            <div className="profile-details-content" dangerouslySetInnerHTML={{ __html: formatProfileData(clientProfile) }}>
                            </div>
                        </div>
                    ) : ( // Show message if profile is not loaded
                        <div className="section-card profile-display-card">
                            <h2>Client Numerology Profile</h2>
                            <p className="text-gray-600">Please fill in your details and click "Get Initial Suggestions" to load your numerology profile.</p>
                        </div>
                    )}

                    {/* Custom Name Validation */}
                    {clientProfile && ( // Only show this section if clientProfile is available
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
                                    <p><b>Soul Urge Number:</b> {liveValidationOutput.soulUrgeNumber}</p>
                                    <p><b>Personality Number:</b> {liveValidationOutput.personalityNumber}</p>
                                    <p><b>Karmic Debt Present:</b> {liveValidationOutput.karmicDebtPresent ? 'Yes ⚠️' : 'No'}</p>
                                    <hr className="my-2" />
                                    <p><b>Birth Day Number:</b> {liveValidationOutput.birthDayNumber}</p>
                                    <p><b>Life Path Number:</b> {liveValidationOutput.lifePathNumber}</p>
                                    <p><b>Lo Shu Grid Counts:</b> {JSON.stringify(liveValidationOutput.loShuGridCounts)}</p>
                                    <p><b>Missing Lo Shu:</b> {liveValidationOutput.loShuMissingNumbers.join(', ') || 'None'}</p>
                                    {backendValidationResult && (
                                        <>
                                            <hr className="my-2" />
                                            <p><b>Backend Validation:</b> <span className={backendValidationResult.is_valid ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{backendValidationResult.is_valid ? 'VALID' : 'INVALID'}</span></p>
                                            <p><b>Rationale:</b> {backendValidationResult.rationale}</p>
                                        </>
                                    )}
                                </div>
                            )}
                            <button onClick={() => handleValidateName(customNameInput, true)} className="primary-btn">Validate Custom Name</button>
                        </div>
                    )}
                </div>

                {/* Right Column: Suggestions, Reports */}
                <div className="column">
                    {/* Initial Suggestions Display */}
                    {editableSuggestions.length > 0 && (
                        <div className="section-card suggestions-display-card">
                            <h2>Suggested Name Variations</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                {suggestions[0]?.reasoning || 'Overall reasoning for suggestions.'}
                            </p>
                            <div className="suggestions-list-content">
                                {editableSuggestions.map((s, index) => (
                                    <div key={index} className="suggestions-list-item">
                                        {s.isEditing ? (
                                            <>
                                                <div className="name-input-wrapper">
                                                    <label htmlFor={`editedName-${index}`} className="input-label">Edit Name:</label>
                                                    <input
                                                        type="text"
                                                        id={`editedName-${index}`}
                                                        className="input-field editable-name-input"
                                                        value={s.currentName} // Use currentName for editing
                                                        onChange={(e) => handleEditedNameChange(index, e.target.value)}
                                                    />
                                                    <div className="highlighted-name-display">
                                                        {simpleRenderHighlightedName(s.originalName, s.currentName)}
                                                    </div>
                                                </div>
                                                {/* Live values displayed constantly, so no need for conditional rendering here */}
                                                <div className="live-values">
                                                    <p>First Name Value: <b>{s.firstNameValue}</b></p>
                                                    <p>Expression: <b>{s.expressionNumber}</b></p>
                                                    <p>Soul Urge: <b>{s.soulUrgeNumber}</b></p>
                                                    <p>Personality: <b>{s.personalityNumber}</b></p>
                                                    {s.karmicDebtPresent && <p className="karmic-debt-flag">⚠️ Karmic Debt Present</p>}
                                                </div>
                                                {s.validationResult && (
                                                    <div className={`validation-result ${s.validationResult.is_valid ? 'valid' : 'invalid'}`}>
                                                        <p className="validation-status">
                                                            <b>Validation:</b> <span className={s.validationResult.is_valid ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{s.validationResult.is_valid ? 'VALID' : 'INVALID'}</span>
                                                        </p>
                                                        {/* Rationale removed from here as per user request */}
                                                    </div>
                                                )}
                                                <div className="button-group">
                                                    <button onClick={() => handleSaveEdit(index)} className="primary-btn small-btn">Save</button>
                                                    <button onClick={() => handleCancelEdit(index)} className="secondary-btn small-btn">Cancel</button>
                                                    <button onClick={() => handleValidateName(s.currentName, false, index)} className="secondary-btn small-btn" disabled={!clientProfile}>Re-Validate</button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <h3>{s.currentName} (Expression: {s.expressionNumber})</h3>
                                                {/* Rationale is hidden for initial suggestions as per request */}
                                                {/* Live values displayed constantly */}
                                                <div className="live-values">
                                                    <p>First Name Value: <b>{s.firstNameValue}</b></p>
                                                    <p>Expression: <b>{s.expressionNumber}</b></p>
                                                    <p>Soul Urge: <b>{s.soulUrgeNumber}</b></p>
                                                    <p>Personality: <b>{s.personalityNumber}</b></p>
                                                    {s.karmicDebtPresent && <p className="karmic-debt-flag">⚠️ Karmic Debt Present</p>}
                                                </div>
                                                {s.validationResult && (
                                                    <div className={`validation-result ${s.validationResult.is_valid ? 'valid' : 'invalid'}`}>
                                                        <p className="validation-status">
                                                            <b>Validation:</b> <span className={s.validationResult.is_valid ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{s.validationResult.is_valid ? 'VALID' : 'INVALID'}</span>
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="button-group">
                                                    <button onClick={() => handleEditSuggestion(index)} className="secondary-btn small-btn">Edit Name</button>
                                                    <button
                                                        onClick={() => handleConfirmSuggestion(s)}
                                                        className={`primary-btn small-btn ${confirmedSuggestions.some(cs => cs.name === s.currentName) ? 'disabled-btn' : ''}`}
                                                        disabled={confirmedSuggestions.some(cs => cs.name === s.currentName)}
                                                    >
                                                        {confirmedSuggestions.some(cs => cs.name === s.currentName) ? 'Confirmed!' : 'Confirm This Name'}
                                                    </button>
                                                    <button onClick={() => handleValidateName(s.currentName, false, index)} className="secondary-btn small-btn" disabled={!clientProfile}>Validate</button>
                                                </div>
                                            </>
                                        )}
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
                            {confirmedSuggestions.length > 0 && (
                                <div className="confirmed-suggestions-list mt-4 mb-4">
                                    <h3 className="font-bold text-lg mb-2">Your Confirmed Names:</h3>
                                    {confirmedSuggestions.map((s, index) => (
                                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg mb-2">
                                            <span>{s.name} (Exp: {s.expression_number})</span>
                                            <button 
                                                onClick={() => handleRemoveConfirmedSuggestion(s.name)} 
                                                className="secondary-btn small-btn"
                                                style={{width: 'auto', margin: '0'}} // Override default button styles
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button onClick={handleGenerateReport} className="primary-btn" disabled={!clientProfile || confirmedSuggestions.length === 0}>Generate Comprehensive Report (PDF & Preview)</button>
                            {reportPreviewContent && (
                                <div className="report-preview-area" dangerouslySetInnerHTML={{ __html: marked.parse(String(reportPreviewContent || '')) }}>
                                </div>
                            )}
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
// END OF App.js - DO NOT DELETE THIS LINE
