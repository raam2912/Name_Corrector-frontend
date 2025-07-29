import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { marked } from 'marked'; // Corrected: For rendering Markdown in report preview
import debounce from 'lodash.debounce'; // Correctly imported debounce

import './App.css'; // Import the CSS file for styling

// Configure your backend URL
const BACKEND_URL = 'https://name-corrector-backend.onrender.com'; // <<< IMPORTANT: REPLACE THIS WITH YOUR RENDER BACKEND URL


// --- Client-Side Numerology Calculation Functions (Ported from Backend) ---
// These are essential for live updates without constant server calls.
const CHALDEAN_MAP = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 8, G: 3,
  H: 5, I: 1, J: 1, K: 2, L: 3, M: 4, N: 5,
  O: 7, P: 8, Q: 1, R: 2, S: 3, T: 4, U: 6,
  V: 6, W: 6, X: 5, Y: 1, Z: 7
};
const MASTER_NUMBERS = new Set([11, 22, 33]);
const KARMIC_DEBT_NUMBERS = new Set([13, 14, 16, 19]);
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
// eslint-disable-next-line no-unused-vars
const EXPRESSION_COMPATIBILITY_MAP = {
  1: [1, 3, 5, 6],
  2: [2, 4, 6, 9],
  3: [1, 3, 5, 6, 9],
  4: [1, 5, 6],
  5: [1, 3, 5, 6, 9],
  6: [3, 5, 6, 9],
  7: [1, 5, 6, 9],
  8: [1, 3, 5, 6],
  9: [3, 6, 9],
  11: [2, 6, 11, 22],
  22: [4, 6, 8, 22],
  33: [6, 9, 33],
};

const LUCKY_NAME_NUMBERS = new Set([1, 3, 5, 6, 9, 11, 22, 33]);
const UNLUCKY_NAME_NUMBERS = new Set([4, 8, 13, 14, 16, 19]);


function isValidNameNumber(expressionNum, rawSum) {
    return LUCKY_NAME_NUMBERS.has(expressionNum) && !UNLUCKY_NAME_NUMBERS.has(expressionNum) && !KARMIC_DEBT_NUMBERS.has(rawSum);
}

function evaluateInitialNameValidity(name) {
    const cleaned = cleanName(name);
    let sum = 0;
    for (const char of cleaned) {
        sum += getChaldeanValue(char);
    }
    const expression = calculateSingleDigit(sum, true);
    return {
        isValid: isValidNameNumber(expression, sum),
        rawSum: sum,
        expressionNumber: expression,
    };
}
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
    // eslint-disable-next-line no-unused-vars
    const [desiredOutcome, setDesiredOutcome] = useState('');

    const [clientProfile, setClientProfile] = useState(null);
    const [initialNameValidation, setInitialNameValidation] = useState(null); // ✨ NEW: State for initial name validation
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
        // The desired_outcome field is removed from the profile data display
        return `
            <h3 class="font-bold">Basic Info:</h3>
            <p><b>Full Name:</b> ${profile.full_name}</p>
            <p><b>Birth Date:</b> ${profile.birth_date}</p>
            ${profile.birth_time ? `<p><b>Birth Time:</b> ${profile.birth_time}</p>` : ''}
            ${profile.birth_place ? `<p><b>Birth Place:</b> ${profile.birth_place}</p>` : ''}
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
        // desiredOutcome is no longer required for the initial call
        if (!fullName || !birthDate) {
            openModal("Please fill in Full Name and Birth Date to get suggestions.");
            return;
        }

        setIsLoading(true);
        setInitialNameValidation(null); // ✨ NEW: Reset initial validation state
        try {
            // desiredOutcome is no longer sent to the backend
            const response = await axios.post(`${BACKEND_URL}/initial_suggestions`, {
                full_name: fullName,
                birth_date: birthDate,
                birth_time: birthTime,
                birth_place: birthPlace,
            });
            setSuggestions(response.data.suggestions);
            
            // Ensure profile_data is present and an object before setting clientProfile
            const profileData = response.data.profile_data;
            if (profileData && typeof profileData === 'object') {
                setClientProfile(profileData); 
                console.log("Client Profile set successfully:", profileData);
                
                // ✨ NEW: Automatically validate the client's original name
                try {
                    const validationResponse = await axios.post(`${BACKEND_URL}/validate_name`, {
                        suggested_name: fullName, // Use the original name from the input field
                        client_profile: profileData,
                    });
                    setInitialNameValidation(validationResponse.data);
                    console.log("Initial name validation successful:", validationResponse.data);
                } catch (validationError) {
                    console.error('Could not validate the initial name:', validationError);
                    setInitialNameValidation(null);
                }
            } else {
                console.error("Backend did not return valid profile_data in initial_suggestions response:", response.data.profile_data);
                openModal("Failed to load client profile due to invalid data from backend. Please try again or contact support.");
            }
            setConfirmedSuggestions([]);
            setCurrentPage(0);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            openModal(error.response?.data?.error || 'Failed to get suggestions. Please check your backend server.');
        } finally {
            setIsLoading(false);
        }
    }, [fullName, birthDate, birthTime, birthPlace, openModal, setSuggestions, setClientProfile, setConfirmedSuggestions, setIsLoading, setCurrentPage]);

    // handleValidateName now accepts the currentClientProfile directly
    const handleValidateName = useCallback(async (nameToValidate, currentClientProfile, isCustom = false, suggestionIndex = null) => {
        if (!currentClientProfile) {
            openModal("Please get initial suggestions first to generate your numerology profile before validating names.");
            console.error("Validation attempted with null clientProfile. Aborting API call.");
            return;
        }
        
        if (!nameToValidate.trim()) {
            if (!isCustom) {
                setEditableSuggestions(prev => prev.map((s, idx) =>
                    idx === suggestionIndex ? { ...s, validationResult: null } : s
                ));
            } else {
                setBackendValidationResult(null);
            }
            console.log(`Validation skipped: Name is empty or whitespace for ${isCustom ? 'custom input' : `suggestion ${suggestionIndex}`}`);
            return;
        }

        setIsLoading(true);
        try {
            console.log(`Sending validation request for: "${nameToValidate}"`);
            console.log('Client Profile for validation (sent to backend):', currentClientProfile);
            const response = await axios.post(`${BACKEND_URL}/validate_name`, {
                suggested_name: nameToValidate,
                client_profile: currentClientProfile,
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
            // The desired_outcome is no longer sent to the backend for report generation
            const reportPayload = {
                full_name: clientProfile.full_name,
                birth_date: clientProfile.birth_date,
                birth_time: clientProfile.birth_time,
                birth_place: clientProfile.birth_place,
                confirmed_suggestions: confirmedSuggestions,
            };

            const textReportResponse = await axios.post(`${BACKEND_URL}/generate_text_report`, reportPayload);
            setReportPreviewContent(textReportResponse.data.report_content);

            const pdfResponse = await axios.post(`${BACKEND_URL}/generate_pdf_report`, reportPayload, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([pdfResponse.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Numerology_Report_${clientProfile.full_name.replace(/ /g, '_')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error generating report:', error);
            openModal(error.response?.data?.error || 'Failed to generate report. Please check your backend server.');
        } finally {
            setIsLoading(false);
        }
    }, [clientProfile, confirmedSuggestions, openModal, setReportPreviewContent, setIsLoading]);

    // --- Effects ---
    useEffect(() => {
  if (suggestions.length > 0) {
    const initialEditable = suggestions.map((s, index) => {
      const name = typeof s === 'string' ? s : s.name; // fallback if s is a string

      const firstNameValue = calculateFirstNameValue(name);
      const expressionNumber = calculateExpressionNumber(name);
      const soulUrgeNumber = calculateSoulUrgeNumber(name);
      const personalityNumber = calculatePersonalityNumber(name);
      const karmicDebtPresent = checkKarmicDebt(name);
      const firstName = name.split(' ')[0];
      const rawSum = name
        .toUpperCase()
        .split('')
        .map(getChaldeanValue)
        .reduce((acc, val) => acc + val, 0);
      const isValid = isValidNameNumber(expressionNumber, rawSum);

      return {
        ...s,
        id: index,
        currentName: name,
        currentFirstName: firstName,
        originalName: name,
        firstNameValue,
        expressionNumber,
        soulUrgeNumber,
        personalityNumber,
        karmicDebtPresent,
        isEdited: false,
        validationResult: isValid
      };
    });
    setEditableSuggestions(initialEditable);
  }
}, [suggestions]);


    const updateLiveValidationDisplayCore = useCallback((name, currentClientProfile) => {
        if (!name.trim() || !currentClientProfile) {
            setLiveValidationOutput(null);
            setBackendValidationResult(null);
            return;
        }

        const expNum = calculateExpressionNumber(name);
        const birthDateStr = currentClientProfile.birth_date;
        const loShu = calculateLoShuGrid(birthDateStr, expNum);
        const birthDayNum = calculateBirthDayNumber(birthDateStr);
        const lifePathNum = calculateLifePathNumber(birthDateStr);
        const soulUrgeNum = calculateSoulUrgeNumber(name);
        const personalityNum = calculatePersonalityNumber(name);
        const karmicDebtPresent = checkKarmicDebt(name);

        setLiveValidationOutput({
            name,
            firstNameValue: calculateFirstNameValue(name),
            expressionNumber: expNum,
            soulUrgeNumber: soulUrgeNum,
            personalityNumber: personalityNum,
            karmicDebtPresent: karmicDebtPresent,
            birthDayNumber: birthDayNum,
            lifePathNumber: lifePathNum,
            loShuGridCounts: loShu.grid_counts,
            loShuMissingNumbers: loShu.missing_numbers,
        });

        handleValidateName(name, currentClientProfile, true, null);
    }, [handleValidateName]);

    const debouncedUpdateLiveValidationDisplay = useRef(
        debounce((name, profile) => updateLiveValidationDisplayCore(name, profile), 300)
    ).current;

    useEffect(() => {
        if (clientProfileRef.current && customNameInput.trim()) { 
            debouncedUpdateLiveValidationDisplay(customNameInput, clientProfileRef.current);
        } else {
            setLiveValidationOutput(null);
            setBackendValidationResult(null);
        }
    }, [customNameInput, debouncedUpdateLiveValidationDisplay]);

    const handleConfirmSuggestion = useCallback((suggestion) => {
        if (!suggestion.isValid) {
  openModal("❌ This name is not numerologically compatible. Please choose a valid, lucky name aligned with your Life Path.");
  return;
}
        
        const nameToConfirm = suggestion.currentName;
        
        const isAlreadyConfirmed = confirmedSuggestions.some(
            (s) => s.name === nameToConfirm
        );

        if (isAlreadyConfirmed) {
            openModal(`'${nameToConfirm}' is already in your confirmed list.`);
            return;
        }

        const expressionToConfirm = suggestion.expressionNumber;

        setConfirmedSuggestions(prev => [
            ...prev,
            {
                name: nameToConfirm,
                expression_number: expressionToConfirm,
                rationale: suggestion.validationResult?.rationale || suggestion.rationale,
            }
        ]);
        openModal(`'${nameToConfirm}' has been added to your confirmed list.`);

    }, [confirmedSuggestions, openModal]);

    const handleRemoveConfirmedSuggestion = useCallback((nameToRemove) => {
        setConfirmedSuggestions(prev => prev.filter(s => s.name !== nameToRemove));
        openModal(`'${nameToRemove}' has been removed from confirmed list.`);
    }, [openModal]);


    const validateSuggestionNameBackendCore = useCallback((name, index) => {
        if (clientProfileRef.current) {
            handleValidateName(name, clientProfileRef.current, false, index);
        } else {
            console.warn("Cannot validate suggestion: clientProfile is null.");
            openModal("Please get initial suggestions first to generate your numerology profile before validating names.");
        }
    }, [handleValidateName, openModal]);

    const debouncedValidateSuggestionNameBackend = useRef(
        debounce((name, index) => validateSuggestionNameBackendCore(name, index), 500)
    ).current;

    const handleNameChange = useCallback((index, newFullName) => {
        setEditableSuggestions(prev => prev.map((s, idx) => {
            if (idx === index) {
                const updatedSuggestion = { ...s, currentName: newFullName, isEdited: true };
                updatedSuggestion.firstNameValue = calculateFirstNameValue(newFullName);
                updatedSuggestion.expressionNumber = calculateExpressionNumber(newFullName);
                updatedSuggestion.soulUrgeNumber = calculateSoulUrgeNumber(newFullName);
                updatedSuggestion.personalityNumber = calculatePersonalityNumber(newFullName);
                updatedSuggestion.karmicDebtPresent = checkKarmicDebt(newFullName);
                updatedSuggestion.currentFirstName = newFullName.split(' ')[0];

                if (newFullName.trim()) {
                    debouncedValidateSuggestionNameBackend(newFullName, index);
                } else {
                    updatedSuggestion.validationResult = null;
                }
                return updatedSuggestion;
            }
            return s;
        }));
    }, [debouncedValidateSuggestionNameBackend]);
    
    const handleFirstNameChange = useCallback((index, newFirstName) => {
        setEditableSuggestions(prev => prev.map((s, idx) => {
            if (idx === index) {
                const originalParts = s.currentName.split(' ');
                const newFullName = [newFirstName, ...originalParts.slice(1)].join(' ');
                const updatedSuggestion = { ...s, currentName: newFullName, currentFirstName: newFirstName, isEdited: true };
                updatedSuggestion.firstNameValue = calculateFirstNameValue(newFullName);
                updatedSuggestion.expressionNumber = calculateExpressionNumber(newFullName);
                updatedSuggestion.soulUrgeNumber = calculateSoulUrgeNumber(newFullName);
                updatedSuggestion.personalityNumber = calculatePersonalityNumber(newFullName);
                updatedSuggestion.karmicDebtPresent = checkKarmicDebt(newFullName);

                if (newFullName.trim()) {
                    debouncedValidateSuggestionNameBackend(newFullName, index);
                } else {
                    updatedSuggestion.validationResult = null;
                }
                return updatedSuggestion;
            }
            return s;
        }));
    }, [debouncedValidateSuggestionNameBackend]);


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
        <div className="app-container">
            <div className="main-content-wrapper">
                <h1 className="main-title">Sheelaa's Numerology Portal</h1>

                <div className="section-card input-form-card">
                    <h2>Client Information</h2>
                    <div className="form-grid">
                        <div className="input-group">
                            <label htmlFor="fullName" className="input-label">Full Name:</label>
                            <input type="text" id="fullName" placeholder="e.g., John Doe" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                            {fullName && (() => {
    const evalResult = evaluateInitialNameValidity(fullName);
    return (
        <div style={{ marginTop: '0.5rem' }}>
            <p><strong>Initial Name Status:</strong> <span style={{ color: evalResult.isValid ? 'green' : 'red' }}>
                {evalResult.isValid ? 'VALID ✅' : 'INVALID ❌'}
            </span> (Expression: {evalResult.expressionNumber}, Sum: {evalResult.rawSum})</p>
        </div>
    );
})()}
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
                        {/* The "Desired Outcome" input field is now removed from the UI */}
                    </div>
                    <button onClick={getInitialSuggestions} className="primary-btn">Get Initial Suggestions</button>
                </div>

                <div className="two-column-layout">
                    <div className="section-card profile-display-card">
                        <h2>Client Numerology Profile</h2>
                        {clientProfile ? (
                            <>
                                {/* ✨ NEW: Display for initial name validation */}
                                {initialNameValidation && (
                                    <div className={`validation-result ${initialNameValidation.is_valid ? 'valid' : 'invalid'}`}>
                                        <strong>Initial Name Status:</strong> {initialNameValidation.is_valid ? 'Valid ✅' : 'Invalid ❌'}
                                        <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-sm)', color: 'inherit' }}>
                                            {initialNameValidation.rationale}
                                        </p>
                                    </div>
                                )}
                                <div className="profile-details-content" dangerouslySetInnerHTML={{ __html: formatProfileData(clientProfile) }}>
                                </div>
                            </>
                        ) : (
                            <p className="text-muted">Please fill in your details and click "Get Initial Suggestions" to load your numerology profile.</p>
                        )}
                    </div>

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
                                    <div className="validation-grid">
                                        <p><b>Name:</b> {customNameInput}</p>
                                        <p><b>First Name Value:</b> {liveValidationOutput.firstNameValue}</p>
                                        <p><b>Expression Number:</b> {liveValidationOutput.expressionNumber}</p>
                                        <p><b>Soul Urge:</b> {liveValidationOutput.soulUrgeNumber}</p>
                                        <p><b>Personality:</b> {liveValidationOutput.personalityNumber}</p>
                                        <p><b>Karmic Debt:</b> {liveValidationOutput.karmicDebtPresent ? 'Yes ⚠️' : 'No'}</p>
                                    </div>
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
                </div>

                {editableSuggestions.length > 0 && (
                    <div className="section-card suggestions-display-card">
                        <div className="pseudo-table-header-controls">
                            <h2>Suggested Name Variations</h2>
                        </div>
                        <p className="text-sm text-gray-700 mb-3">
                           Here are the suggested names. You can edit, validate, and confirm them directly in the list.
                        </p>
                        <div className="pseudo-table-responsive">
                            <div className="pseudo-table-header">
                                <div className="pseudo-table-cell header">Suggested Name</div>
                                <div className="pseudo-table-cell header">First Name Value</div>
                                <div className="pseudo-table-cell header">Expression Number</div>
                                <div className="pseudo-table-cell header">Valid</div>
                                <div className="pseudo-table-cell header">Actions</div>
                            </div>
                            <div className="pseudo-table-body">
                                {paginatedSuggestions.map((s) => (
                                    <div key={s.id} className="pseudo-table-row">
                                        <div className="pseudo-table-cell name-editing-cell">
                                            <span className="cell-label">Suggested Name:</span>
                                            <input
                                                type="text"
                                                value={s.currentName}
                                                onChange={(e) => handleNameChange(s.id, e.target.value)}
                                                className="pseudo-table-input full-name-input"
                                                aria-label={`Edit full name for ${s.originalName}`}
                                            />
                                            <div className="first-name-edit-section">
                                                <span className="cell-label">First Name:</span>
                                                <input
                                                    type="text"
                                                    value={s.currentFirstName}
                                                    onChange={(e) => handleFirstNameChange(s.id, e.target.value)}
                                                    className="pseudo-table-input first-name-input"
                                                    aria-label={`Edit first name for ${s.originalName}`}
                                                />
                                                <span className="first-name-score">Score: {calculateFirstNameValue(s.currentFirstName)}</span>
                                            </div>
                                        </div>
                                        <div className="pseudo-table-cell">
                                            <span className="cell-label">First Name Value:</span>
                                            {s.firstNameValue}
                                        </div>
                                        <div className="pseudo-table-cell">
                                            <span className="cell-label">Expression Number:</span>
                                            {s.expressionNumber}
                                        </div>
                                        <div className="pseudo-table-cell">
                                            <span className="cell-label">Valid:</span>
                                            {s.validationResult ? (
                                                s.validationResult.is_valid ? '✅' : '❌'
                                            ) : (
                                                '--'
                                            )}
                                        </div>
                                        <div className="pseudo-table-cell actions-cell">
                                            <span className="cell-label">Actions:</span>
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
                                        </div>
                                    </div>
                                ))}
                            </div>
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


                {clientProfile && (
                    <div className="section-card report-generation-card">
                        <h2>Generate Reports</h2>
                         {confirmedSuggestions.length > 0 ? (
                            <div className="confirmed-suggestions-list mt-4 mb-4">
                                <h3 className="font-bold text-lg mb-2">Your Confirmed Names:</h3>
                                <div className="confirmed-names-grid">
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

            {isLoading && (
                <div className="loading-overlay">
                    <div className="loader"></div>
                    <p>Loading...</p>
                </div>
            )}

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

