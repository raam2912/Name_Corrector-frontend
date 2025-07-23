import React, { useState } from 'react';
import { marked } from 'marked'; 
import jsPDF from 'jspdf'; 
import html2canvas from 'html2canvas';

// Main App component
const App = () => {
    // State variables for form inputs and display
    const [fullName, setFullName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [desiredOutcome, setDesiredOutcome] = useState('');
    const [response, setResponse] = useState(''); // Stores the Markdown response from backend
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentNumerology, setCurrentNumerology] = useState(null); // Stores client-side calculated numerology

    const BACKEND_API_URL = "https://name-corrector-backend.onrender.com/chat"; // <<<--- THIS IS A PLACEHOLDER! YOU WILL REPLACE THIS LATER!

    // --- Numerology Core Logic (duplicated in frontend for immediate display) ---
    // This client-side logic is for quick display of current numbers before the AI response.
    // The backend will also have its own robust numerology calculator tool.
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
        7: "Spirituality, deep introspection, analytical thought, and profound wisdom.",
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
        return reduceNumber(total, false);
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

    // Main form submission handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setResponse('');
        setCurrentNumerology(null); // Clear previous numerology display

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

            // Construct the message for the AI agent on the backend
            // This message will be interpreted by the LLM (via LangChain) to generate name corrections.
            const message = `My full name is "${fullName}" and my birth date is "${birthDate}". My current Name (Expression) Number is ${currentExpNum} and Life Path Number is ${currentLifePathNum}. I desire the following positive outcome in my life: "${desiredOutcome}". Based on this, please suggest at least 6 acceptable and usable name corrections that align with my desired outcome, explaining the numerological benefit of each. Format your response using Markdown, starting with a warm greeting, then the current numerology summary, followed by a "Suggested Name Corrections" heading, and then bullet points for each name with "Suggested Name:", "Expression Number:", and "Explanation:". Finally, conclude your response with this exact sentence: "For a much detailed report, book your appointment using Sheelaa.com."`;

            // Make API call to your Flask backend
            const res = await fetch(BACKEND_API_URL, {
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
            // Assuming the backend returns Markdown text in the 'response' key
            setResponse(data.response);

        } catch (err) {
            console.error('Error fetching data:', err);
            setError(`Failed to get a response from the AI: ${err.message}. Please ensure your backend is running and its URL is correct.`);
        } finally {
            setIsLoading(false);
        }
    };

    // Function to generate PDF
    const generatePdf = () => {
        const input = document.getElementById('numerology-report-content'); // Target the div containing the report
        if (!input) {
            setError("Could not find report content to generate PDF.");
            return;
        }

        html2canvas(input, {
            scale: 2, // Increase scale for better quality
            useCORS: true, // Important if you have images from external sources
            logging: false, // Disable logging for cleaner console
        }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' for A4 size

            // Calculate dimensions to fit the image on the PDF page
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`Numerology_Report_${fullName.replace(/\s+/g, '_') || 'Guest'}.pdf`);
        }).catch(err => {
            console.error("Error generating PDF:", err);
            setError(`Failed to generate PDF: ${err.message}`);
        });
    };


    return (
        <div className="app-container">
            <div className="content-box">
                <h1 className="main-heading">
                    <span role="img" aria-label="sparkles">✨</span>Unlock Your Destiny
                </h1>
                <p className="sub-heading">
                    Discover the profound influence of your name and birth date. Get AI-powered corrections to align with your deepest desires.
                </p>

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
                    <div id="numerology-report-content" className="numerology-profile">
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

                        {response && (
                            <>
                                <h3 className="suggestions-heading">
                                    <span role="img" aria-label="lightbulb">💡</span> Personalized Name Corrections:
                                </h3>
                                {/* Render Markdown content directly */}
                                <div className="markdown-content" dangerouslySetInnerHTML={{ __html: marked.parse(response) }} />
                            </>
                        )}
                        <p className="footer-text">
                            These suggestions are generated by AI based on numerological principles and your desired outcomes.
                            Remember, the power to choose your path lies within you.
                        </p>
                    </div>
                )}

                {/* Download PDF Button - only shown when a response is available */}
                {response && (
                    <button
                        onClick={generatePdf}
                        className="submit-button download-button" // Added a new class for specific styling if needed
                        style={{ marginTop: '20px', backgroundColor: '#28a745' }} // Inline style for distinct color
                    >
                        <span className="flex-center">
                            <span role="img" aria-label="download icon" className="emoji-icon">⬇️</span>
                            Download Report as PDF
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default App;
