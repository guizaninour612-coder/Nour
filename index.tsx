import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { GoogleGenAI, Type } from "@google/genai";

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

// Liste de médicaments commercialisés en Tunisie (échantillon)
const tunisianMedications = [
  "DOLIPRANE", "PANADOL", "EFFERALGAN", "AUGMENTIN", "AMOXIL", "CLAMOXYL",
  "SPASFON", "FLAGYL", "CELESTENE", "SOLUPRED", "VENTOLINE", "MAXILASE",
  "NEXIUM", "INEXIUM", "TAHOR", "CRESTOR", "PLAVIX", "KARDEGIC", "ASPIRINE",
  "LASILIX", "DIAMICRON", "GLUCOPHAGE", "INSULATARD", "NOVORAPID", "LANTUS",
  "COVERSYL", "APROVEL", "ATACAND", "XANAX", "LEXOMIL", "STILNOX", "IMOVANE",
  "ZOLOFT", "PROZAC", "DEROXAT", "LAROXYL", "VOLTARENE", "FELDENE", "KETOPROFENE",
  "IBUPROFENE", "TRIMETABOL", "PERVITAL", "PRIMPERAN", "MOTILIUM", "SMECTA", "ULCAR",
  "GAVISCON", "MAALOX", "ZINNAT", "ORELOX", "CEFIXIME", "PYOSTACINE"
].sort();

interface DoctorInfo {
    name: string;
    specialty: string;
    nameAr: string;
    specialtyAr: string;
    clinicName: string;
    address: string;
    phoneNumbers: string;
    urgences: string;
}

const initialDoctorInfo: DoctorInfo = {
    name: 'Dr. KHEDHIRI HICHEM',
    specialty: 'OPHTALMOLOGISTE\nMaladies et Chirurgie des Yeux',
    nameAr: 'الحكيم هشام الخذيري',
    specialtyAr: 'اختصاصي في أمراض و جراحة العيون',
    clinicName: 'Centre Médical "DAR ECHIFA"',
    address: 'Rue 8 Juillet 1884 - le Kef 7100',
    phoneNumbers: '24.971.666  78.204.969',
    urgences: 'URGENCES : Clinique JUGHURTHA  Tèl : 78.202.611'
};

const DoctorInfoModal = ({ info, onSave, onClose }: { info: DoctorInfo, onSave: (info: DoctorInfo) => void, onClose: () => void }) => {
    const [formData, setFormData] = useState<DoctorInfo>(info);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        onSave(formData);
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Informations de l'Ordonnance</h2>
                <div className="form-columns">
                    <div className="form-column">
                        <h4>En-tête (Français)</h4>
                        <div className="form-group">
                            <label htmlFor="name">Nom complet</label>
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="specialty">Spécialité & sous-titre</label>
                            <textarea id="specialty" name="specialty" value={formData.specialty} onChange={handleChange} rows={3}></textarea>
                        </div>
                    </div>
                    <div className="form-column">
                        <h4>En-tête (Arabe)</h4>
                        <div className="form-group">
                            <label htmlFor="nameAr">Nom complet (Arabe)</label>
                            <input type="text" id="nameAr" name="nameAr" value={formData.nameAr} onChange={handleChange} dir="rtl" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="specialtyAr">Spécialité (Arabe)</label>
                            <textarea id="specialtyAr" name="specialtyAr" value={formData.specialtyAr} onChange={handleChange} dir="rtl" rows={3}></textarea>
                        </div>
                    </div>
                </div>
                <h4>Pied de page</h4>
                 <div className="form-group">
                    <label htmlFor="clinicName">Nom de la clinique</label>
                    <input type="text" id="clinicName" name="clinicName" value={formData.clinicName} onChange={handleChange} />
                </div>
                 <div className="form-group">
                    <label htmlFor="address">Adresse de la clinique</label>
                    <input type="text" id="address" name="address" value={formData.address} onChange={handleChange} />
                </div>
                 <div className="form-group">
                    <label htmlFor="phoneNumbers">Numéros de téléphone</label>
                    <input type="text" id="phoneNumbers" name="phoneNumbers" value={formData.phoneNumbers} onChange={handleChange} />
                </div>
                 <div className="form-group">
                    <label htmlFor="urgences">Ligne d'urgences</label>
                    <input type="text" id="urgences" name="urgences" value={formData.urgences} onChange={handleChange} />
                </div>
                <div className="modal-actions">
                    <button onClick={onClose} className="btn-secondary">Annuler</button>
                    <button onClick={handleSave} className="btn-primary">Enregistrer</button>
                </div>
            </div>
        </div>
    );
};

const DictationModal = ({ isOpen, onClose, onAnalyze, isAnalyzing, error }: { isOpen: boolean, onClose: () => void, onAnalyze: (transcript: string) => void, isAnalyzing: boolean, error: string | null }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (!isOpen) return;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("La reconnaissance vocale n'est pas supportée par votre navigateur.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'fr-FR';

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setTranscript(prev => prev + finalTranscript);
        };
        
        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;

    }, [isOpen]);

    const toggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
        } else {
            setTranscript('');
            recognitionRef.current?.start();
        }
        setIsRecording(!isRecording);
    };

    const handleAnalyzeClick = () => {
        if (transcript) {
            onAnalyze(transcript);
        }
    };
    
    if (!isOpen) return null;

    return (
         <div className="modal-overlay">
            <div className="modal-content dictation-modal">
                <h2>Assistant de Dictée</h2>
                <p className="dictation-instructions">
                  Dictez une ordonnance complète (Ex: <em>"Patient Jean Dupont, médicament Doliprane..."</em>) ou ajoutez un médicament (Ex: <em>"Ajouter Spasfon, posologie 2 si besoin."</em>).
                </p>
                <textarea 
                    className="transcript-textarea"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)} // Allow manual editing
                    placeholder="La transcription de votre dictée apparaîtra ici..."
                />
                 {error && <p className="dictation-error">{error}</p>}
                <div className="modal-actions">
                    <button onClick={onClose} className="btn-secondary" disabled={isAnalyzing}>Fermer</button>
                    <button onClick={toggleRecording} className={`btn-dictate ${isRecording ? 'recording' : ''}`} disabled={isAnalyzing}>
                        <svg xmlns="http://www.w.org/2000/svg" height="1em" viewBox="0 0 384 512"><path fill="currentColor" d="M192 0C139 0 96 43 96 96V256c0 53 43 96 96 96s96-43 96-96V96c0-53-43-96-96-96zM64 216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 89.1 66.2 162.7 152 174.4V464H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h144c13.3 0 24-10.7 24-24s-10.7-24-24-24H208V430.4c85.8-11.7 152-85.3 152-174.4V216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 70.7-57.3 128-128 128s-128-57.3-128-128V216z"/></svg>
                        {isRecording ? 'Arrêter' : 'Dicter'}
                    </button>
                    <button onClick={handleAnalyzeClick} className="btn-primary" disabled={!transcript || isAnalyzing || isRecording}>
                        {isAnalyzing ? <span className="loader"></span> : 'Analyser et Remplir'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const App = () => {
  const [patientName, setPatientName] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState(new Date().toLocaleDateString('fr-FR'));
  const [medicationInput, setMedicationInput] = useState('');
  const [dosageInput, setDosageInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [prescribedMedications, setPrescribedMedications] = useState<{ id: number, name: string, dosage: string }[]>([]);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo>(initialDoctorInfo);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isDictationModalOpen, setIsDictationModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const prescriptionRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
      const savedInfo = localStorage.getItem('doctorInfo');
      if (savedInfo) {
          setDoctorInfo(JSON.parse(savedInfo));
      }
  }, []);

  const handleSaveDoctorInfo = (info: DoctorInfo) => {
      setDoctorInfo(info);
      localStorage.setItem('doctorInfo', JSON.stringify(info));
  };
  
  const handleAnalyze = async (transcript: string) => {
    if (!transcript) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const schema = {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, description: "L'action à effectuer: 'REPLACE_ALL' pour une nouvelle ordonnance, ou 'ADD_MEDICATION' pour ajouter un médicament." },
          patientName: { type: Type.STRING, description: "Nom complet du patient (uniquement pour l'action REPLACE_ALL)." },
          medications: {
            type: Type.ARRAY,
            description: "Liste d'un ou plusieurs médicaments.",
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Nom du médicament." },
                dosage: { type: Type.STRING, description: "Posologie complète." },
              },
              required: ["name", "dosage"],
            },
          },
        },
        required: ["action", "medications"],
      };

      const prompt = `
        Vous êtes un assistant pharmacologique expert avec une connaissance exhaustive de tous les noms de médicaments commercialisés. Votre rôle est d'analyser une transcription vocale pour remplir une ordonnance.

        Transcription de l'utilisateur : "${transcript}"

        Tâches :
        1.  **Correction des Médicaments :** Utilisez votre base de connaissances pour identifier et corriger les noms de médicaments. Si la transcription contient une approximation phonétique (ex: "dolipran"), vous devez la corriger en son nom commercial exact (ex: "DOLIPRANE"). Le nom du médicament doit TOUJOURS être en majuscules.
        2.  **Détermination de l'Intention :**
            *   Si la transcription commence par "ajouter" ou une variante, l'action est "ADD_MEDICATION". Extrayez uniquement le médicament à ajouter.
            *   Sinon, l'action est "REPLACE_ALL". Extrayez le nom du patient et la liste complète des médicaments.
        3.  **Extraction des Données :** Extrayez les informations (nom du patient, médicaments, posologies) précisément.

        Formatez votre réponse exclusivement en JSON, en respectant le schéma fourni, sans aucun texte additionnel.
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });

      const resultText = response.text.trim();
      const data = JSON.parse(resultText);

      if (data.action === 'ADD_MEDICATION' && data.medications?.length > 0) {
        const newMedication = {
            id: Date.now(),
            name: data.medications[0].name.toUpperCase(),
            dosage: data.medications[0].dosage,
        };
        setPrescribedMedications(prev => [...prev, newMedication]);
      } else if (data.action === 'REPLACE_ALL') {
          setPatientName(data.patientName || '');
          const newMedications = (data.medications || []).map((med: any, index: number) => ({
            id: Date.now() + index,
            name: med.name.toUpperCase(),
            dosage: med.dosage,
          }));
          setPrescribedMedications(newMedications);
      }
      
      setIsDictationModalOpen(false);

    } catch (error) {
      console.error("Erreur d'analyse Gemini:", error);
      setAnalysisError("L'analyse a échoué. Veuillez vérifier votre dictée et réessayer.");
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMedicationInput(value);
    if (value.length > 1) {
      const filteredSuggestions = tunisianMedications.filter(med =>
        med.toLowerCase().startsWith(value.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (medication: string) => {
    setMedicationInput(medication);
    setSuggestions([]);
  };

  const addMedication = () => {
    if (medicationInput && !prescribedMedications.some(med => med.name === medicationInput)) {
      setPrescribedMedications([...prescribedMedications, { id: Date.now(), name: medicationInput, dosage: dosageInput }]);
      setMedicationInput('');
      setDosageInput('');
      setSuggestions([]);
    }
  };

  const removeMedication = (id: number) => {
    setPrescribedMedications(prescribedMedications.filter(med => med.id !== id));
  };
    
  const handleDosageChange = (id: number, dosage: string) => {
      setPrescribedMedications(prescribedMedications.map(med => med.id === id ? {...med, dosage} : med));
  }

  const generatePdf = async () => {
    const prescriptionElement = prescriptionRef.current;
    if (!prescriptionElement) return;

    setIsGeneratingPdf(true);
    prescriptionElement.classList.add('pdf-render');

    try {
        const canvas = await html2canvas(prescriptionElement, {
            scale: 2.5,
            useCORS: true,
            logging: false,
            windowWidth: prescriptionElement.scrollWidth,
            windowHeight: prescriptionElement.scrollHeight
        });
        prescriptionElement.classList.remove('pdf-render');
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Ordonnance-${patientName.replace(/\s/g, '_') || 'Patient'}.pdf`);
    } catch (error) {
        console.error("Erreur lors de la génération du PDF:", error);
        prescriptionElement.classList.remove('pdf-render');
    }

    setIsGeneratingPdf(false);
  };

  return (
    <>
      <div className="page-controls">
         <button onClick={() => setIsInfoModalOpen(true)} className="edit-info-btn" aria-label="Modifier les informations du médecin">
            Modifier les informations
          </button>
           <button onClick={() => { setAnalysisError(null); setIsDictationModalOpen(true); }} className="dictate-btn" aria-label="Dicter l'ordonnance">
            <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 384 512"><path fill="currentColor" d="M192 0C139 0 96 43 96 96V256c0 53 43 96 96 96s96-43 96-96V96c0-53-43-96-96-96zM64 216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 89.1 66.2 162.7 152 174.4V464H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h144c13.3 0 24-10.7 24-24s-10.7-24-24-24H208V430.4c85.8-11.7 152-85.3 152-174.4V216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 70.7-57.3 128-128 128s-128-57.3-128-128V216z"/></svg>
            Dicter
          </button>
          <button className="download-btn" onClick={generatePdf} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? 'Génération...' : 'Télécharger en PDF'}
          </button>
      </div>

      {isInfoModalOpen && <DoctorInfoModal info={doctorInfo} onSave={handleSaveDoctorInfo} onClose={() => setIsInfoModalOpen(false)} />}
      <DictationModal 
        isOpen={isDictationModalOpen} 
        onClose={() => setIsDictationModalOpen(false)} 
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        error={analysisError}
      />
      
      <div className="prescription-paper" ref={prescriptionRef}>
        <header>
          <div className="header-left">
            <h1>{doctorInfo.name}</h1>
            <p>{doctorInfo.specialty}</p>
          </div>
          <div className="header-right">
            <h1>{doctorInfo.nameAr}</h1>
            <p>{doctorInfo.specialtyAr}</p>
          </div>
        </header>

        <section className="patient-info">
             <div className="form-group patient-name-group">
                <label htmlFor="patient-name">Patient(e) :</label>
                <input
                  type="text"
                  id="patient-name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nom et prénom du patient"
                />
            </div>
            <div className="form-group date-group">
                <label htmlFor="prescription-date">Kef Le :</label>
                <input
                    type="text"
                    id="prescription-date"
                    value={prescriptionDate}
                    onChange={(e) => setPrescriptionDate(e.target.value)}
                />
            </div>
        </section>

        <main className="medication-section">
          <div className="autocomplete-container">
              <div className="autocomplete-wrapper">
                  <input
                      type="text"
                      className="autocomplete-input"
                      value={medicationInput}
                      onChange={handleInputChange}
                      onKeyDown={(e) => e.key === 'Enter' && addMedication()}
                      placeholder="Commencez à taper un médicament..."
                  />
                  {suggestions.length > 0 && (
                  <ul className="autocomplete-suggestions">
                      {suggestions.map((med, index) => (
                      <li key={index} onClick={() => handleSuggestionClick(med)}>
                          {med}
                      </li>
                      ))}
                  </ul>
                  )}
              </div>
              <input
                  type="text"
                  className="dosage-add-input"
                  placeholder="Posologie (ex: 1 cp/j)"
                  value={dosageInput}
                  onChange={(e) => setDosageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMedication()}
              />
              <button onClick={addMedication} className="add-med-btn">Ajouter</button>
          </div>

          <ul className="medication-list">
              {prescribedMedications.length === 0 && (
                <li className="placeholder-item">La liste des médicaments apparaîtra ici.</li>
              )}
              {prescribedMedications.map((med) => (
                  <li key={med.id}>
                      <span className="medication-name">{med.name}</span>
                      <input 
                          type="text"
                          className="dosage-input"
                          placeholder="Posologie, ex: 1 comprimé 3 fois/jour pendant 5 jours"
                          value={med.dosage}
                          onChange={(e) => handleDosageChange(med.id, e.target.value)}
                      />
                      <button onClick={() => removeMedication(med.id)} className="remove-btn" aria-label="Supprimer le médicament">
                          &times;
                      </button>
                  </li>
              ))}
          </ul>
        </main>

        <footer>
            <div className="vertical-line"></div>
            <div className="footer-content">
                <p><strong>{doctorInfo.clinicName}</strong></p>
                <p>{doctorInfo.address}</p>
                <p><span><svg xmlns="http://www.w.org/2000/svg" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"/></svg></span> {doctorInfo.phoneNumbers}</p>
                <p><span><svg xmlns="http://www.w.org/2000/svg" height="1em" viewBox="0 0 448 512"><path fill="currentColor" d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.8 0-67.6-9.5-97.8-26.7l-7.1-4.2-73.3 19.3 19.3-71.6-4.7-7.5c-19.1-30.1-29.2-65.4-29.2-101.9 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg></span> {doctorInfo.urgences}</p>
            </div>
        </footer>
      </div>
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);