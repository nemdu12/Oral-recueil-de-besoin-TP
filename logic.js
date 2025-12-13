// =================================================================
// Configuration et Variables Globales
// =================================================================

const SUPABASE_URL = 'https://qokkovegsxandxycmfru.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFva2tvdmVnc3hhbmR4eWNtZnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1Mjk5MzYsImV4cCI6MjA4MDEwNTkzNn0.4phiYXXCGDlU9MSqXMGp2yN_eMNx_D1NGlSrtEefqPQ'; 

let supabase; 
let slideDefinitions = [];
let currentSlide = 0;
let currentResponseIndex = {};
let rawData = {}; 

const zones = [1, 2];
const questions = ["q1","q2","q3","q4"];
const TRANSITION_DURATION_MS = 500; 

// Dossier et format de fichier pour les images de diapositives
const DIAPO_FOLDER = 'diapos';
const DIAPO_FILE_EXTENSION = '.jpg'; 


// =================================================================
// 1. Fonctions Globales (Appelées par onclick dans admin.html)
// =================================================================

window.toggleFullscreen = function() {
    const elem = document.documentElement; 
    if (!document.fullscreenElement) elem.requestFullscreen();
    else elem.exitFullscreen();
}

/**
 * Gère la navigation entre les différentes réponses pour une même question.
 */
window.handleResponseNavigation = function(key, direction) {
    if (currentResponseIndex[key] === undefined) return;
    
    const totalResponses = rawData[key].length;
    let newIndex = currentResponseIndex[key] + direction;

    if (newIndex >= 0 && newIndex <= totalResponses) {
        currentResponseIndex[key] = newIndex;
        displayCurrentSlide();
    }
}

/**
 * Gère la navigation entre les slides (boutons Précédent/Suivant).
 */
window.handleManualNavigation = async function(direction) {
    // Recharge les données pour s'assurer qu'elles sont à jour avant de naviguer
    await generateSlideDefinitions(); 
    navigateSlide(direction);
}


// =================================================================
// 2. Fonctions Internes (Logique de l'application)
// =================================================================

/**
 * Met à jour la largeur de la barre de progression en bas de l'écran.
 */
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


/**
 * Construit l'URL complète pour une diapositive image.
 */
function getDiapoImageUrl(index) {
    return `${DIAPO_FOLDER}/diapo${index}${DIAPO_FILE_EXTENSION}`;
}


/**
 * Effectue la requête BD et construit le tableau de slides dans l'ordre désiré.
 * Ordre: D1-D7 -> Réponses BD (Zone 1 & 2) -> D8-D11
 */
async function generateSlideDefinitions() {
    if (typeof supabase === 'undefined' || supabase === null) {
         return;
    }

    slideDefinitions = []; 
    rawData = {}; 

    // --- ÉTAPE 1: RÉCUPÉRATION ET TRAITEMENT DES DONNÉES ---
    const { data: responses, error } = await supabase
        .from('reponses')
        .select('zone, question, reponse')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Erreur Supabase :', error);
        document.getElementById("diapo-content").innerHTML = `<div class="slide-item"><h1>Erreur de BD: ${error.message}</h1></div>`;
        return;
    }
    
    const groupedResponses = responses.reduce((acc, row) => {
        const key = `${row.zone}_${row.question}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row.reponse);
        return acc;
    }, {});


    // --- ÉTAPE 2: CONSTRUCTION DU FLUX DE SLIDES ---
    
    // A) AJOUT DES SLIDES IMAGES 1d à 7d
    for (let i = 1; i <= 7; i++) {
        slideDefinitions.push({ 
            type: 'image', 
            id: `diapo-${i}`, 
            url: getDiapoImageUrl(i), 
            description: `Slide d'introduction ${i}` 
        });
    }

    // B) AJOUT DES SLIDES DE RÉPONSES (r)
    zones.forEach(zone => {
        // Séparateur de Zone (Ex: Situation 1)
        slideDefinitions.push({ type: 'separator', id: `sep_${zone}`, zone: zone });

        questions.forEach(q => {
            const key = `${zone}_${q}`;
            const data = groupedResponses[key] || []; 
            
            rawData[key] = data; 
            
            if (rawData[key].length > 0) {
                // Ajout de la slide de question si des réponses existent
                if (currentResponseIndex[key] === undefined) {
                    currentResponseIndex[key] = 0; 
                }
                slideDefinitions.push({ type: 'question', id: key, zone: zone, question: q });
            }
        });
    });

    // C) AJOUT DES SLIDES IMAGES 8d à 11d
    for (let i = 8; i <= 11; i++) {
        slideDefinitions.push({ 
            type: 'image', 
            id: `diapo-${i}`, 
            url: getDiapoImageUrl(i), 
            description: `Slide de conclusion ${i}` 
        });
    }
    
    // --- FIN DE LA CONSTRUCTION ---

    if (currentSlide >= slideDefinitions.length) {
        currentSlide = 0;
    }
    
    updateProgressBar();
}

/**
 * Génère le HTML pour une slide donnée, en fonction de son type.
 */
function generateSlideHTML(slideDef) {
    const { type, id, zone, question } = slideDef;
    
    if (type === 'separator') {
        return `<div class="slide-item"><div class="separator">Situation ${zone}</div></div>`;
    }
    
    // GESTION DU TYPE IMAGE (Utilise la classe full-screen-image)
    if (type === 'image') {
        return `
            <div class="slide-item">
                <img src="${slideDef.url}" alt="${slideDef.description}" class="full-screen-image">
                <p style="margin-top: 15px; font-size: 1.2rem; color: #fff;">${slideDef.description}</p>
            </div>
        `;
    }
    
    if (type === 'question') {
        const key = id;
        const data = rawData[key];
        const currentIdx = currentResponseIndex[key];
        const totalResponses = data.length;
        const responseToShowIndex = currentIdx - 1;

        let content = `
            <div style="max-height:90%; overflow-y:auto;">
                <h2>Zone ${zone} - Question ${question}</h2>
                <hr style="color: #fff;">
        `;
        
        // Affichage de la réponse en cours
        if (currentIdx > 0 && responseToShowIndex < totalResponses) {
            content += `<p style="font-weight: bold; color: #fff;">
                            ${currentIdx.toLocaleString()}. ${data[responseToShowIndex]}
                        </p>`;
        } else if (currentIdx === 0 && totalResponses > 0) {
            content += `<p style="font-style: italic; color: #aaa;">
                            Cliquez sur "Afficher Réponse" pour commencer.
                        </p>`;
        } else if (totalResponses === 0) {
            content += `<p style="font-style: italic; color: #aaa;">
                            Aucune réponse enregistrée pour cette question.
                        </p>`;
        }
        
        content += `</div>`;
        
        // Boutons de navigation des réponses
        content += `<div style="margin-top: 30px;">`;

        if (currentIdx > 1) {
            content += `<button class="btn btn-warning me-3" onclick="handleResponseNavigation('${key}', -1)">Réponse Précédente</button>`;
        }
        
        if (currentIdx < totalResponses) {
            content += `<button class="btn btn-success" onclick="handleResponseNavigation('${key}', 1)">Afficher Réponse ${currentIdx + 1}/${totalResponses}</button>`;
        } else {
            content += `<p class="text-success mt-2" style="font-weight: bold;">Toutes les ${totalResponses} réponses affichées.</p>`;
        }

        content += `</div>`;
        
        return `<div class="slide-item">${content}</div>`;
    }
    
    return `<div class="slide-item"><h1>Erreur de type de slide.</h1></div>`;
}

/**
 * Gère l'affichage de la slide actuelle et les animations.
 */
function displayCurrentSlide() {
    const contentContainer = document.getElementById("diapo-content");
    
    if (slideDefinitions.length === 0) {
        contentContainer.innerHTML = `<div class="slide-item"><h1>[Aucune donnée disponible]</h1></div>`;
        return;
    }
    
    contentContainer.style.opacity = 0; 
    
    setTimeout(() => {
        contentContainer.innerHTML = generateSlideHTML(slideDefinitions[currentSlide]);
        contentContainer.style.opacity = 1;
        updateProgressBar();
    }, TRANSITION_DURATION_MS); 
}

/**
 * Avance ou recule l'index de la slide dans la liste complète.
 */
function navigateSlide(direction) {
    if (slideDefinitions.length === 0) return;
    
    currentSlide = (currentSlide + direction + slideDefinitions.length) % slideDefinitions.length;
    displayCurrentSlide();
}


// =================================================================
// 3. INITIALISATION DE L'APPLICATION
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- Vérification et Initialisation de Supabase ---
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 
    } else {
        document.getElementById("diapo-content").innerHTML = `<div class="slide-item"><h1>ERREUR FATALE: Librairie Supabase introuvable.</h1><p>Vérifiez votre connexion et le lien CDN dans admin.html.</p></div>`;
        return;
    }

    // --- Vérification d'Authentification (Sécurité) ---
    if (sessionStorage.getItem('isAdmin') !== 'true') {
        window.location.href = "admin-login.html";
        return;
    }
    sessionStorage.removeItem('isAdmin'); 

    // --- Démarrage ---
    async function initializeAdmin() {
        await generateSlideDefinitions(); 
        displayCurrentSlide();
    }
    initializeAdmin();

});
