import React, { useState } from 'react';
import { marked } from 'marked'; // Import marked for Markdown parsing

// Assuming your CSS files are correctly linked in public/index.html or imported here
import './index.css';
import './App.css';

// Main App component
const App = () => {
    // State variables for form inputs and display
    const [fullName, setFullName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [desiredOutcome, setDesiredOutcome] = useState('');
    const [reportContent, setReportContent] = useState(''); // Stores the Markdown response from backend
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentNumerology, setCurrentNumerology] = useState(null); // Stores client-side calculated numerology
    // NEW STATE: To store the full structured data received from the backend for PDF generation
    const [fullReportDataForPdf, setFullReportDataForPdf] = useState(null);

    // State variables for name validation feature
    const [suggestedName, setSuggestedName] = useState('');
    const [validationResult, setValidationResult] = useState(''); // Stores the Markdown response for validation
    const [isValidationLoading, setIsValidationLoading] = useState(false);
    const [validationError, setValidationError] = useState('');

    // IMPORTANT: This is the base URL for your deployed Render Flask backend.
    const BACKEND_BASE_URL = "https://name-corrector-backend.onrender.com"; // <<<--- VERIFY THIS IS YOUR ACTUAL RENDER URL!

    // --- Numerology Core Logic (duplicated in frontend for immediate display) ---
    // This client-side calculation is for immediate display of current numbers,
    // the backend will perform its own comprehensive calculations.
    const NUMEROLOGY_MAP = {
        'A': 1, 'J': 1, 'S': 1, 'B': 2, 'K': 2, 'T': 2, 'C': 3, 'L': 3, 'U': 3,
        'D': 4, 'M': 4, 'V': 4, 'E': 5, 'N': 5, 'W': 5, 'F': 6, 'O': 6, 'X': 6,
        'G': 7, 'P': 7, 'Y': 7, 'H': 8, 'Q': 8, 'Z': 8, 'I': 9, 'R': 9
    };

    const NUMEROLOGY_INTERPRETATIONS = {
        1: "Leadership, independence, and new beginnings, empowering you to forge your own path.",
        2: "Cooperation, balance, and diplomacy, fostering harmonious relationships and partnerships.",
        3: "Creativity, self-expression, and optimism, enhancing communication and joyful interactions.",
        4: "Stability, diligent hard work, and building strong foundations for lasting security.",
        5: "Freedom, dynamic change, and adventure, embracing versatility and new experiences.",
        6: "Responsibility, nurturing, harmony, and selfless service, fostering love in family and community.",
        7: "Spirituality, deep introspection, and analytical thought, and profound wisdom.",
        8: "Abundance, power, and material success, especially in material and leadership endeavors.",
        9: "Humanitarianism, compassion, and completion, signifying a wise, selfless, and universally loving nature.",
        11: "Heightened intuition, spiritual insight, and illumination (a Master Number for 2), inspiring others.",
        22: "The Master Builder, signifying large-scale achievement and practical idealism (a Master Number for 4).",
        33: "The Master Healer/Teacher, embodying compassionate service and universal love (a Master Number for 6)."
    };

    // Helper to reduce numbers for numerology
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

    // Helper to calculate name number
    const calculateNameNumber = (name) => {
        let total = 0;
        const cleanedName = name.toUpperCase().replace(/[^A-Z]/g, '');
        for (let i = 0; i < cleanedName.length; i++) {
            const letter = cleanedName[i];
            if (NUMEROLOGY_MAP[letter]) {
                total += NUMEROLOGY_MAP[letter];
            }
        }
        return reduceNumber(total, false); // Changed to false as Expression is usually reduced
    };

    // Helper to calculate life path number
    const calculateLifePathNumber = (birthDateStr) => {
        if (!birthDateStr) return 0;
        try {
            const parts = birthDateStr.split('-');
            if (parts.length !== 3) throw new Error("Invalid date format.");
            let year = parseInt(parts[0]);
            let month = parseInt(parts[1]);
            let day = parseInt(parts[2]);
            if (isNaN(year) || isNaN(month) || isNaN(day)) return 0;
            month = reduceNumber(month, true);
            day = reduceNumber(day, true);
            year = reduceNumber(year, true);
            let total = month + day + year;
            return reduceNumber(total, true);
        } catch (e) {
            console.error("Error in calculateLifePathNumber:", e);
            return 0;
        }
    };

    // Function to handle PDF download (calls backend endpoint)
    const handleDownloadPdf = async () => {
        setIsLoading(true); // Use main loading indicator for PDF generation
        setError('');

        // Ensure fullReportDataForPdf is available
        if (!fullReportDataForPdf) {
            setError('No report data available to download. Please generate a report first.');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/generate_pdf_report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Send the stored fullReportDataForPdf directly
                body: JSON.stringify(fullReportDataForPdf),
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
        setValidationResult(''); // Clear validation result when generating new report
        setSuggestedName(''); // Clear suggested name input
        setCurrentNumerology(null); // Clear previous numerology display
        setFullReportDataForPdf(null); // Clear previous PDF data

        if (!fullName || !birthDate || !desiredOutcome) {
            setError('Please fill in all fields: Full Name, Birth Date, and Desired Outcome.');
            return;
        }

        setIsLoading(true);

        try {
            // Calculate current numerology on frontend for immediate display
            const currentExpNum = calculateNameNumber(fullName);
            const currentLifePathNum = calculateLifePathNumber(birthDate);

            if (currentExpNum === 0 || currentLifePathNum === 0) {
                setError('Could not calculate initial numerology. Please check your inputs, especially the name (letters only) and date (YYYY-MM-DD).');
                setIsLoading(false);
                return;
            }

            // Set current numerology state for display
            setCurrentNumerology({
                expression: currentExpNum,
                lifePath: currentLifePathNum,
                explanation: `Your current name's energy (${currentExpNum}) resonates with ${NUMEROLOGY_INTERPRETATIONS[currentExpNum] || "a unique path."}. ` +
                                     `Your life path (${currentLifePathNum}) indicates ${NUMEROLOGY_INTERPRETATIONS[currentLifePathNum] || "a unique life journey."}.`
            });

            // Construct the message for the AI agent on the backend for initial report
            const message = `GENERATE_ADVANCED_REPORT: My full name is "${fullName}" and my birth date is "${birthDate}". My current Name (Expression) Number is ${currentExpNum} and Life Path Number is ${currentLifePathNum}. I desire the following positive outcome in my life: "${desiredOutcome}".`;

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
            setReportContent(data.response); // Store the raw Markdown response
            // NEW: Store the full structured data for PDF generation
            setFullReportDataForPdf(data.full_report_data_for_pdf);

        } catch (err) {
            console.error('Error fetching data:', err);
            setError(`Failed to get a response from the AI: ${err.message}. Please ensure your backend is running and its URL is correct.`);
        } finally {
            setIsLoading(false);
        }
    };

    // Function for validating a suggested name
    const handleValidateName = async (e) => {
        e.preventDefault();
        setValidationError('');
        setValidationResult('');

        // Ensure original data is present for validation context
        if (!fullName || !birthDate || !desiredOutcome || !suggestedName) {
            setValidationError('Please ensure your Full Name, Birth Date, and Desired Outcome are entered in the top form, and provide the Suggested Name to Validate.');
            return;
        }

        setIsValidationLoading(true);

        try {
            // Construct the message for the AI agent for name validation
            const message = `VALIDATE_NAME_ADVANCED: Original Full Name: "${fullName}", Birth Date: "${birthDate}", Desired Outcome: "${desiredOutcome}", Suggested Name to Validate: "${suggestedName}".`;

            const res = await fetch(`${BACKEND_BASE_URL}/chat`, { // Call /chat endpoint
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
            setValidationResult(data.response);

        } catch (err) {
            console.error('Error validating name:', err);
            setValidationError(`Failed to validate name with AI: ${err.message}.`);
        } finally {
            setIsValidationLoading(false);
        }
    };

    return (
        <div className="app-container">
            <div className="content-box">
                <h1 className="main-heading">
                    <span role="img" aria-label="sparkles">✨</span>Unlock Your Destiny
                </h1>
                <p className="sub-heading">
                    Discover the profound influence of your name and birth date. Get AI-powered corrections and validate your own name ideas.
                </p>

                {/* Section for Initial Report Generation */}
                <h2 className="profile-heading" style={{marginTop: '0'}}>
                    <span role="img" aria-label="form icon">📝</span>Generate Personalized Report
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="fullName" className="form-label">
                            Your Full Name (as currently used)
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

                    <div className="form-group">
                        <label htmlFor="birthDate" className="form-label">
                            Your Birth Date
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

                    <div className="form-group">
                        <label htmlFor="desiredOutcome" className="form-label">
                            What positive outcome do you desire in your life? <br/><span className="sub-heading-small">(e.g., more success, better relationships, inner peace)</span>
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
                        className="submit-button"
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

                {error && (
                    <div className="error-message" role="alert">
                        <p><strong>Error:</strong></p>
                        <p>{error}</p>
                    </div>
                )}

                {/* The numerology report content, now with an ID for PDF generation */}
                {currentNumerology && (
                    <div id="numerology-report-content" className="numerology-profile" style={{marginTop: '40px'}}>
                        <h2 className="profile-heading">Your Numerology Profile</h2>

                        <div className="current-numerology-box">
                            <h3>
                                <span role="img" aria-label="current numbers">🔢</span> Your Current Numerology:
                            </h3>
                            <p>
                                <span className="numerology-number-label">Name (Expression/Destiny) Number:</span> <span className="numerology-number-value">{currentNumerology.expression}</span>
                            </p>
                            <p>
                                <span className="numerology-number-label">Birth Date (Life Path) Number:</span> <span className="numerology-number-value">{currentNumerology.lifePath}</span>
                            </p>
                            <p className="numerology-explanation">{currentNumerology.explanation}</p>
                        </div>

                        {reportContent && (
                            <>
                                <h3 className="suggestions-heading">
                                    <span role="img" aria-label="lightbulb">💡</span> Personalized Name Corrections:
                                </h3>
                                {/* Render Markdown content directly */}
                                <div className="markdown-content" dangerouslySetInnerHTML={{ __html: marked.parse(reportContent) }} />
                            </>
                        )}
                        <p className="footer-text">
                            These suggestions are generated by AI based on numerological principles and your desired outcomes.
                            Remember, the power to choose your path lies within you.
                        </p>
                    </div>
                )}

                {/* Download PDF Button - only shown when a report is available */}
                {reportContent && (
                    <button
                        onClick={handleDownloadPdf}
                        className="submit-button download-button"
                        style={{ marginTop: '20px', backgroundColor: '#28a745' }}
                        disabled={isLoading}
                    >
                        <span className="flex-center">
                            <span role="img" aria-label="download icon" className="emoji-icon">⬇️</span>
                            Download Report as PDF
                        </span>
                    </button>
                )}

                {/* Separator and Name Validation Section - ONLY DISPLAYED IF reportContent IS AVAILABLE */}
                {reportContent && (
                    <>
                        <hr style={{ margin: '60px auto', width: '80%', border: '0', borderTop: '1px dashed #4a627a' }} />

                        <h2 className="profile-heading">
                            <span role="img" aria-label="validate icon">✅</span>Validate Your Own Name Idea
                        </h2>
                        <p className="sub-heading">
                            Enter a name you're considering (first, last, middle, or full name) to see if its numerology aligns with your goals.
                        </p>
                        <form onSubmit={handleValidateName}>
                            <div className="form-group">
                                <label htmlFor="suggestedName" className="form-label">
                                    Suggested Name to Validate
                                </label>
                                <input
                                    type="text"
                                    id="suggestedName"
                                    className="input-field"
                                    placeholder="e.g., Emily Rose, Thompson, or a new first name"
                                    value={suggestedName}
                                    onChange={(e) => setSuggestedName(e.target.value)}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="submit-button"
                                disabled={isValidationLoading}
                                style={{ backgroundColor: '#3498db' }} // Blue color for validation button
                            >
                                {isValidationLoading ? (
                                    <span className="flex-center">
                                        <div className="spinner"></div>
                                        Validating Name...
                                    </span>
                                ) : (
                                    <span className="flex-center">
                                        <span role="img" aria-label="check mark" className="emoji-icon">✔️</span>
                                        Validate Name
                                    </span>
                                )}
                            </button>
                        </form>

                        {validationError && (
                            <div className="error-message" role="alert">
                                <p><strong>Error:</strong></p>
                                <p>{validationError}</p>
                            </div>
                        )}

                        {validationResult && (
                            <div className="numerology-profile" style={{marginTop: '40px'}}>
                                <h3 className="suggestions-heading">
                                    <span role="img" aria-label="result icon">✨</span>Validation Result:
                                </h3>
                                <div className="markdown-content" dangerouslySetInnerHTML={{ __html: marked.parse(validationResult) }} />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default App;
