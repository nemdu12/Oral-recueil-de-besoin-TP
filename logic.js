// --- DÉBUT DU CONTENU DU FICHIER logic.js ---

// 1. CONFIGURATION ET INITIALISATION DU CLIENT SUPABASE (Fusionné ici)
// REMPLACEZ CES PLACEHOLDERS PAR VOS VRAIES CLÉS SUPABASE
const SUPABASE_URL = 'https://qokkovegsxandxycmfru.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFva2tvdmVnc3hhbmR4eWNtZnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1Mjk5MzYsImV4cCI6MjA4MDEwNTkzNn0.4phiYXXCGDlU9MSqXMGp2yN_eMNx_D1NGlSrtEefqPQ'; 

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- VÉRIFICATION DE SÉCURITÉ ---
if (sessionStorage.getItem('isAdmin') !== 'true') {
    window.location.href = "admin-login.html";
}
sessionStorage.removeItem('isAdmin'); 

// --- VARIABLES GLOBALES (DÉCLARÉES UNE SEULE FOIS) ---
const zones = [1, 2]; // CORRECTION: Supprime la duplication
const questions = ["q1","q2","q3","q4"]; // CORRECTION: Supprime la duplication
const TRANSITION_DURATION_MS = 500; 

let slideDefinitions = [];
let currentSlide = 0;
let currentResponseIndex = {};
let rawData = {}; 

// --- FONCTIONS ESSENTIELLES ---

function toggleFullscreen() {
    const elem = document.documentElement; 
    if (!document.fullscreenElement) elem.requestFullscreen();
    else document.exitFullscreen();
}

/**
 * Récupère les données brutes de la BD Supabase et remplit le tableau 'slideDefinitions'.
 */
async function generateSlideDefinitions() {
    // La vérification du client supabase est implicite si le code arrive ici.
    
    slideDefinitions = []; 
    rawData = {}; 

    // 1. Requête Supabase
    const { data: responses, error } = await supabase
        .from('reponses')
        .select('zone, question, reponse')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Erreur Supabase :', error);
        document.getElementById("diapo-content").innerHTML = `<div class="slide-item"><h1>Erreur de BD: ${error.message}</h1></div>`;
        return;
    }
    
    // 2. Traitement des données pour reconstruire le format 'rawData'
    const groupedResponses = responses.reduce((acc, row) => {
        const key = `${row.zone}_${row.question}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row.reponse);
        return acc;
    }, {});


    // 3. Remplissage des 'slideDefinitions'
    zones.forEach(zone => {
        slideDefinitions.push({ type: 'separator', id: `sep_${zone}`, zone: zone });

        questions.forEach(q => {
            const key = `${zone}_${q}`;
            const data = groupedResponses[key] || []; 
            
            rawData[key] = data; 
            
            if (rawData[key].length > 0) {
                if (currentResponseIndex[key] === undefined) {
                    currentResponseIndex[key] = 0; 
                }
                slideDefinitions.push({ type: 'question', id: key, zone: zone, question: q });
            }
        });
    });
    
    if (currentSlide >= slideDefinitions.length) {
        currentSlide = 0;
    }
}

/**
 * Génère le HTML pour la slide actuellement définie.
 */
function generateSlideHTML(slideDef) {
    const { type, id, zone, question } = slideDef;
    
    if (type === 'separator') {
        return `<div class="slide-item"><div class="separator">Situation ${zone}</div></div>`;
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
        
        // --- AFFICHAGE DE LA RÉPONSE EN COURS SEULEMENT ---
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
        
        // --- BOUTONS D'ACTION SUR LA DIAPO ---
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
 * Affiche la slide à l'index 'currentSlide' en générant son HTML.
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

    }, TRANSITION_DURATION_MS); 
}

/**
 * Gère le défilement des index de réponses sur la diapositive actuelle.
 */
function handleResponseNavigation(key, direction) {
    if (currentResponseIndex[key] === undefined) return;
    
    const totalResponses = rawData[key].length;
    let newIndex = currentResponseIndex[key] + direction;

    if (newIndex >= 0 && newIndex <= totalResponses) {
        currentResponseIndex[key] = newIndex;
        displayCurrentSlide();
    }
}

/**
 * Gère le défilement des slides (manuellement).
 */
function navigateSlide(direction) {
    if (slideDefinitions.length === 0) return;
    
    currentSlide = (currentSlide + direction + slideDefinitions.length) % slideDefinitions.length;
    displayCurrentSlide();
}

/**
 * Fonction appelée par les boutons de navigation externes.
 */
async function handleManualNavigation(direction) {
    await generateSlideDefinitions(); 
    navigateSlide(direction);
}


// --- INITIALISATION ---

async function initializeAdmin() {
    await generateSlideDefinitions(); 
    displayCurrentSlide();
}

initializeAdmin();
