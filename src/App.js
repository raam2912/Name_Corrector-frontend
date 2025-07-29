/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { marked } from 'marked'; // Corrected: For rendering Markdown in report preview
import debounce from 'lodash.debounce'; // Correctly imported debounce
import _ from 'lodash';

import './App.css'; // Import the CSS file for styling

// Configure your backend URL
const BACKEND_URL = 'https://name-corrector-backend.onrender.com'; // <<< IMPORTANT: REPLACE THIS WITH YOUR RENDER BACKEND URL

// --- ENHANCED CLIENT-SIDE CHALDEAN NUMEROLOGY CALCULATIONS ---
const CHALDEAN_MAP = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 8, G: 3,
  H: 5, I: 1, J: 1, K: 2, L: 3, M: 4, N: 5,
  O: 7, P: 8, Q: 1, R: 2, S: 3, T: 4, U: 6,
  V: 6, W: 6, X: 5, Y: 1, Z: 7
};

const MASTER_NUMBERS = new Set([11, 22, 33]);
const KARMIC_DEBT_NUMBERS = new Set([13, 14, 16, 19]);
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// ENHANCED CHALDEAN COMPATIBILITY MATRIX
const LIFE_PATH_EXPRESSION_COMPATIBILITY = {
  1: [1, 3, 5, 6],
  2: [2, 4, 6, 9],
  3: [1, 3, 5, 6, 9],
  4: [1, 5, 6], // NEVER 4 or 8
  5: [1, 3, 5, 6, 9],
  6: [3, 5, 6, 9],
  7: [1, 5, 6, 9], // avoid 7, 8
  8: [1, 3, 5, 6], // NEVER 4 or 8
  9: [3, 6, 9],
  11: [2, 6, 11, 22],
  22: [4, 6, 8, 22], // Exception: Can have 4, 8
  33: [6, 9, 33],
};

// LUCKY AND UNLUCKY NUMBERS
const LUCKY_EXPRESSION_NUMBERS = new Set([1, 3, 5, 6, 9, 11, 22, 33]);
const UNLUCKY_EXPRESSION_NUMBERS = new Set([4, 8]); // 7 sometimes unlucky
const FORBIDDEN_COMBINATIONS = new Set([4, 8]); // The 4-8 trap

// PRIORITY SCORING SYSTEM
const getExpressionNumberPriority = (expressionNum, lifePathNum) => {
  // Check if it's a forbidden number first
  if (UNLUCKY_EXPRESSION_NUMBERS.has(expressionNum)) {
    // Exception for Life Path 2 (can have Expression 4) and Life Path 22 (can have Expression 8)
    if (!(lifePathNum === 2 && expressionNum === 4) && !(lifePathNum === 22 && expressionNum === 8)) {
      return { priority: 1, label: "★☆☆☆☆ FORBIDDEN", class: "priority-forbidden" };
    }
  }

  // Check Life Path compatibility
  const compatibleNumbers = LIFE_PATH_EXPRESSION_COMPATIBILITY[lifePathNum] || [];
  if (!compatibleNumbers.includes(expressionNum)) {
    return { priority: 2, label: "★★☆☆☆ INCOMPATIBLE", class: "priority-incompatible" };
  }

  // Check if it's a lucky number
  if (LUCKY_EXPRESSION_NUMBERS.has(expressionNum)) {
    if ([1, 3, 5, 6, 9].includes(expressionNum)) {
      return { priority: 5, label: "★★★★★ PREMIUM", class: "priority-premium" };
    }
    if ([11, 22, 33].includes(expressionNum)) {
      return { priority: 4, label: "★★★★☆ MASTER", class: "priority-master" };
    }
  }

  return { priority: 3, label: "★★★☆☆ ACCEPTABLE", class: "priority-acceptable" };
};

// ENHANCED VALIDATION FUNCTION
function isValidNameNumber(expressionNum, rawSum, lifePathNum = null) {
  // Check for karmic debt in raw sum
  if (KARMIC_DEBT_NUMBERS.has(rawSum)) {
    return false;
  }

  // Check if it's a forbidden number (4-8 trap)
  if (UNLUCKY_EXPRESSION_NUMBERS.has(expressionNum)) {
    // Exception for Life Path 2 (can have Expression 4) and Life Path 22 (can have Expression 8)
    if (!(lifePathNum === 2 && expressionNum === 4) && !(lifePathNum === 22 && expressionNum === 8)) {
      return false;
    }
  }

  // If Life Path is provided, check compatibility
  if (lifePathNum !== null) {
    const compatibleNumbers = LIFE_PATH_EXPRESSION_COMPATIBILITY[lifePathNum] || [];
    if (!compatibleNumbers.includes(expressionNum)) {
      return false;
    }
  }

  // Must be a lucky number
  return LUCKY_EXPRESSION_NUMBERS.has(expressionNum);
}

// ENHANCED NAME COMPATIBILITY CHECKER
function getNameCompatibilityAnalysis(expressionNum, lifePathNum, rawSum) {
  const analysis = {
    isValid: false,
    priority: getExpressionNumberPriority(expressionNum, lifePathNum),
    conflicts: [],
    benefits: [],
    recommendation: ""
  };

  // Check for karmic debt
  if (KARMIC_DEBT_NUMBERS.has(rawSum)) {
    analysis.conflicts.push(`Karmic Debt detected (${rawSum}) - avoid this combination`);
  }

  // Check 4-8 trap
  if (UNLUCKY_EXPRESSION_NUMBERS.has(expressionNum)) {
    if (!(lifePathNum === 2 && expressionNum === 4) && !(lifePathNum === 22 && expressionNum === 8)) {
      analysis.conflicts.push(`Expression ${expressionNum} creates the 4-8 trap - brings instability and delays`);
    }
  }

  // Check Life Path compatibility
  const compatibleNumbers = LIFE_PATH_EXPRESSION_COMPATIBILITY[lifePathNum] || [];
  if (!compatibleNumbers.includes(expressionNum)) {
    analysis.conflicts.push(`Expression ${expressionNum} conflicts with Life Path ${lifePathNum} - creates karmic obstacles`);
  } else {
    analysis.benefits.push(`Expression ${expressionNum} harmoniously vibrates with Life Path ${lifePathNum}`);
  }

  // Check if it's a lucky number
  if (LUCKY_EXPRESSION_NUMBERS.has(expressionNum)) {
    if ([1, 3, 5, 6, 9].includes(expressionNum)) {
      analysis.benefits.push(`Expression ${expressionNum} is a fortunate number - enhances success and confidence`);
    }
    if ([11, 22, 33].includes(expressionNum)) {
      analysis.benefits.push(`Expression ${expressionNum} is a Master Number - brings heightened spiritual potential`);
    }
  }

  // Final validation
  analysis.isValid = isValidNameNumber(expressionNum, rawSum, lifePathNum);

  // Generate recommendation
  if (analysis.isValid) {
    analysis.recommendation = `✅ RECOMMENDED: This name creates positive energetic alignment with your Life Path ${lifePathNum}`;
  } else {
    analysis.recommendation = `❌ NOT RECOMMENDED: This name creates conflicts or karmic obstacles for Life Path ${lifePathNum}`;
  }

  return analysis;
}

// --- EXISTING CALCULATION FUNCTIONS (Enhanced) ---
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

function calculateRawSum(fullName) {
    const cleanedName = cleanName(fullName);
    let total = 0;
    for (const char of cleanedName) {
        total += getChaldeanValue(char);
    }
    return total; // Return unreduced sum for karmic debt checking
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
    const rawSum = calculateRawSum(fullName);
    return KARMIC_DEBT_NUMBERS.has(rawSum);
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

// --- MAIN COMPONENT ---
function App() {
    // --- State Management ---
    const [fullName, setFullName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [birthTime, setBirthTime] = useState('');
    const [birthPlace, setBirthPlace] = useState('');

    const [clientProfile, setClientProfile] = useState(null);
   
    // Use a ref to always have the latest clientProfile available in callbacks
    const clientProfileRef = useRef(clientProfile);
    useEffect(() => {
        clientProfileRef.current = clientProfile;
    }, [clientProfile]);

    const [suggestions, setSuggestions] = useState([]); // Original suggestions from backend
    const [editableSuggestions, setEditableSuggestions] = useState([]); // Suggestions with edit state and live calculated values
    const [confirmedSuggestions, setConfirmedSuggestions] = useState([]);
    
    const [customNameInput, setCustomNameInput] = useState('');
    const [liveValidationOutput, setLiveValidationOutput] = useState(null); // For live client-side calcs of custom input
    const [backendValidationResult, setBackendValidationResult] = useState(null); // For custom validation section

    const [setReportPreviewContent] = useState('');
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

    // --- API Call Functions ---
    const getInitialSuggestions = useCallback(async () => {
        if (!fullName || !birthDate) {
            openModal("Please fill in Full Name and Birth Date to get suggestions.");
            return;
        }

        setIsLoading(true);
        
        try {
            const response = await axios.post(`${BACKEND_URL}/initial_suggestions`, {
                full_name: fullName,
                birth_date: birthDate,
                birth_time: birthTime,
                birth_place: birthPlace,
            });
            setSuggestions(response.data.suggestions);
            console.log("💡 Suggestions received:", response.data.suggestions);
            
            const profileData = response.data.profile_data;
            if (profileData && typeof profileData === 'object') {
                setClientProfile(profileData); 
                console.log("Client Profile set successfully:", profileData);
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
    }, [fullName, birthDate, birthTime, birthPlace, openModal]);

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
    }, [openModal]);

    const handleGenerateReport = useCallback(async () => {
        if (!clientProfile || confirmedSuggestions.length === 0) {
            openModal("Please generate your profile and confirm at least one name suggestion before generating the report.");
            return;
        }

        setIsLoading(true);
        try {
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
    }, [clientProfile, confirmedSuggestions, openModal, setReportPreviewContent]);

    // --- Enhanced Effects ---
    useEffect(() => {
        if (suggestions.length > 0 && clientProfile) {
            const lifePathNum = clientProfile.life_path_number;
            
            const initialEditable = suggestions.map((s, index) => {
                const name = typeof s === 'string' ? s : s.name;
                const firstNameValue = calculateFirstNameValue(name);
                const expressionNumber = calculateExpressionNumber(name);
                const rawSum = calculateRawSum(name);
                const soulUrgeNumber = calculateSoulUrgeNumber(name);
                const personalityNumber = calculatePersonalityNumber(name);
                const karmicDebtPresent = checkKarmicDebt(name);
                const firstName = name.split(' ')[0];
                
                // Enhanced validation with Life Path compatibility
                const isValid = isValidNameNumber(expressionNumber, rawSum, lifePathNum);
                const compatibilityAnalysis = getNameCompatibilityAnalysis(expressionNumber, lifePathNum, rawSum);

                return {
                    ...s,
                    id: index,
                    currentName: name,
                    currentFirstName: firstName,
                    originalName: name,
                    firstNameValue,
                    expressionNumber,
                    rawSum,
                    soulUrgeNumber,
                    personalityNumber,
                    karmicDebtPresent,
                    isEdited: false,
                    isValid,
                    compatibilityAnalysis,
                    validationResult: isValid
                };
            });
            setEditableSuggestions(initialEditable);
        }
    }, [suggestions, clientProfile]);

    const updateLiveValidationDisplayCore = useCallback((name, currentClientProfile) => {
        if (!name.trim() || !currentClientProfile) {
            setLiveValidationOutput(null);
            setBackendValidationResult(null);
            return;
        }

        const expNum = calculateExpressionNumber(name);
        const rawSum = calculateRawSum(name);
        const birthDateStr = currentClientProfile.birth_date;
        const lifePathNum = currentClientProfile.life_path_number;
        const loShu = calculateLoShuGrid(birthDateStr, expNum);
        const birthDayNum = calculateBirthDayNumber(birthDateStr);
        const soulUrgeNum = calculateSoulUrgeNumber(name);
        const personalityNum = calculatePersonalityNumber(name);
        const karmicDebtPresent = checkKarmicDebt(name);
        
        // Enhanced compatibility analysis
        const compatibilityAnalysis = getNameCompatibilityAnalysis(expNum, lifePathNum, rawSum);

        setLiveValidationOutput({
            name,
            firstNameValue: calculateFirstNameValue(name),
            expressionNumber: expNum,
            rawSum,
            soulUrgeNumber: soulUrgeNum,
            personalityNumber: personalityNum,
            karmicDebtPresent: karmicDebtPresent,
            birthDayNumber: birthDayNum,
            lifePathNumber: lifePathNum,
            loShuGridCounts: loShu.grid_counts,
            loShuMissingNumbers: loShu.missing_numbers,
            compatibilityAnalysis
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
                const lifePathNum = clientProfile?.life_path_number;
                const expressionNumber = calculateExpressionNumber(newFullName);
                const rawSum = calculateRawSum(newFullName);
                const isValid = isValidNameNumber(expressionNumber, rawSum, lifePathNum);
                const compatibilityAnalysis = lifePathNum ? getNameCompatibilityAnalysis(expressionNumber, lifePathNum, rawSum) : null;

                const updatedSuggestion = { 
                    ...s, 
                    currentName: newFullName, 
                    isEdited: true,
                    isValid,
                    compatibilityAnalysis
                };
                updatedSuggestion.firstNameValue = calculateFirstNameValue(newFullName);
                updatedSuggestion.expressionNumber = expressionNumber;
                updatedSuggestion.rawSum = rawSum;
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
    }, [debouncedValidateSuggestionNameBackend, clientProfile]);

    const handleFirstNameChange = useCallback((index, newFirstName) => {
        setEditableSuggestions(prev => prev.map((s, idx) => {
            if (idx === index) {
                const originalParts = s.currentName.split(' ');
                const newFullName = [newFirstName, ...originalParts.slice(1)].join(' ');
                const lifePathNum = clientProfile?.life_path_number;
                const expressionNumber = calculateExpressionNumber(newFullName);
                const rawSum = calculateRawSum(newFullName);
                const isValid = isValidNameNumber(expressionNumber, rawSum, lifePathNum);
                const compatibilityAnalysis = lifePathNum ? getNameCompatibilityAnalysis(expressionNumber, lifePathNum, rawSum) : null;

                const updatedSuggestion = { 
                    ...s, 
                    currentName: newFullName, 
                    currentFirstName: newFirstName, 
                    isEdited: true,
                    isValid,
                    compatibilityAnalysis
                };
                updatedSuggestion.firstNameValue = calculateFirstNameValue(newFullName);
                updatedSuggestion.expressionNumber = expressionNumber;
                updatedSuggestion.rawSum = rawSum;
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
    }, [debouncedValidateSuggestionNameBackend, clientProfile]);

    // Pagination
    const SUGGESTIONS_PER_PAGE = 5;
    const [currentPage, setCurrentPage] = useState(0);

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

    // Enhanced live validation for input names
    const getLiveNameAnalysis = (name, birthDate) => {
        if (!name.trim() || !birthDate) return null;
        
        const lifePathNum = calculateLifePathNumber(birthDate);
        const expressionNum = calculateExpressionNumber(name);
        const rawSum = calculateRawSum(name);
        const firstNameValue = calculateFirstNameValue(name);
        
        return {
            lifePathNum,
            expressionNum,
            firstNameValue,
            isValid: isValidNameNumber(expressionNum, rawSum, lifePathNum),
            compatibilityAnalysis: getNameCompatibilityAnalysis(expressionNum, lifePathNum, rawSum)
        };
    };

    const currentNameAnalysis = getLiveNameAnalysis(fullName, birthDate);

    return (
        <div className="app-container">
            <div className="main-content-wrapper">
                <h1 className="main-title">Sheelaa's Numerology Portal</h1>
                {isLoading && (
                    <div className="loading-overlay">
                        <p>⏳ Processing numerological calculations...</p>
                    </div>
                )}

                {/* Input Form */}
                <div className="section-card input-form-card">
                    <h2>Client Information</h2>
                    <div className="form-grid">
                        <div className="input-group">
                            <label htmlFor="fullName" className="input-label">Full Name:</label>
                            <input
                                type="text"
                                id="fullName"
                                placeholder="e.g., John Doe"
                                className="input-field"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                            {currentNameAnalysis && (
                                <div className="live-analysis" style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e9ecef' }}>
                                    <p><strong>Live Analysis:</strong></p>
                                    <p>First Name Value: <strong>{currentNameAnalysis.firstNameValue}</strong></p>
                                    <p>Expression Number: <strong>{currentNameAnalysis.expressionNum}</strong></p>
                                    <p>Life Path Number: <strong>{currentNameAnalysis.lifePathNum}</strong></p>
                                    <div className={`compatibility-badge ${currentNameAnalysis.compatibilityAnalysis.priority.class}`}>
                                        {currentNameAnalysis.compatibilityAnalysis.priority.label}
                                    </div>
                                    <p className={currentNameAnalysis.isValid ? 'text-green-600' : 'text-red-600'}>
                                        <strong>{currentNameAnalysis.isValid ? '✅ COMPATIBLE' : '❌ INCOMPATIBLE'}</strong>
                                    </p>
                                    <p style={{ fontSize: '0.9em', fontStyle: 'italic' }}>
                                        {currentNameAnalysis.compatibilityAnalysis.recommendation}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="input-group">
                            <label htmlFor="birthDate" className="input-label">Birth Date:</label>
                            <input
                                type="date"
                                id="birthDate"
                                className="input-field"
                                value={birthDate}
                                onChange={(e) => setBirthDate(e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="birthTime" className="input-label">Birth Time (optional):</label>
                            <input
                                type="time"
                                id="birthTime"
                                placeholder="HH:MM"
                                className="input-field"
                                value={birthTime}
                                onChange={(e) => setBirthTime(e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="birthPlace" className="input-label">Birth Place (optional):</label>
                            <input
                                type="text"
                                id="birthPlace"
                                placeholder="City, Country"
                                className="input-field"
                                value={birthPlace}
                                onChange={(e) => setBirthPlace(e.target.value)}
                            />
                        </div>
                    </div>
                    <button onClick={getInitialSuggestions} className="primary-btn">Get Initial Suggestions</button>
                </div>

                {/* Enhanced Suggested Names Carousel */}
                {editableSuggestions.length > 0 && (
                    <div className="section-card suggestions-carousel">
                        <h2>Suggested Names - Chaldean Compatibility Analysis</h2>

                        <div className="carousel-grid">
                            {paginatedSuggestions.map((s) => (
                                <div key={s.id} className={`name-card ${s.isValid ? 'valid-name' : 'invalid-name'}`}>
                                    <div className="compatibility-header">
                                        <div className={`priority-badge ${s.compatibilityAnalysis?.priority.class || ''}`}>
                                            {s.compatibilityAnalysis?.priority.label || 'Calculating...'}
                                        </div>
                                        <div className={`validity-indicator ${s.isValid ? 'valid' : 'invalid'}`}>
                                            {s.isValid ? '✅ VALID' : '❌ INVALID'}
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label>Full Name</label>
                                        <input
                                            type="text"
                                            value={s.currentName}
                                            onChange={(e) => handleNameChange(s.id, e.target.value)}
                                            className="input-field"
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label>First Name</label>
                                        <input
                                            type="text"
                                            value={s.currentFirstName}
                                            onChange={(e) => handleFirstNameChange(s.id, e.target.value)}
                                            className="input-field"
                                        />
                                        <span className="text-sm text-gray-600">Score: {s.firstNameValue}</span>
                                    </div>

                                    <div className="numerology-summary">
                                        <p><strong>Expression:</strong> {s.expressionNumber}</p>
                                        <p><strong>Soul Urge:</strong> {s.soulUrgeNumber}</p>
                                        <p><strong>Personality:</strong> {s.personalityNumber}</p>
                                        <p><strong>Karmic Debt:</strong> {s.karmicDebtPresent ? '⚠️ Yes' : '✅ No'}</p>
                                    </div>

                                    {s.compatibilityAnalysis && (
                                        <div className="compatibility-analysis">
                                            <h4>Compatibility Analysis:</h4>
                                            {s.compatibilityAnalysis.benefits.length > 0 && (
                                                <div className="benefits">
                                                    <strong>Benefits:</strong>
                                                    <ul>
                                                        {s.compatibilityAnalysis.benefits.map((benefit, idx) => (
                                                            <li key={idx} className="benefit-item">✅ {benefit}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {s.compatibilityAnalysis.conflicts.length > 0 && (
                                                <div className="conflicts">
                                                    <strong>Conflicts:</strong>
                                                    <ul>
                                                        {s.compatibilityAnalysis.conflicts.map((conflict, idx) => (
                                                            <li key={idx} className="conflict-item">❌ {conflict}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="button-row">
                                        <button
                                            onClick={() => handleValidateName(s.currentName, clientProfileRef.current, false, s.id)}
                                            className="secondary-btn small-btn"
                                        >
                                            Re-validate
                                        </button>
                                        <button
                                            onClick={() => handleConfirmSuggestion(s)}
                                            className={`primary-btn small-btn ${
                                                !s.isValid || confirmedSuggestions.some(cs => cs.name === s.currentName) 
                                                ? 'disabled-btn' : ''
                                            }`}
                                            disabled={!s.isValid || confirmedSuggestions.some(cs => cs.name === s.currentName)}
                                        >
                                            {confirmedSuggestions.some(cs => cs.name === s.currentName) 
                                                ? '✓ Confirmed' 
                                                : s.isValid 
                                                    ? 'Confirm' 
                                                    : 'Invalid'
                                            }
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="carousel-controls">
                            <button
                                onClick={goToPreviousPage}
                                disabled={currentPage === 0}
                                className="secondary-btn"
                            >⬅ Previous</button>
                            <span>Page {currentPage + 1} of {pageCount}</span>
                            <button
                                onClick={goToNextPage}
                                disabled={currentPage >= pageCount - 1}
                                className="secondary-btn"
                            >Next ➡</button>
                        </div>
                    </div>
                )}

                {/* Client Profile and Custom Validation */}
                <div className="two-column-layout">
                    <div className="section-card profile-display-card">
                        <h2>Client Numerology Profile</h2>

                        {clientProfile ? (
                            <>
                                <div
                                    className="profile-details-content"
                                    dangerouslySetInnerHTML={{ __html: formatProfileData(clientProfile) }}
                                />
                            </>
                        ) : (
                            <p className="text-muted">Please fill in your details and click "Get Initial Suggestions" to load your numerology profile.</p>
                        )}
                    </div>

                    {/* Enhanced Custom Validation */}
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
                                <div className="live-validation-output section-card" style={{ 
                                    backgroundColor: '#ffffff', 
                                    border: '1px solid #e9eceb', 
                                    boxShadow: 'none',
                                    marginTop: '1rem' 
                                }}>
                                    <div className="validation-header">
                                        <h3>Live Chaldean Analysis</h3>
                                        <div className={`priority-badge ${liveValidationOutput.compatibilityAnalysis?.priority.class || ''}`}>
                                            {liveValidationOutput.compatibilityAnalysis?.priority.label || 'Calculating...'}
                                        </div>
                                    </div>

                                    <div className="validation-grid">
                                        <p><strong>Name:</strong> {customNameInput}</p>
                                        <p><strong>First Name Value:</strong> {liveValidationOutput.firstNameValue}</p>
                                        <p><strong>Expression Number:</strong> {liveValidationOutput.expressionNumber}</p>
                                        <p><strong>Raw Sum:</strong> {liveValidationOutput.rawSum}</p>
                                        <p><strong>Soul Urge:</strong> {liveValidationOutput.soulUrgeNumber}</p>
                                        <p><strong>Personality:</strong> {liveValidationOutput.personalityNumber}</p>
                                        <p><strong>Life Path:</strong> {liveValidationOutput.lifePathNumber}</p>
                                        <p><strong>Karmic Debt:</strong> {liveValidationOutput.karmicDebtPresent ? 'Yes ⚠️' : 'No ✅'}</p>
                                    </div>

                                    {liveValidationOutput.compatibilityAnalysis && (
                                        <div className="compatibility-analysis">
                                            <h4>Chaldean Compatibility Analysis:</h4>
                                            <p className={liveValidationOutput.compatibilityAnalysis.isValid ? 'text-green-600' : 'text-red-600'}>
                                                <strong>{liveValidationOutput.compatibilityAnalysis.recommendation}</strong>
                                            </p>
                                            
                                            {liveValidationOutput.compatibilityAnalysis.benefits.length > 0 && (
                                                <div className="benefits">
                                                    <strong>Benefits:</strong>
                                                    <ul>
                                                        {liveValidationOutput.compatibilityAnalysis.benefits.map((benefit, idx) => (
                                                            <li key={idx} className="benefit-item">✅ {benefit}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            
                                            {liveValidationOutput.compatibilityAnalysis.conflicts.length > 0 && (
                                                <div className="conflicts">
                                                    <strong>Conflicts:</strong>
                                                    <ul>
                                                        {liveValidationOutput.compatibilityAnalysis.conflicts.map((conflict, idx) => (
                                                            <li key={idx} className="conflict-item">❌ {conflict}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {backendValidationResult && (
                                        <>
                                            <hr className="my-2" />
                                            <div className="backend-validation">
                                                <h4>Backend Validation:</h4>
                                                <p className={backendValidationResult.is_valid ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                                                    {backendValidationResult.is_valid ? '✅ BACKEND CONFIRMS VALID' : '❌ BACKEND CONFIRMS INVALID'}
                                                </p>
                                                <p><strong>Rationale:</strong> {backendValidationResult.rationale}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            
                            <button 
                                onClick={() => handleValidateName(customNameInput, clientProfileRef.current, true, null)} 
                                className="primary-btn" 
                                disabled={!clientProfile || !customNameInput.trim()}
                            >
                                Validate Custom Name
                            </button>
                        </div>
                    )}
                </div>

                {/* Confirmed Suggestions */}
                {confirmedSuggestions.length > 0 && (
                    <div className="section-card confirmed-suggestions-card">
                        <h2>Confirmed Lucky Names ({confirmedSuggestions.length})</h2>
                        <div className="confirmed-list">
                            {confirmedSuggestions.map((cs, idx) => (
                                <div key={idx} className="confirmed-item">
                                    <div className="confirmed-details">
                                        <strong>{cs.name}</strong> (Expression: {cs.expression_number})
                                        <p className="rationale">{cs.rationale}</p>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveConfirmedSuggestion(cs.name)}
                                        className="remove-btn"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleGenerateReport} className="primary-btn generate-report-btn">
                            Generate Comprehensive Report
                        </button>
                    </div>
                )}

                {/* Modal */}
                {modal.isOpen && (
                    <div className="custom-modal">
                        <div className="modal-content">
                            <p className="modal-message">{modal.message}</p>
                            <button onClick={closeModal} className="primary-btn">OK</button>
                        </div>
                    </div>
                )}
            </div>

            {/* CSS Styles for Enhanced Compatibility Display */}
            <style jsx>{`
                .priority-premium { background: linear-gradient(135deg, #10b981, #059669); color: white; }
                .priority-master { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }
                .priority-acceptable { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
                .priority-incompatible { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
                .priority-forbidden { background: linear-gradient(135deg, #991b1b, #7f1d1d); color: white; }
                
                .priority-badge, .compatibility-badge {
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.375rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-align: center;
                    margin-bottom: 0.5rem;
                }
                
                .validity-indicator {
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.375rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                
                .validity-indicator.valid {
                    background-color: #10b981;
                    color: white;
                }
                
                .validity-indicator.invalid {
                    background-color: #ef4444;
                    color: white;
                }
                
                .compatibility-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                
                .name-card.valid-name {
                    border-left: 4px solid #10b981;
                }
                
                .name-card.invalid-name {
                    border-left: 4px solid #ef4444;
                }
                
                .compatibility-analysis {
                    margin-top: 1rem;
                    padding: 0.75rem;
                    background-color: #f8fafc;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                }
                
                .benefits ul, .conflicts ul {
                    margin: 0.5rem 0;
                    padding-left: 1rem;
                }
                
                .benefit-item {
                    color: #059669;
                    margin-bottom: 0.25rem;
                }
                
                .conflict-item {
                    color: #dc2626;
                    margin-bottom: 0.25rem;
                }
                
                .live-analysis {
                    font-size: 0.875rem;
                }
                
                .validation-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                
                .confirmed-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 0.5rem;
                    margin-bottom: 0.5rem;
                    background-color: #f0fdf4;
                }
                
                .rationale {
                    font-size: 0.875rem;
                    color: #6b7280;
                    margin-top: 0.25rem;
                }
                
                .remove-btn {
                    background-color: #ef4444;
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 0.375rem;
                    cursor: pointer;
                    font-weight: 500;
                }
                
                .remove-btn:hover {
                    background-color: #dc2626;
                }
            `}</style>
        </div>
    );
}

export default App;