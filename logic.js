// =================================================================
// Configuration et Variables Globales
// =================================================================

const SUPABASE_URL = 'https://qokkovegsxandxycmfru.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFva2tvdmVnc3hhbmR4eWNtZnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1Mjk5MzYsImV4cCI6MjA4MDEwNTkzNn0.4phiYXXCGDlU9MSqXMGp2yN_eMNx_D1NGlSrtEefqPQ'; 

// On utilise un nom différent pour éviter le conflit "already declared"
let supabaseClient; 

let slideDefinitions = [];
let currentSlide = 0;
let currentResponseIndex = {};
let rawData = {}; 

const zones = [1, 2];
const questions = ["q1","q2","q3","q4"];
const TRANSITION_DURATION_MS = 500; 

const DIAPO_FOLDER = 'diapos';
const DIAPO_FILE_EXTENSION = '.jpg'; 

// =================================================================
// MAPPING DES INTITULÉS POUR LA PRÉSENTATION
// =================================================================

const PRESENTATION_CONFIG = {
    zoneNames: {
        1: "Première situation",
        2: "Deuxième situation"
    },
    questionIntitules: {
        q1: "Qu'auriez-vous fait à la place ?",
        q2: "Quel élément positif / négatif avez-vous remarqué dans la scène ?",
        q3: "Comment faire pour éviter cette situation ?",
        q4: "Quels éléments de cette situation pouvez-vous corréler avec des événements vécus en SAE / travaux de groupe ?"
    }
};

// =================================================================
// 1. Fonctions Globales
// =================================================================

window.toggleFullscreen = function() {
    const elem = document.documentElement; 
    if (!document.fullscreenElement) elem.requestFullscreen();
    else elem.exitFullscreen();
}

window.handleResponseNavigation = function(key, direction) {
    if (currentResponseIndex[key] === undefined) return;
    const totalResponses = rawData[key].length;
    let newIndex = currentResponseIndex[key] + direction;
    if (newIndex >= 0 && newIndex <= totalResponses) {
        currentResponseIndex[key] = newIndex;
        displayCurrentSlide();
    }
}

window.handleManualNavigation = async function(direction) {
    await generateSlideDefinitions(); 
    navigateSlide(direction);
}

// =================================================================
// 2. Fonctions Internes
// =================================================================

function updateProgressBar() {
    const progressBar = document.getElementById('progress-bar');
    if (!progressBar) return;
    const totalSlides = slideDefinitions.length;
    if (totalSlides === 0) {
        progressBar.style.width = '0%';
        return;
    }
    const progressPercent = ((currentSlide + 1) / totalSlides) * 100;
    progressBar.style.width = `${progressPercent}%`;
}

function getDiapoImageUrl(index) {
    return `${DIAPO_FOLDER}/diapo${index}${DIAPO_FILE_EXTENSION}`;
}

async function generateSlideDefinitions() {
    // On vérifie que le client est bien initialisé
    if (!supabaseClient) return;

    slideDefinitions = []; 
    rawData = {}; 

    // --- ÉTAPE 1: RÉCUPÉRATION DES DONNÉES ---
    const { data: responses, error } = await supabaseClient
        .from('reponses')
        .select('zone, question, reponse')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Erreur Supabase :', error);
        return;
    }
    
    const groupedResponses = responses.reduce((acc, row) => {
        const key = `${row.zone}_${row.question}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row.reponse);
        return acc;
    }, {});

    // --- ÉTAPE 2: CONSTRUCTION ---
    
    for (let i = 1; i <= 7; i++) {
        slideDefinitions.push({ type: 'image', id: `diapo-${i}`, url: getDiapoImageUrl(i) });
    }

    zones.forEach(zone => {
        slideDefinitions.push({ type: 'separator', id: `sep_${zone}`, zone: zone });
        questions.forEach(q => {
            const key = `${zone}_${q}`;
            const data = groupedResponses[key] || []; 
            rawData[key] = data; 
            if (data.length > 0) {
                if (currentResponseIndex[key] === undefined) currentResponseIndex[key] = 0;
                slideDefinitions.push({ type: 'question', id: key, zone: zone, question: q });
            }
        });
    });

    for (let i = 8; i <= 11; i++) {
        slideDefinitions.push({ type: 'image', id: `diapo-${i}`, url: getDiapoImageUrl(i) });
    }

    if (currentSlide >= slideDefinitions.length) currentSlide = 0;
    updateProgressBar();
}

function generateSlideHTML(slideDef) {
    const { type, id, zone, question } = slideDef;
    
    if (type === 'separator') {
        const zoneName = PRESENTATION_CONFIG.zoneNames[zone] || `Situation ${zone}`;
        return `<div class="slide-item"><div class="separator">${zoneName}</div></div>`;
    }
    
    if (type === 'image') {
        return `<div class="slide-item is-image-slide"><img src="${slideDef.url}" alt="" class="full-screen-image"></div>`;
    }
    
    if (type === 'question') {
        const key = id;
        const data = rawData[key];
        const currentIdx = currentResponseIndex[key];
        const totalResponses = data.length;
        const responseToShowIndex = currentIdx - 1;

        const zoneName = PRESENTATION_CONFIG.zoneNames[zone] || `Situation ${zone}`;
        const questionIntitule = PRESENTATION_CONFIG.questionIntitules[question] || `Question ${question}`;

        let content = `<div style="max-height:90%; overflow-y:auto;">
                <h2>${zoneName} - ${questionIntitule}</h2>
                <hr style="color: #000;">`;
        
        if (currentIdx > 0 && responseToShowIndex < totalResponses) {
            content += `<p style="font-weight: bold;">${currentIdx}. ${data[responseToShowIndex]}</p>`;
        } else {
            content += `<p style="font-style: italic; color: #555;">Cliquez sur "Afficher Réponse" pour commencer.</p>`;
        }
        
        content += `</div><div style="margin-top: 30px;">`;
        if (currentIdx > 1) content += `<button class="btn btn-warning me-3" onclick="handleResponseNavigation('${key}', -1)">Précédent</button>`;
        if (currentIdx < totalResponses) content += `<button class="btn btn-success" onclick="handleResponseNavigation('${key}', 1)">Afficher Réponse ${currentIdx + 1}/${totalResponses}</button>`;
        content += `</div>`;
        
        return `<div class="slide-item">${content}</div>`;
    }
    return `<div class="slide-item"><h1>Erreur</h1></div>`;
}

function displayCurrentSlide() {
    const contentContainer = document.getElementById("diapo-content");
    if (slideDefinitions.length === 0) {
        contentContainer.innerHTML = `<div class="slide-item"><h1>Chargement...</h1></div>`;
        return;
    }
    contentContainer.style.opacity = 0; 
    setTimeout(() => {
        contentContainer.innerHTML = generateSlideHTML(slideDefinitions[currentSlide]);
        contentContainer.style.opacity = 1;
        updateProgressBar();
    }, TRANSITION_DURATION_MS); 
}

function navigateSlide(direction) {
    if (slideDefinitions.length === 0) return;
    currentSlide = (currentSlide + direction + slideDefinitions.length) % slideDefinitions.length;
    displayCurrentSlide();
}

// =================================================================
// 3. INITIALISATION
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // window.supabase est fourni par le script CDN dans admin.html
    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 
    } else {
        console.error("SDK Supabase introuvable");
        return;
    }

    if (sessionStorage.getItem('isAdmin') !== 'true') {
        window.location.href = "admin-login.html";
        return;
    }

    async function start() {
        await generateSlideDefinitions(); 
        displayCurrentSlide();
    }
    start();
});
