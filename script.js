document.addEventListener('DOMContentLoaded', function() {
    // Initialize PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
    
    const synth = window.speechSynthesis;
    const textInput = document.getElementById('textInput');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const repeatBtn = document.getElementById('repeatBtn');
    const voiceSelect = document.getElementById('voiceSelect');
    const speedSelect = document.getElementById('speedSelect');
    const statusEl = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const darkModeBtn = document.getElementById('darkModeBtn');
    const body = document.body;
    
    // File input sections
    const textTabBtn = document.getElementById('textTabBtn');
    const pdfTabBtn = document.getElementById('pdfTabBtn');
    const imageTabBtn = document.getElementById('imageTabBtn');
    const textInputSection = document.getElementById('textInputSection');
    const pdfInputSection = document.getElementById('pdfInputSection');
    const imageInputSection = document.getElementById('imageInputSection');
    const pdfInput = document.getElementById('pdfInput');
    const pdfStatus = document.getElementById('pdfStatus');
    const pdfPages = document.getElementById('pdfPages');
    const pageSelect = document.getElementById('pageSelect');
    const imageInput = document.getElementById('imageInput');
    const ocrStatus = document.getElementById('ocrStatus');
    const imagePreview = document.getElementById('imagePreview');
    const previewImage = document.getElementById('previewImage');
    
    let utterance = null;
    let tokens = [];
    let currentIndex = 0;
    let isPlaying = false;
    let isPaused = false;
    let currentSpeed = 1;
    let lastLine = null;
    let isDarkMode = false;
    let currentPdf = null;
    let currentPdfText = '';
    
    // Enhanced punctuation and symbol configuration
    const SYMBOLS = {
        ',': { name: 'comma', pause: 200, speak: true },
        '.': { name: 'period', pause: 400, speak: true },
        '?': { name: 'question mark', pause: 500, speak: true },
        '!': { name: 'exclamation mark', pause: 500, speak: true },
        ';': { name: 'semicolon', pause: 300, speak: true },
        ':': { name: 'colon', pause: 300, speak: true },
        '+': { name: 'plus', pause: 100, speak: true },
        '-': { name: 'minus', pause: 100, speak: true },
        '*': { name: 'asterisk', pause: 100, speak: true },
        '/': { name: 'slash', pause: 100, speak: true },
        '\\': { name: 'backslash', pause: 100, speak: true },
        '@': { name: 'at', pause: 100, speak: true },
        '#': { name: 'hash', pause: 100, speak: true },
        '$': { name: 'dollar', pause: 100, speak: true },
        '%': { name: 'percent', pause: 100, speak: true },
        '^': { name: 'caret', pause: 100, speak: true },
        '&': { name: 'ampersand', pause: 100, speak: true },
        '(': { name: 'left parenthesis', pause: 100, speak: true },
        ')': { name: 'right parenthesis', pause: 100, speak: true },
        '[': { name: 'left bracket', pause: 100, speak: true },
        ']': { name: 'right bracket', pause: 100, speak: true },
        '{': { name: 'left brace', pause: 100, speak: true },
        '}': { name: 'right brace', pause: 100, speak: true },
        '<': { name: 'less than', pause: 100, speak: true },
        '>': { name: 'greater than', pause: 100, speak: true },
        '=': { name: 'equals', pause: 100, speak: true },
        '|': { name: 'pipe', pause: 100, speak: true },
        '"': { name: 'double quote', pause: 100, speak: true },
        "'": { name: 'single quote', pause: 100, speak: true },
        '`': { name: 'backtick', pause: 100, speak: true },
        '~': { name: 'tilde', pause: 100, speak: true },
        '_': { name: 'underscore', pause: 100, speak: true },
        '\n': { name: 'new paragraph', pause: 1000, speak: true },
        ' ': { name: 'space', pause: 50, speak: false }
    };

    // Initialize voice options
    function initVoices() {
        voiceSelect.innerHTML = '<option value="">Default Voice</option>';
        
        const voices = synth.getVoices();
        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.setAttribute('data-name', voice.name);
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);
        });
    }
    
    // Tab switching
    function switchTab(tab) {
        textTabBtn.classList.remove('active');
        pdfTabBtn.classList.remove('active');
        imageTabBtn.classList.remove('active');
        
        textInputSection.style.display = 'none';
        pdfInputSection.style.display = 'none';
        imageInputSection.style.display = 'none';
        
        if (tab === 'text') {
            textTabBtn.classList.add('active');
            textInputSection.style.display = 'block';
        } else if (tab === 'pdf') {
            pdfTabBtn.classList.add('active');
            pdfInputSection.style.display = 'block';
        } else if (tab === 'image') {
            imageTabBtn.classList.add('active');
            imageInputSection.style.display = 'block';
        }
    }
    
    // Tokenize text with punctuation handling
    function tokenizeText(text) {
        const tokens = [];
        let currentToken = '';
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (SYMBOLS[char] !== undefined) {
                if (currentToken) {
                    tokens.push(currentToken);
                    currentToken = '';
                }
                tokens.push(char);
            } else {
                currentToken += char;
            }
        }
    
        if (currentToken) {
            tokens.push(currentToken);
        }
    
        return tokens;
    }
    
    // Get symbol info if character is a symbol
    function getSymbol(char) {
        if (SYMBOLS[char]) {
            return {
                ...SYMBOLS[char],
                token: char,
                hasSymbol: true
            };
        }
        return null;
    }
    
    // Update progress bar
    function updateProgress() {
        if (tokens.length === 0) {
            progressBar.style.width = '0%';
            return;
        }
        
        const progress = ((currentIndex + 1) / tokens.length) * 100;
        progressBar.style.width = `${progress}%`;
    }
    
    // Start reading the text
    function startReading() {
        let text = '';
        
        if (textTabBtn.classList.contains('active')) {
            text = textInput.value.trim();
        } else if (pdfTabBtn.classList.contains('active')) {
            text = currentPdfText;
        } else if (imageTabBtn.classList.contains('active')) {
            text = textInput.value.trim();
        }
        
        if (!text) {
            statusEl.textContent = "Please load some content to read.";
            return;
        }
        
        tokens = tokenizeText(text);
        currentIndex = 0;
        isPlaying = true;
        isPaused = false;
        
        playBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        repeatBtn.disabled = true;
        
        statusEl.textContent = "Starting to read...";
        updateProgress();
        
        speakWordGroup(0);
    }

    // Pause reading
    function pauseReading() {
        if (!isPlaying) return;
        
        if (isPaused) {
            synth.resume();
            isPaused = false;
            pauseBtn.innerHTML = "⏸️ Pause";
            statusEl.innerHTML = statusEl.innerHTML.replace(" (Paused)", "");
        } else {
            synth.pause();
            isPaused = true;
            pauseBtn.innerHTML = "▶️ Resume";
            statusEl.innerHTML += " (Paused)";
        }
    }
    
    // Stop reading
    function stopReading() {
        synth.cancel();
        isPlaying = false;
        isPaused = false;
        
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        repeatBtn.disabled = true;
        
        currentIndex = 0;
        lastLine = null;
        
        statusEl.textContent = "Ready to read.";
        updateProgress();
    }
    
    // Modified speakWordGroup function with better punctuation handling
    function speakWordGroup(startIndex, isRepeating = false) {
        if (startIndex >= tokens.length || isPaused) {
            if (startIndex >= tokens.length && !isRepeating) {
                stopReading();
                statusEl.innerHTML = "Reading complete.";
                updateProgress();
            }
            return;
        }

        const endIndex = Math.min(startIndex + 8, tokens.length);
        const group = tokens.slice(startIndex, endIndex);
        
        // Store current position only if not repeating
        if (!isRepeating) {
            lastLine = {
                group: group,
                startIndex: startIndex
            };
            repeatBtn.disabled = false;
        }

        function speakNextWord(indexInGroup) {
            if (indexInGroup >= group.length) {
                setTimeout(() => {
                    speakWordGroup(endIndex);
                }, 500 / currentSpeed);
                return;
            }

            const token = group[indexInGroup];
            const symbolInfo = getSymbol(token);
            const isParagraph = token === '\n';
            
            // Update status
            updateStatus(token, symbolInfo, startIndex + indexInGroup);
            updateProgress();

            // Determine what to speak
            let textToSpeak = '';
            if (isParagraph) {
                textToSpeak = 'new paragraph';
            } else if (symbolInfo) {
                // Handle symbol dictation
                if (symbolInfo.token) {
                    textToSpeak = symbolInfo.token;
                    if (symbolInfo.speak) {
                        textToSpeak += ' ' + symbolInfo.name;
                    }
                } else if (symbolInfo.speak) {
                    textToSpeak = symbolInfo.name;
                }
            } else {
                textToSpeak = token;
            }

            // Speak the text
            speakText(textToSpeak, symbolInfo, () => {
                speakNextWord(indexInGroup + 1);
            });

            currentIndex = startIndex + indexInGroup;
        }

        speakNextWord(0);
    }

    function updateStatus(token, symbolInfo, position) {
        let statusHTML = `Reading: `;
        
        if (token === '\n') {
            statusHTML += `<span class="paragraph-marker">[PARAGRAPH]</span> `;
        } else {
            const displayWord = symbolInfo?.token || token;
            statusHTML += `<span class="current-word">${displayWord}</span> `;
            
            if (symbolInfo?.hasSymbol && symbolInfo.speak) {
                statusHTML += `<span class="punctuation">[${token.slice(-1)}]</span>`;
            }
        }
        
        statusHTML += `<small>(${position + 1}/${tokens.length})</small>`;
        statusEl.innerHTML = statusHTML;
    }

    function speakText(text, symbolInfo, callback) {
        if (!text.trim()) {
            setTimeout(callback, (symbolInfo?.pause || 50) / currentSpeed);
            return;
        }

        utterance = new SpeechSynthesisUtterance(text);
        
        // Set selected voice if available
        const selectedOption = voiceSelect.selectedOptions[0];
        if (selectedOption && selectedOption.value) {
            const voices = synth.getVoices();
            const selectedVoiceName = selectedOption.getAttribute('data-name');
            utterance.voice = voices.find(v => v.name === selectedVoiceName);
        }
        
        utterance.rate = currentSpeed;
        utterance.pitch = 1.0;
        
        utterance.onend = function() {
            const pauseDuration = symbolInfo?.pause || 50;
            setTimeout(callback, pauseDuration / currentSpeed);
        };
        
        synth.speak(utterance);
    }

    // Modified repeat functionality
    function repeatLastLine() {
        if (!lastLine || !lastLine.group) return;
        
        if (isPaused) {
            synth.resume();
            isPaused = false;
            pauseBtn.innerHTML = "⏸️ Pause";
            statusEl.innerHTML = statusEl.innerHTML.replace(" (Paused)", "");
            return;
        }

        // If currently playing, pause first
        if (synth.speaking) {
            synth.pause();
        }

        // Store current state
        const wasPlaying = isPlaying;
        const originalTokens = [...tokens];
        const originalIndex = currentIndex;

        // Set up for repeating
        tokens = lastLine.group;
        currentIndex = 0;
        isPlaying = true;
        playBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        
        statusEl.textContent = "Repeating last line...";
        updateProgress();
        
        // Speak the line with isRepeating flag
        speakWordGroup(0, true);
        
        // Restore original state after completion
        const checkCompletion = setInterval(() => {
            if (currentIndex >= tokens.length - 1) {
                clearInterval(checkCompletion);
                if (wasPlaying) {
                    // Resume normal playback
                    tokens = originalTokens;
                    currentIndex = lastLine.startIndex;
                    speakWordGroup(lastLine.startIndex);
                } else {
                    // Return to stopped state
                    stopReading();
                }
            }
        }, 100);
    }

    // Toggle dark mode
    function toggleDarkMode() {
        isDarkMode = !isDarkMode;
        body.classList.toggle('dark-mode', isDarkMode);
        darkModeBtn.textContent = isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode";
        
        // Save preference to localStorage
        localStorage.setItem('darkMode', isDarkMode);
    }

    // Check for saved dark mode preference
    function checkDarkModePreference() {
        const savedMode = localStorage.getItem('darkMode');
        if (savedMode !== null) {
            isDarkMode = savedMode === 'true';
            body.classList.toggle('dark-mode', isDarkMode);
            darkModeBtn.textContent = isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode";
        }
    }

    // Process PDF file
    async function processPDF(file) {
        if (!file) return;
        
        pdfStatus.style.display = 'block';
        pdfStatus.textContent = "Loading PDF...";
        
        try {
            const pdfData = await readFileAsArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
            currentPdf = pdf;
            
            // Populate page selector
            pageSelect.innerHTML = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Page ${i}`;
                pageSelect.appendChild(option);
            }
            
            pdfPages.style.display = 'block';
            pdfStatus.textContent = `PDF loaded (${pdf.numPages} pages)`;
            
            // Load first page by default
            loadPDFPage(1);
        } catch (error) {
            pdfStatus.textContent = `Error loading PDF: ${error.message}`;
            console.error("PDF error:", error);
        }
    }
    
    // Load specific PDF page
    async function loadPDFPage(pageNumber) {
        if (!currentPdf) return;
        
        pdfStatus.textContent = `Extracting text from page ${pageNumber}...`;
        
        try {
            const page = await currentPdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const textItems = textContent.items.map(item => item.str);
            currentPdfText = textItems.join(' ');
            textInput.value = currentPdfText;
            pdfStatus.textContent = `Text extracted from page ${pageNumber}`;
        } catch (error) {
            pdfStatus.textContent = `Error extracting text: ${error.message}`;
            console.error("PDF text extraction error:", error);
        }
    }
    
    // Process image file with OCR
    async function processImage(file) {
        if (!file) return;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        
        ocrStatus.style.display = 'block';
        ocrStatus.textContent = "Processing image with OCR...";
        
        try {
            const { data: { text } } = await Tesseract.recognize(
                file,
                'eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            ocrStatus.textContent = `OCR progress: ${Math.round(m.progress * 100)}%`;
                        }
                    }
                }
            );
            
            textInput.value = text;
            ocrStatus.textContent = "OCR completed successfully!";
        } catch (error) {
            ocrStatus.textContent = `OCR error: ${error.message}`;
            console.error("OCR error:", error);
        }
    }
    
    // Helper function to read file as ArrayBuffer
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // Event listeners
    playBtn.addEventListener('click', startReading);
    pauseBtn.addEventListener('click', pauseReading);
    stopBtn.addEventListener('click', stopReading);
    repeatBtn.addEventListener('click', repeatLastLine);
    darkModeBtn.addEventListener('click', toggleDarkMode);
    
    // Tab switching
    textTabBtn.addEventListener('click', () => switchTab('text'));
    pdfTabBtn.addEventListener('click', () => switchTab('pdf'));
    imageTabBtn.addEventListener('click', () => switchTab('image'));
    
    // PDF handling
    pdfInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            processPDF(e.target.files[0]);
        }
    });
    
    pageSelect.addEventListener('change', (e) => {
        loadPDFPage(parseInt(e.target.value));
    });
    
    // Image handling
    imageInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            processImage(e.target.files[0]);
        }
    });
    
    speedSelect.addEventListener('change', function() {
        currentSpeed = parseFloat(this.value);
        if (isPlaying && !isPaused && utterance) {
            synth.cancel();
            speakWordGroup(currentIndex);
        }
    });
    
    // Load voices when they become available
    if (synth.getVoices().length > 0) {
        initVoices();
    } else {
        synth.addEventListener('voiceschanged', initVoices);
    }

    // Check for dark mode preference on load
    checkDarkModePreference();
});