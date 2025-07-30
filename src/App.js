/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { marked } from 'marked'; // Corrected: For rendering Markdown in report preview
import debounce from 'lodash.debounce'; // Correctly imported debounce
import _ from 'lodash';

import './App.css'; // Import the CSS file for styling

// Configure your backend URL
const BACKEND_URL = 'https://name-corrector-backend.onrender.com'; // <<< IMPORTANT: REPLACE THIS WITH YOUR RENDER BACKEND URL

// --- UPDATED CHALDEAN NUMEROLOGY CALCULATIONS WITH NEW RULES ---
const CHALDEAN_MAP = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 8, G: 3,
  H: 5, I: 1, J: 1, K: 2, L: 3, M: 4, N: 5,
  O: 7, P: 8, Q: 1, R: 2, S: 3, T: 4, U: 6,
  V: 6, W: 6, X: 5, Y: 1, Z: 7
};

const MASTER_NUMBERS = new Set([11, 22, 33]);
const KARMIC_DEBT_NUMBERS = new Set([13, 14, 16, 19]);
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// UPDATED RULES: PRIMARY LUCKY NUMBERS ARE ONLY 1, 5, 6
const PRIMARY_LUCKY_NUMBERS = new Set([1, 5, 6]);

// Special value permissions and restrictions
const ALWAYS_REJECTED_VALUES = new Set([51]); // 51 rejected for personal names (business only)
const SPECIAL_ALLOWED_VALUES = new Set([65]); // 65 allowed despite reducing to 2

/**
 * Calculate Birth Number from date of birth
 * @param {string} birthDateStr - Date in YYYY-MM-DD format
 * @returns {number} Birth number (day reduced to single digit)
 */
function calculateBirthNumber(birthDateStr) {
    try {
        const day = parseInt(birthDateStr.split('-')[2], 10);
        if (isNaN(day) || day < 1 || day > 31) return 0;
        return calculateSingleDigit(day, false); // Birth number is always single digit
    } catch {
        return 0;
    }
}

/**
 * Calculate Life Path Number from full birth date
 * @param {string} birthDateStr - Date in YYYY-MM-DD format
 * @returns {number} Life path number (sum of all digits reduced)
 */
function calculateLifePathNumber(birthDateStr) {
    try {
        const [year, month, day] = birthDateStr.split('-').map(Number);
        const totalSumAllDigits = String(year) + String(month).padStart(2, '0') + String(day).padStart(2, '0');
        let sum = 0;
        for(const digit of totalSumAllDigits) {
            sum += parseInt(digit, 10);
        }
        return calculateSingleDigit(sum, false); // Life path is single digit for our rules
    } catch {
        return 0;
    }
}

/**
 * Determine allowed values based on birth number and life path number
 * @param {number} birthNumber 
 * @param {number} lifePathNumber 
 * @returns {Set} Set of allowed values for FNV and CMV
 */
function getAllowedValues(birthNumber, lifePathNumber) {
    let allowedValues = new Set([1, 5, 6]); // Start with base lucky numbers
    
    // Exception 1: Birth/Life Path = 8 → Cannot use 1
    if (birthNumber === 8 || lifePathNumber === 8) {
        allowedValues.delete(1);
    }
    
    // Exception 2: Birth/Life Path = 3 → Cannot use 6
    if (birthNumber === 3 || lifePathNumber === 3) {
        allowedValues.delete(6);
    }
    
    // Exception 3: Birth/Life Path = 6 → Cannot use 3 (but 3 wasn't in primary anyway)
    // This doesn't affect our primary set, but good to track
    
    // Exception 4: Birth/Life Path = 3 → CAN use 3
    if (birthNumber === 3 || lifePathNumber === 3) {
        allowedValues.add(3);
    }
    
    return allowedValues;
}

/**
 * Check if a specific value is allowed for name correction
 * @param {number} value - The calculated name value
 * @param {number} birthNumber 
 * @param {number} lifePathNumber 
 * @returns {boolean}
 */
function isValueAllowed(value, birthNumber, lifePathNumber) {
    // Exception 5: Always reject 51 for personal names
    if (ALWAYS_REJECTED_VALUES.has(value)) {
        return false;
    }
    
    // Exception 6: Always allow 65 despite reducing to 2
    if (SPECIAL_ALLOWED_VALUES.has(value)) {
        return true;
    }
    
    // Reduce value to single digit for comparison
    const reducedValue = calculateSingleDigit(value, false);
    const allowedValues = getAllowedValues(birthNumber, lifePathNumber);
    
    return allowedValues.has(reducedValue);
}

/**
 * Get comprehensive analysis of name compatibility
 * @param {number} fnv - First Name Value
 * @param {number} cmv - Complete name value (Expression Number)
 * @param {number} birthNumber 
 * @param {number} lifePathNumber 
 * @returns {Object} Analysis object
 */
function getNameCompatibilityAnalysis(fnv, cmv, birthNumber, lifePathNumber) {
    const analysis = {
        isValid: false,
        priority: { priority: 1, label: "❌ INVALID", class: "priority-invalid" },
        conflicts: [],
        benefits: [],
        recommendation: "",
        allowedValues: [],
        fnvStatus: { isValid: false, reason: "" },
        cmvStatus: { isValid: false, reason: "" }
    };
    
    const allowedValues = getAllowedValues(birthNumber, lifePathNumber);
    analysis.allowedValues = Array.from(allowedValues).sort();
    
    // Check FNV (First Name Value)
    const fnvValid = isValueAllowed(fnv, birthNumber, lifePathNumber);
    const fnvReduced = calculateSingleDigit(fnv, false);
    
    if (!fnvValid) {
        if (ALWAYS_REJECTED_VALUES.has(fnv)) {
            analysis.fnvStatus = { isValid: false, reason: `FNV ${fnv} is forbidden for personal names` };
            analysis.conflicts.push(`First Name Value ${fnv} is forbidden for personal names`);
        } else {
            analysis.fnvStatus = { isValid: false, reason: `FNV ${fnvReduced} not in allowed values [${analysis.allowedValues.join(', ')}]` };
            analysis.conflicts.push(`First Name Value ${fnvReduced} conflicts with your birth numbers`);
        }
    } else {
        if (SPECIAL_ALLOWED_VALUES.has(fnv)) {
            analysis.fnvStatus = { isValid: true, reason: `FNV ${fnv} specially allowed` };
            analysis.benefits.push(`First Name Value ${fnv} has special permission`);
        } else {
            analysis.fnvStatus = { isValid: true, reason: `FNV ${fnvReduced} is lucky and compatible` };
            analysis.benefits.push(`First Name Value ${fnvReduced} creates positive energy`);
        }
    }
    
    // Check CMV (Complete Name Value / Expression Number)
    const cmvValid = isValueAllowed(cmv, birthNumber, lifePathNumber);
    const cmvReduced = calculateSingleDigit(cmv, false);
    
    if (!cmvValid) {
        if (ALWAYS_REJECTED_VALUES.has(cmv)) {
            analysis.cmvStatus = { isValid: false, reason: `CMV ${cmv} is forbidden for personal names` };
            analysis.conflicts.push(`Expression Number ${cmv} is forbidden for personal names`);
        } else {
            analysis.cmvStatus = { isValid: false, reason: `CMV ${cmvReduced} not in allowed values [${analysis.allowedValues.join(', ')}]` };
            analysis.conflicts.push(`Expression Number ${cmvReduced} conflicts with your birth numbers`);
        }
    } else {
        if (SPECIAL_ALLOWED_VALUES.has(cmv)) {
            analysis.cmvStatus = { isValid: true, reason: `CMV ${cmv} specially allowed` };
            analysis.benefits.push(`Expression Number ${cmv} has special permission`);
        } else {
            analysis.cmvStatus = { isValid: true, reason: `CMV ${cmvReduced} is lucky and compatible` };
            analysis.benefits.push(`Expression Number ${cmvReduced} enhances your fortune`);
        }
    }
    
    // Overall validation
    analysis.isValid = fnvValid && cmvValid;
    
    // Set priority and recommendation
    if (analysis.isValid) {
        // Determine priority based on how "lucky" the numbers are
        if (allowedValues.has(1) && (fnvReduced === 1 || cmvReduced === 1)) {
            analysis.priority = { priority: 5, label: "★★★★★ PREMIUM", class: "priority-premium" };
        } else if (allowedValues.has(5) && (fnvReduced === 5 || cmvReduced === 5)) {
            analysis.priority = { priority: 4, label: "★★★★☆ EXCELLENT", class: "priority-excellent" };
        } else if (allowedValues.has(6) && (fnvReduced === 6 || cmvReduced === 6)) {
            analysis.priority = { priority: 4, label: "★★★★☆ EXCELLENT", class: "priority-excellent" };
        } else if (allowedValues.has(3) && (fnvReduced === 3 || cmvReduced === 3)) {
            analysis.priority = { priority: 3, label: "★★★☆☆ GOOD", class: "priority-good" };
        } else {
            analysis.priority = { priority: 3, label: "★★★☆☆ ACCEPTABLE", class: "priority-acceptable" };
        }
        
        analysis.recommendation = `✅ RECOMMENDED: This name follows Chaldean numerology rules and is compatible with Birth Number ${birthNumber} and Life Path ${lifePathNumber}`;
    } else {
        analysis.priority = { priority: 1, label: "❌ INVALID", class: "priority-invalid" };
        analysis.recommendation = `❌ NOT RECOMMENDED: This name violates Chaldean numerology rules for Birth Number ${birthNumber} and Life Path ${lifePathNumber}`;
    }
    
    // Add specific guidance
    if (analysis.conflicts.length === 0 && analysis.benefits.length > 0) {
        analysis.benefits.push(`Both First Name and Expression numbers align with lucky values [${analysis.allowedValues.join(', ')}]`);
    }
    
    return analysis;
}

// --- EXISTING CALCULATION FUNCTIONS (Updated for new rules) ---
function cleanName(name) {
    return name.replace(/[^a-zA-Z\s]/g, '').toUpperCase();
}

function getChaldeanValue(char) {
    return CHALDEAN_MAP[char] || 0;
}

function calculateSingleDigit(number, allowMasterNumbers = false) {
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
    return total; // Return raw sum for rule checking
}

function calculateExpressionNumber(fullName) {
    const cleanedName = cleanName(fullName);
    let total = 0;
    for (const char of cleanedName) {
        total += getChaldeanValue(char);
    }
    return total; // Return raw sum for rule checking
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
    return calculateBirthNumber(birthDateStr); // Use the updated function
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

/**
 * UPDATED VALIDATION FUNCTION using new rules
 */
function isValidNameNumber(fnv, cmv, birthNumber, lifePathNumber) {
    return isValueAllowed(fnv, birthNumber, lifePathNumber) && 
           isValueAllowed(cmv, birthNumber, lifePathNumber);
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
        
        // Calculate birth number and life path for display
        const birthNumber = calculateBirthNumber(profile.birth_date);
        const lifePathNumber = calculateLifePathNumber(profile.birth_date);
        const allowedValues = getAllowedValues(birthNumber, lifePathNumber);
        
        return `
            <h3 class="font-bold">Updated Chaldean Rules Applied:</h3>
            <p><b>Birth Number:</b> ${birthNumber}</p>
            <p><b>Life Path Number:</b> ${lifePathNumber}</p>
            <p><b>Allowed Values for Names:</b> [${Array.from(allowedValues).sort().join(', ')}]</p>
            <hr class="my-2">
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
            <h3 class="font-bold">Rule Exceptions Applied:</h3>
            <p><b>Forbidden Value 51:</b> ${ALWAYS_REJECTED_VALUES.has(51) ? 'Blocked for personal names' : 'N/A'}</p>
            <p><b>Special Value 65:</b> ${SPECIAL_ALLOWED_VALUES.has(65) ? 'Specially allowed despite reducing to 2' : 'N/A'}</p>
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

    // --- Enhanced Effects with NEW RULES ---
    useEffect(() => {
        if (suggestions.length > 0 && clientProfile) {
            const birthNumber = calculateBirthNumber(clientProfile.birth_date);
            const lifePathNumber = calculateLifePathNumber(clientProfile.birth_date);
            
            const initialEditable = suggestions.map((s, index) => {
                const name = typeof s === 'string' ? s : s.name;
                const firstNameValue = calculateFirstNameValue(name);
                const expressionNumber = calculateExpressionNumber(name);
                const rawSum = calculateRawSum(name);
                const soulUrgeNumber = calculateSoulUrgeNumber(name);
                const personalityNumber = calculatePersonalityNumber(name);
                const karmicDebtPresent = checkKarmicDebt(name);
                const firstName = name.split(' ')[0];
                
                // UPDATED validation with new rules
                const isValid = isValidNameNumber(firstNameValue, expressionNumber, birthNumber, lifePathNumber);
                const compatibilityAnalysis = getNameCompatibilityAnalysis(firstNameValue, expressionNumber, birthNumber, lifePathNumber);

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

        const fnv = calculateFirstNameValue(name);
        const cmv = calculateExpressionNumber(name);
        const rawSum = calculateRawSum(name);
        const birthDateStr = currentClientProfile.birth_date;
        const birthNumber = calculateBirthNumber(birthDateStr);
        const lifePathNumber = calculateLifePathNumber(birthDateStr);
        const loShu = calculateLoShuGrid(birthDateStr, cmv);
        const soulUrgeNum = calculateSoulUrgeNumber(name);
        const personalityNum = calculatePersonalityNumber(name);
        const karmicDebtPresent = checkKarmicDebt(name);
        
        // UPDATED compatibility analysis with new rules
        const compatibilityAnalysis = getNameCompatibilityAnalysis(fnv, cmv, birthNumber, lifePathNumber);

        setLiveValidationOutput({
            name,
            firstNameValue: fnv,
            expressionNumber: cmv,
            rawSum,
            soulUrgeNumber: soulUrgeNum,
            personalityNumber: personalityNum,
            karmicDebtPresent: karmicDebtPresent,
            birthNumber: birthNumber,
            lifePathNumber: lifePathNumber,
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
            openModal("❌ This name does not comply with the updated Chaldean numerology rules. Please choose a valid name that follows the 1, 5, 6 system.");
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
                const birthNumber = calculateBirthNumber(clientProfile?.birth_date || '');
                const lifePathNumber = calculateLifePathNumber(clientProfile?.birth_date || '');
                const firstNameValue = calculateFirstNameValue(newFullName);
                const expressionNumber = calculateExpressionNumber(newFullName);
                const isValid = isValidNameNumber(firstNameValue, expressionNumber, birthNumber, lifePathNumber);
                const compatibilityAnalysis = getNameCompatibilityAnalysis(firstNameValue, expressionNumber, birthNumber, lifePathNumber);

                const updatedSuggestion = { 
                    ...s, 
                    currentName: newFullName, 
                    isEdited: true,
                    isValid,
                    compatibilityAnalysis
                };
                updatedSuggestion.firstNameValue = firstNameValue;
                updatedSuggestion.expressionNumber = expressionNumber;
                updatedSuggestion.rawSum = calculateRawSum(newFullName);
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
                const birthNumber = calculateBirthNumber(clientProfile?.birth_date || '');
                const lifePathNumber = calculateLifePathNumber(clientProfile?.birth_date || '');
                const firstNameValue = calculateFirstNameValue(newFullName);
                const expressionNumber = calculateExpressionNumber(newFullName);
                const isValid = isValidNameNumber(firstNameValue, expressionNumber, birthNumber, lifePathNumber);
                const compatibilityAnalysis = getNameCompatibilityAnalysis(firstNameValue, expressionNumber, birthNumber, lifePathNumber);

                const updatedSuggestion = { 
                    ...s, 
                    currentName: newFullName, 
                    currentFirstName: newFirstName, 
                    isEdited: true,
                    isValid,
                    compatibilityAnalysis
                };
                updatedSuggestion.firstNameValue = firstNameValue;
                updatedSuggestion.expressionNumber = expressionNumber;
                updatedSuggestion.rawSum = calculateRawSum(newFullName);
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

    // Enhanced live validation for input names with NEW RULES
    const getLiveNameAnalysis = (name, birthDate) => {
        if (!name.trim() || !birthDate) return null;
        
        const birthNumber = calculateBirthNumber(birthDate);
        const lifePathNumber = calculateLifePathNumber(birthDate);
        const firstNameValue = calculateFirstNameValue(name);
        const expressionNumber = calculateExpressionNumber(name);
        
        return {
            birthNumber,
            lifePathNumber,
            firstNameValue,
            expressionNumber,
            isValid: isValidNameNumber(firstNameValue, expressionNumber, birthNumber, lifePathNumber),
            compatibilityAnalysis: getNameCompatibilityAnalysis(firstNameValue, expressionNumber, birthNumber, lifePathNumber)
        };
    };

    const currentNameAnalysis = getLiveNameAnalysis(fullName, birthDate);

    return (
        <div className="app-container">
            <div className="main-content-wrapper">
                <h1 className="main-title">Sheelaa's Numerology Portal </h1>
                {isLoading && (
                    <div className="loading-overlay">
                        <p>⏳ Processing numerological calculations with updated rules...</p>
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
                                    <p><strong>Live Analysis (Updated Rules):</strong></p>
                                    <p>Birth Number: <strong>{currentNameAnalysis.birthNumber}</strong></p>
                                    <p>Life Path Number: <strong>{currentNameAnalysis.lifePathNumber}</strong></p>
                                    <p>First Name Value: <strong>{currentNameAnalysis.firstNameValue}</strong> (Reduced: {calculateSingleDigit(currentNameAnalysis.firstNameValue, false)})</p>
                                    <p>Expression Number: <strong>{currentNameAnalysis.expressionNumber}</strong> (Reduced: {calculateSingleDigit(currentNameAnalysis.expressionNumber, false)})</p>
                                    <p>Allowed Values: <strong>[{Array.from(getAllowedValues(currentNameAnalysis.birthNumber, currentNameAnalysis.lifePathNumber)).sort().join(', ')}]</strong></p>
                                    <div className={`compatibility-badge ${currentNameAnalysis.compatibilityAnalysis.priority.class}`}>
                                        {currentNameAnalysis.compatibilityAnalysis.priority.label}
                                    </div>
                                    <p className={currentNameAnalysis.isValid ? 'text-green-600' : 'text-red-600'}>
                                        <strong>{currentNameAnalysis.isValid ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}</strong>
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

                {/* Updated Rules Information Panel */}
                <div className="section-card rules-info-card">
                    <h2>🔧 Updated Chaldean Numerology Rules</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9em' }}>
                        <div>
                            <h4>✅ Lucky Numbers for Names:</h4>
                            <ul>
                                <li><strong>1</strong> - Power & Leadership</li>
                                <li><strong>5</strong> - Freedom & Adventure</li>
                                <li><strong>6</strong> - Love & Harmony</li>
                            </ul>
                        </div>
                        <div>
                            <h4>⚠️ Special Rules:</h4>
                            <ul>
                                <li>Birth/Life = 8 → Cannot use 1</li>
                                <li>Birth/Life = 3 → Cannot use 6, Can use 3</li>
                                <li>Birth/Life = 6 → Cannot use 3</li>
                                <li>Value 51 → Forbidden for personal names</li>
                                <li>Value 65 → Specially allowed</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Enhanced Suggested Names Carousel with NEW RULES */}
                {editableSuggestions.length > 0 && (
                    <div className="section-card suggestions-carousel">
                        <h2>Suggested Names</h2>

                        <div className="carousel-grid">
                            {paginatedSuggestions.map((s) => (
                                <div key={s.id} className={`name-card ${s.isValid ? 'valid-name' : 'invalid-name'}`}>
                                    <div className="compatibility-header">
                                        <div className={`priority-badge ${s.compatibilityAnalysis?.priority.class || ''}`}>
                                            {s.compatibilityAnalysis?.priority.label || 'Calculating...'}
                                        </div>
                                        <div className={`validity-indicator ${s.isValid ? 'valid' : 'invalid'}`}>
                                            {s.isValid ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}
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
                                        <span className="text-sm text-gray-600">
                                            Raw: {s.firstNameValue} | Reduced: {calculateSingleDigit(s.firstNameValue, false)}
                                        </span>
                                    </div>

                                    <div className="numerology-summary">
                                        <p><strong>Expression:</strong> {s.expressionNumber} (Reduced: {calculateSingleDigit(s.expressionNumber, false)})</p>
                                        <p><strong>Soul Urge:</strong> {s.soulUrgeNumber}</p>
                                        <p><strong>Personality:</strong> {s.personalityNumber}</p>
                                        <p><strong>Karmic Debt:</strong> {s.karmicDebtPresent ? '⚠️ Yes' : '✅ No'}</p>
                                    </div>

                                    {s.compatibilityAnalysis && (
                                        <div className="compatibility-analysis">
                                            <h4>Updated Rules Analysis:</h4>
                                            <p><strong>Allowed Values:</strong> [{s.compatibilityAnalysis.allowedValues.join(', ')}]</p>
                                            
                                            <div className="rule-status">
                                                <p><strong>FNV Status:</strong> <span className={s.compatibilityAnalysis.fnvStatus.isValid ? 'text-green-600' : 'text-red-600'}>
                                                    {s.compatibilityAnalysis.fnvStatus.isValid ? '✅' : '❌'} {s.compatibilityAnalysis.fnvStatus.reason}
                                                </span></p>
                                                <p><strong>CMV Status:</strong> <span className={s.compatibilityAnalysis.cmvStatus.isValid ? 'text-green-600' : 'text-red-600'}>
                                                    {s.compatibilityAnalysis.cmvStatus.isValid ? '✅' : '❌'} {s.compatibilityAnalysis.cmvStatus.reason}
                                                </span></p>
                                            </div>
                                            
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
                                                    <strong>Rule Violations:</strong>
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
                                                    : 'Non-Compliant'
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

                    {/* Enhanced Custom Validation with NEW RULES */}
                    {clientProfile && (
                        <div className="section-card custom-validation-card">
                            <h2>Validate Custom Name (Updated Rules)</h2>
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
                                        <h3>Live Updated Rules Analysis</h3>
                                        <div className={`priority-badge ${liveValidationOutput.compatibilityAnalysis?.priority.class || ''}`}>
                                            {liveValidationOutput.compatibilityAnalysis?.priority.label || 'Calculating...'}
                                        </div>
                                    </div>

                                    <div className="validation-grid">
                                        <p><strong>Name:</strong> {customNameInput}</p>
                                        <p><strong>Birth Number:</strong> {liveValidationOutput.birthNumber}</p>
                                        <p><strong>Life Path Number:</strong> {liveValidationOutput.lifePathNumber}</p>
                                        <p><strong>Allowed Values:</strong> [{Array.from(getAllowedValues(liveValidationOutput.birthNumber, liveValidationOutput.lifePathNumber)).sort().join(', ')}]</p>
                                        <hr />
                                        <p><strong>First Name Value:</strong> {liveValidationOutput.firstNameValue} (Reduced: {calculateSingleDigit(liveValidationOutput.firstNameValue, false)})</p>
                                        <p><strong>Expression Number:</strong> {liveValidationOutput.expressionNumber} (Reduced: {calculateSingleDigit(liveValidationOutput.expressionNumber, false)})</p>
                                        <p><strong>Raw Sum:</strong> {liveValidationOutput.rawSum}</p>
                                        <p><strong>Soul Urge:</strong> {liveValidationOutput.soulUrgeNumber}</p>
                                        <p><strong>Personality:</strong> {liveValidationOutput.personalityNumber}</p>
                                        <p><strong>Karmic Debt:</strong> {liveValidationOutput.karmicDebtPresent ? 'Yes ⚠️' : 'No ✅'}</p>
                                    </div>

                                    {liveValidationOutput.compatibilityAnalysis && (
                                        <div className="compatibility-analysis">
                                            <h4>Updated Chaldean Rules Analysis:</h4>
                                            <p className={liveValidationOutput.compatibilityAnalysis.isValid ? 'text-green-600' : 'text-red-600'}>
                                                <strong>{liveValidationOutput.compatibilityAnalysis.recommendation}</strong>
                                            </p>
                                            
                                            <div className="rule-status">
                                                <p><strong>FNV Compliance:</strong> <span className={liveValidationOutput.compatibilityAnalysis.fnvStatus.isValid ? 'text-green-600' : 'text-red-600'}>
                                                    {liveValidationOutput.compatibilityAnalysis.fnvStatus.isValid ? '✅' : '❌'} {liveValidationOutput.compatibilityAnalysis.fnvStatus.reason}
                                                </span></p>
                                                <p><strong>CMV Compliance:</strong> <span className={liveValidationOutput.compatibilityAnalysis.cmvStatus.isValid ? 'text-green-600' : 'text-red-600'}>
                                                    {liveValidationOutput.compatibilityAnalysis.cmvStatus.isValid ? '✅' : '❌'} {liveValidationOutput.compatibilityAnalysis.cmvStatus.reason}
                                                </span></p>
                                            </div>
                                            
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
                                                    <strong>Rule Violations:</strong>
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
                                                    {backendValidationResult.is_valid ? '✅ BACKEND CONFIRMS COMPLIANT' : '❌ BACKEND CONFIRMS NON-COMPLIANT'}
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
                                Validate with Updated Rules
                            </button>
                        </div>
                    )}
                </div>

                {/* Confirmed Suggestions */}
                {confirmedSuggestions.length > 0 && (
                    <div className="section-card confirmed-suggestions-card">
                        <h2>Confirmed Lucky Names ({confirmedSuggestions.length}) - Updated Rules Compliant</h2>
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

            {/* CSS Styles for Enhanced Compatibility Display with NEW RULES */}
            <style jsx>{`
                .priority-premium { background: linear-gradient(135deg, #10b981, #059669); color: white; }
                .priority-excellent { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; }
                .priority-good { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }
                .priority-acceptable { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
                .priority-invalid { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
                
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
                
                .rule-status {
                    margin: 0.5rem 0;
                    padding: 0.5rem;
                    background-color: #f1f5f9;
                    border-radius: 0.25rem;
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
                
                .rules-info-card {
                    background: linear-gradient(135deg, #f8fafc, #e2e8f0);
                    border: 2px solid #3b82f6;
                }
                
                .rules-info-card h4 {
                    color: #1e40af;
                    margin-bottom: 0.5rem;
                }
                
                .rules-info-card ul {
                    list-style-type: none;
                    padding-left: 0;
                }
                
                .rules-info-card li {
                    padding: 0.25rem 0;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .rules-info-card li:last-child {
                    border-bottom: none;
                }
                
                .validation-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }
                
                .validation-grid p {
                    margin: 0.25rem 0;
                    font-size: 0.875rem;
                }
                
                .text-green-600 {
                    color: #059669;
                }
                
                .text-red-600 {
                    color: #dc2626;
                }
                
                .font-bold {
                    font-weight: 700;
                }
                
                .text-sm {
                    font-size: 0.875rem;
                }
                
                .text-gray-600 {
                    color: #6b7280;
                }
                
                .text-muted {
                    color: #9ca3af;
                    font-style: italic;
                }
                
                /* Enhanced form styling */
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }
                
                .input-group {
                    display: flex;
                    flex-direction: column;
                }
                
                .input-label {
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                    color: #374151;
                }
                
                .input-field {
                    padding: 0.75rem;
                    border: 1px solid #d1d5db;
                    border-radius: 0.375rem;
                    font-size: 1rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                
                .input-field:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                
                .primary-btn {
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.375rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                
                .primary-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }
                
                .primary-btn:disabled, .disabled-btn {
                    background: #9ca3af;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }
                
                .secondary-btn {
                    background: #f3f4f6;
                    color: #374151;
                    border: 1px solid #d1d5db;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.375rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .secondary-btn:hover {
                    background: #e5e7eb;
                }
                
                .secondary-btn:disabled {
                    background: #f9fafb;
                    color: #9ca3af;
                    cursor: not-allowed;
                }
                
                .small-btn {
                    padding: 0.5rem 1rem;
                    font-size: 0.875rem;
                }
                
                /* Layout improvements */
                .app-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                }
                
                .main-content-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                }
                
                .main-title {
                    text-align: center;
                    font-size: 2.5rem;
                    font-weight: 800;
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    margin-bottom: 1rem;
                }
                
                .section-card {
                    background: white;
                    border-radius: 1rem;
                    padding: 2rem;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    border: 1px solid #e5e7eb;
                }
                
                .two-column-layout {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2rem;
                }
                
                .carousel-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }
                
                .name-card {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 0.75rem;
                    padding: 1.5rem;
                    box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                
                .name-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.1);
                }
                
                .numerology-summary {
                    background: #f8fafc;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    margin: 1rem 0;
                }
                
                .numerology-summary p {
                    margin: 0.5rem 0;
                    font-size: 0.875rem;
                }
                
                .button-row {
                    display: flex;
                    gap: 0.5rem;
                    margin-top: 1rem;
                }
                
                .carousel-controls {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                }
                
                .confirmed-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                
                .generate-report-btn {
                    width: 100%;
                    padding: 1rem;
                    font-size: 1.1rem;
                }
                
                .loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    color: white;
                    font-size: 1.2rem;
                    font-weight: 600;
                }
                
                .custom-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1001;
                }
                
                .modal-content {
                    background: white;
                    padding: 2rem;
                    border-radius: 1rem;
                    max-width: 500px;
                    margin: 2rem;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                }
                
                .modal-message {
                    margin-bottom: 1.5rem;
                    font-size: 1.1rem;
                    line-height: 1.6;
                }
                
                /* Responsive design */
                @media (max-width: 768px) {
                    .form-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .two-column-layout {
                        grid-template-columns: 1fr;
                    }
                    
                    .carousel-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .validation-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .app-container {
                        padding: 1rem;
                    }
                    
                    .main-title {
                        font-size: 2rem;
                    }
                }
            `}</style>
        </div>
    );
}

export default App;