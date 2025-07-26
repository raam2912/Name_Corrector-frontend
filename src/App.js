import React, { useState } from 'react';
import axios from 'axios';
import Markdown from 'react-markdown';
import './App.css'; // Make sure this line is present to import the CSS

// Main App Component
function App() {
    // State variables for application data and UI control
    const [clientProfile, setClientProfile] = useState(null);
    // const [initialSuggestions, setInitialSuggestions] = useState([]); // REMOVED: This state was unused
    const [validatedNames, setValidatedNames] = useState([]);
    const [confirmedSuggestionsForReport, setConfirmedSuggestionsForReport] = useState([]);
    const [reportPreviewContent, setReportPreviewContent] = useState(''); // State for report preview Markdown
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [customNameInput, setCustomNameInput] = useState('');

    // IMPORTANT: Replace with your actual Render backend URL
    const API_BASE_URL = 'https://name-corrector-backend.onrender.com';

    // --- Step 1: Handle Initial Profile Submission & Get Suggestions ---
    const handleGetInitialSuggestions = async (formData) => {
        setIsLoading(true);
        setError(''); // Clear previous errors
        try {
            const response = await axios.post(`${API_BASE_URL}/initial_suggestions`, formData);
            
            // Store the full profile data returned by the backend
            setClientProfile(response.data.profile_data); 
            
            // Initialize validatedNames with the initial suggestions, adding validation state
            const initialValidated = response.data.suggestions.map(s => ({
                name: s.name,
                expression_number: s.expression_number,
                original_llm_rationale: s.rationale, // Store the LLM's initial rationale
                is_valid: null, // No validation yet (null means pending/not yet validated)
                validation_rationale: '' // No validation rationale yet
            }));
            setValidatedNames(initialValidated);
            // setInitialSuggestions(response.data.suggestions); // REMOVED: No longer setting this state

        } catch (err) {
            console.error("Error getting initial suggestions:", err);
            // Display a user-friendly error message
            setError('Failed to get initial suggestions: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsLoading(false); // End loading
        }
    };

    // --- Step 2: Validate a Single Name (from suggestions or custom input) ---
    const handleValidateName = async (nameToValidate, index) => {
        setIsLoading(true);
        setError(''); // Clear previous errors
        try {
            // Ensure clientProfile is available before validating
            if (!clientProfile) {
                setError("Client profile not loaded. Please get initial suggestions first.");
                setIsLoading(false);
                return;
            }

            const response = await axios.post(`${API_BASE_URL}/validate_name`, {
                suggested_name: nameToValidate,
                client_profile: clientProfile // Send the comprehensive client profile for validation
            });
            const { is_valid, rationale, expression_number } = response.data;

            setValidatedNames(prevNames => {
                const updatedNames = [...prevNames];
                if (index !== -1 && updatedNames[index]) { // If validating an existing suggestion/custom name
                    updatedNames[index] = {
                        ...updatedNames[index], // Keep existing properties (like original_llm_rationale)
                        name: nameToValidate, // Update name if user edited it in the input field
                        expression_number: expression_number,
                        is_valid: is_valid,
                        validation_rationale: rationale // This is the rule-based YES/NO rationale
                    };
                } else { // This path is primarily for new custom names if they were added without an index
                    updatedNames.push({
                        name: nameToValidate,
                        expression_number: expression_number,
                        original_llm_rationale: "Custom name, rationale will be generated with report if confirmed.", // Placeholder
                        is_valid: is_valid,
                        validation_rationale: rationale
                    });
                }
                return updatedNames;
            });
            setCustomNameInput(''); // Clear custom input after validating

        } catch (err) {
            console.error("Error validating name:", err);
            setError('Failed to validate name: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsLoading(false); // End loading
        }
    };

    // --- Add a custom name input field to the list of names to validate ---
    const handleAddCustomName = () => {
        if (customNameInput.trim()) {
            const newIndex = validatedNames.length; // Get the index where the new name will be
            const newNameObject = {
                name: customNameInput.trim(),
                expression_number: null, // Will be filled after validation
                original_llm_rationale: "Custom name, rationale will be generated with report if confirmed.",
                is_valid: null,
                validation_rationale: ''
            };
            setValidatedNames(prev => [...prev, newNameObject]);
            // Use a timeout to ensure state update for validatedNames is processed
            // before handleValidateName attempts to read it.
            setTimeout(() => handleValidateName(customNameInput.trim(), newIndex), 0);
        }
    };


    // --- Step 3: Toggle Confirmation for Report ---
    const handleToggleConfirmSuggestion = (index) => {
        setConfirmedSuggestionsForReport(prevConfirmed => {
            const suggestion = validatedNames[index];
            if (suggestion.is_valid === false) {
                setError("Cannot confirm an invalid name for the report.");
                return prevConfirmed;
            }

            const isAlreadyConfirmed = prevConfirmed.some(
                cs => cs.name === suggestion.name && cs.expression_number === suggestion.expression_number
            );

            let updatedConfirmed;
            if (isAlreadyConfirmed) {
                // If confirmed, remove it
                updatedConfirmed = prevConfirmed.filter(
                    cs => !(cs.name === suggestion.name && cs.expression_number === suggestion.expression_number)
                );
            } else {
                // If not confirmed, add it.
                // Use the original_llm_rationale if available, otherwise fallback to validation_rationale.
                // This ensures the LLM's more elaborate rationale is used for initial suggestions.
                updatedConfirmed = [...prevConfirmed, {
                    name: suggestion.name,
                    rationale: suggestion.original_llm_rationale || suggestion.validation_rationale, 
                    expression_number: suggestion.expression_number
                }];
            }
            // IMPORTANT: Clear report preview if confirmed names change, forcing a refresh
            setReportPreviewContent(''); 
            return updatedConfirmed;
        });
    };

    // --- New Step: Generate Report Preview (Markdown content) ---
    const handleGenerateReportPreview = async () => {
        setIsLoading(true);
        setError('');
        try {
            if (!clientProfile || confirmedSuggestionsForReport.length === 0) {
                setError("Please load client profile and confirm at least one valid name suggestion for the report to generate preview.");
                setIsLoading(false);
                return;
            }

            const reportRequestData = {
                ...clientProfile,
                confirmed_suggestions: confirmedSuggestionsForReport
            };

            // Call the new backend endpoint that returns Markdown
            const response = await axios.post(`${API_BASE_URL}/generate_text_report`, reportRequestData);
            setReportPreviewContent(response.data.report_content);

        } catch (err) {
            console.error("Error generating report preview:", err);
            setError('Failed to generate report preview: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsLoading(false);
        }
    };


    // --- Step 4 & 5: Generate Final Report (LLM part) & Download PDF ---
    const handleGenerateAndDownloadReport = async () => {
        setIsLoading(true);
        setError('');
        try {
            if (!clientProfile || confirmedSuggestionsForReport.length === 0) {
                setError("Please load client profile and confirm at least one valid name suggestion for the report.");
                setIsLoading(false);
                return;
            }

            // You must have generated the preview first before generating PDF
            if (!reportPreviewContent) {
                setError("Please generate the report preview first before downloading the PDF.");
                setIsLoading(false);
                return;
            }

            const pdfReportData = {
                ...clientProfile,
                confirmed_suggestions: confirmedSuggestionsForReport
            };

            const pdfResponse = await axios.post(`${API_BASE_URL}/generate_pdf_report`, pdfReportData, {
                responseType: 'blob' // Important: tells axios to expect binary data (PDF)
            });

            // Trigger download of the PDF file
            const url = window.URL.createObjectURL(new Blob([pdfResponse.data]));
            const link = document.createElement('a');
            link.href = url;
            // Create a user-friendly filename
            link.setAttribute('download', `Numerology_Report_${clientProfile.full_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
            document.body.appendChild(link);
            link.click(); // Programmatically click the link to start download
            link.remove(); // Clean up the temporary link
            window.URL.revokeObjectURL(url); // Release the object URL

        } catch (err) {
            console.error("Error generating/downloading report:", err);
            setError('Failed to generate or download report: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsLoading(false); // End loading
        }
    };

    // --- Rendered JSX ---
    return (
        <div className="container">
            <h1 className="header-style">Sheelaa's Numerology Name Corrector</h1>

            {/* Error Display */}
            {error && (
                <div className="error-message" role="alert">
                    <strong>Error!</strong> {error}
                </div>
            )}
            {/* Loading Indicator */}
            {isLoading && (
                <div className="loading-indicator">
                    <div className="spinner"></div>
                    <span>Loading...</span>
                </div>
            )}

            {!clientProfile ? (
                // Initial Profile Input Form
                <InitialProfileForm onSubmit={handleGetInitialSuggestions} isLoading={isLoading} />
            ) : (
                <>
                    {/* Display Client Profile Summary */}
                    <div className="card">
                        <h2 className="card-title">Your Profile: {clientProfile.full_name}</h2>
                        <p><strong>Birth Date:</strong> {clientProfile.birth_date}</p>
                        {clientProfile.birth_time && <p><strong>Birth Time:</strong> {clientProfile.birth_time}</p>}
                        {clientProfile.birth_place && <p><strong>Birth Place:</strong> {clientProfile.birth_place}</p>}
                        <p><strong>Desired Outcome:</strong> {clientProfile.desired_outcome}</p>
                    </div>

                    {/* Initial Suggestions and Interactive Validation Area */}
                    <div className="card">
                        <h3 className="card-title">Initial Name Suggestions & Validation</h3>
                        <p className="card-description">Review and validate the suggested names. You can edit them or add your own for validation. Select the ones you want to include in the final report.</p>
                        
                        {validatedNames.length === 0 && !isLoading && (
                            <p className="no-suggestions-message">No suggestions generated yet. Please ensure your profile is complete.</p>
                        )}

                        {validatedNames.map((s, index) => (
                            <div key={index} className="suggestion-card">
                                <div className="suggestion-input-group">
                                    <input
                                        type="text"
                                        value={s.name}
                                        onChange={(e) => {
                                            const newValidatedNames = [...validatedNames];
                                            newValidatedNames[index].name = e.target.value;
                                            newValidatedNames[index].is_valid = null; // Reset validation status
                                            newValidatedNames[index].validation_rationale = ''; // Clear rationale
                                            setValidatedNames(newValidatedNames);
                                        }}
                                        className="text-input"
                                    />
                                    <button
                                        onClick={() => handleValidateName(s.name, index)}
                                        className="validate-button"
                                        disabled={isLoading}
                                    >
                                        Validate
                                    </button>
                                </div>
                                <p className="expression-number-text">
                                    <strong>Expression Number:</strong> {s.expression_number || 'N/A'}
                                </p>
                                {s.is_valid !== null && ( // Only show validation status if it's been run
                                    <p className={`validation-status ${s.is_valid ? 'status-yes' : 'status-no'}`}>
                                        Validation:{' '}
                                        <span>
                                            {s.is_valid ? 'YES' : 'NO'}
                                        </span>
                                    </p>
                                )}
                                {s.validation_rationale && ( // Only show rationale if available
                                    <p className="validation-rationale">
                                        {s.validation_rationale}
                                    </p>
                                )}
                                <div className="checkbox-container">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            className="checkbox-input"
                                            checked={confirmedSuggestionsForReport.some(cs => cs.name === s.name && cs.expression_number === s.expression_number)}
                                            onChange={() => handleToggleConfirmSuggestion(index)}
                                            disabled={s.is_valid === false || s.is_valid === null} // Disable if validation is NO or not yet run
                                        />
                                        <span className="checkbox-text">Confirm for Final Report</span>
                                    </label>
                                    {(s.is_valid === false || s.is_valid === null) && (
                                        <span className="checkbox-disabled-note">
                                            {s.is_valid === false ? '(Cannot confirm invalid names)' : '(Validate first to confirm)'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Add Custom Name Input */}
                        <div className="custom-name-input-container">
                            <h4 className="custom-name-title">Add Your Own Name to Validate</h4>
                            <div className="custom-name-input-group">
                                <input
                                    type="text"
                                    placeholder="Enter a name to test..."
                                    value={customNameInput}
                                    onChange={(e) => setCustomNameInput(e.target.value)}
                                    className="text-input"
                                />
                                <button
                                    onClick={handleAddCustomName}
                                    className="add-custom-button"
                                    disabled={isLoading || !customNameInput.trim()} // Disable if loading or input is empty
                                >
                                    Add & Validate Custom Name
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Confirmed Names Summary and Generate Report Preview Button */}
                    <div className="card">
                        <h3 className="card-title">Confirmed Names for Report ({confirmedSuggestionsForReport.length})</h3>
                        {confirmedSuggestionsForReport.length === 0 ? (
                            <p className="no-suggestions-message">No names confirmed yet. Select names above to include them in the final report.</p>
                        ) : (
                            <ul className="confirmed-names-list">
                                {confirmedSuggestionsForReport.map((s, idx) => (
                                    <li key={idx}>
                                        <strong>{s.name}</strong> (Expression: {s.expression_number})
                                    </li>
                                ))}
                            </ul>
                        )}
                        <button
                            onClick={handleGenerateReportPreview}
                            className="preview-button"
                            disabled={isLoading || confirmedSuggestionsForReport.length === 0}
                        >
                            {isLoading && !reportPreviewContent ? "Generating Preview..." : "Generate Report Preview"}
                        </button>
                    </div>

                    {/* Full Report Preview Area - NOW ACTIVE */}
                    {reportPreviewContent && (
                        <div className="report-preview-container">
                            <h2 className="report-preview-title">Full Numerology Report Preview</h2>
                            {/* The Markdown component will render the HTML based on the Markdown string */}
                            <div className="markdown-content">
                                <Markdown>{reportPreviewContent}</Markdown>
                            </div>
                        </div>
                    )}

                    {/* Generate PDF Report Button */}
                    <div className="card">
                        <button
                            onClick={handleGenerateAndDownloadReport}
                            className="primary-button"
                            // Disable if loading, no names confirmed, OR no preview generated yet
                            disabled={isLoading || confirmedSuggestionsForReport.length === 0 || !reportPreviewContent} 
                        >
                            {isLoading ? "Generating PDF..." : "Generate & Download Final PDF Report"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// Separate Component for Initial Profile Input Form
const InitialProfileForm = ({ onSubmit, isLoading }) => {
    const [formData, setFormData] = useState({
        full_name: '',
        birth_date: '',
        birth_time: '',
        birth_place: '',
        desired_outcome: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="form-card">
            <h2 className="form-title">Enter Client Profile</h2>
            <div className="form-group">
                <label htmlFor="full_name" className="form-label">Full Name:</label>
                <input
                    type="text"
                    name="full_name"
                    id="full_name"
                    placeholder="Client's Full Name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    className="text-input"
                />
            </div>
            <div className="form-group">
                <label htmlFor="birth_date" className="form-label">Birth Date:</label>
                <input
                    type="date"
                    name="birth_date"
                    id="birth_date"
                    value={formData.birth_date}
                    onChange={handleChange}
                    required
                    className="text-input"
                />
            </div>
            <div className="form-group">
                <label htmlFor="birth_time" className="form-label">Birth Time (HH:MM - Optional):</label>
                <input
                    type="time"
                    name="birth_time"
                    id="birth_time"
                    placeholder="e.g., 14:30"
                    value={formData.birth_time}
                    onChange={handleChange}
                    className="text-input"
                />
            </div>
            <div className="form-group">
                <label htmlFor="birth_place" className="form-label">Birth Place (Optional):</label>
                <input
                    type="text"
                    name="birth_place"
                    id="birth_place"
                    placeholder="City, Country"
                    value={formData.birth_place}
                    onChange={handleChange}
                    className="text-input"
                />
            </div>
            <div className="form-group">
                <label htmlFor="desired_outcome" className="form-label">Desired Outcome (e.g., success, love, career growth):</label>
                <textarea
                    name="desired_outcome"
                    id="desired_outcome"
                    placeholder="What is the client's primary desired outcome?"
                    value={formData.desired_outcome}
                    onChange={handleChange}
                    required
                    rows="3"
                    className="text-input"
                ></textarea>
            </div>
            <button
                type="submit"
                className="primary-button"
                disabled={isLoading}
            >
                {isLoading ? "Getting Suggestions..." : "Get Initial Name Suggestions"}
            </button>
        </form>
    );
};

export default App;
