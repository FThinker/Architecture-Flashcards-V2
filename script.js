let appData = null;
let currentStack = [];
let currentIndex = 0;
let favoriteImages = []; 

// --- CACHE BUSTING ---
// Creates a unique timestamp on page load.
// Forces the browser to fetch fresh images for this session,
// preventing stale cache issues while updating data.
const cacheBuster = new Date().getTime(); 

// --- EMOJI MAPPING ---
// Keys are in Italian to match the PDF text extraction.
const emojiMap = {
    'ELLEN': '🏛️',      // Hellenic
    'ROMAN': '🦅',      // Roman
    'IMPERIALE': '👑',  // Imperial
    'BIZANTINA': '🕌',  // Byzantine
    'GOTICO': '⛪',     // Gothic
    'MEDIOEVO': '🏰',   // Medieval
    'DEFAULT': '📐'
};

// --- DOM Elements ---
const selectionView = document.getElementById('selection-view');
const flashcardView = document.getElementById('flashcard-view');
const categoryGrid = document.getElementById('category-grid');
const flashcard = document.getElementById('flashcard');
const cardImage = document.getElementById('card-image');
const cardTitle = document.getElementById('card-title');
const cardCategory = document.getElementById('card-category');
const counter = document.getElementById('counter');
const progressFill = document.getElementById('progress-fill');
const favBtn = document.getElementById('btn-toggle-fav');
const favIcon = document.getElementById('fav-icon');
const globalTooltip = document.getElementById('global-tooltip');

// --- INITIALIZATION ---

// Load Favorites from LocalStorage
try {
    const savedFavs = localStorage.getItem('archFlashFavsImg');
    favoriteImages = savedFavs ? JSON.parse(savedFavs) : [];
} catch (e) {
    console.warn("LocalStorage unavailable", e);
}

// Fetch Data (Added cache buster to JSON request as well)
fetch('data.json?v=' + cacheBuster)
    .then(response => response.json())
    .then(data => {
        appData = data;
        initSelectionView();
    })
    .catch(err => console.error('Error loading JSON:', err));

function getEmoji(catName) {
    const upper = catName.toUpperCase();
    for (const key in emojiMap) {
        if (upper.includes(key)) return emojiMap[key];
    }
    return emojiMap['DEFAULT'];
}

function initSelectionView() {
    categoryGrid.innerHTML = '';

    // 1. "All Categories" Card
    const totalImages = appData.categories.reduce((acc, cat) => acc + countImages(cat.buildings), 0);
    const allBtn = createCategoryCard(
        'All Categories', 
        `${totalImages} Total Images`, 
        '🌎', 
        () => startSession('all'),
        'all-card'
    );
    categoryGrid.appendChild(allBtn);

    // 2. "Favorites" Card
    const favCount = favoriteImages.length;
    const favBtnCard = createCategoryCard(
        'Your Favorites',
        `${favCount} Saved Images`,
        '❤️',
        () => {
            if(favCount > 0) startSession('favs');
        },
        'fav-card'
    );
    
    // --- TOOLTIP LOGIC ---
    const tooltipIcon = document.createElement('span');
    tooltipIcon.className = 'tooltip-trigger';
    tooltipIcon.textContent = '?';
    tooltipIcon.setAttribute('tabindex', '0'); // Accessibility: Focusable on mobile
    
    const tooltipText = "Clicca il cuore mentre guardi le flashcard per salvarle qui. I dati sono salvati solo in questo browser.";

    // Tooltip Events
    tooltipIcon.addEventListener('mouseenter', (e) => showGlobalTooltip(e.target, tooltipText));
    tooltipIcon.addEventListener('mouseleave', () => hideGlobalTooltip());
    tooltipIcon.addEventListener('focus', (e) => showGlobalTooltip(e.target, tooltipText));
    tooltipIcon.addEventListener('blur', () => hideGlobalTooltip());
    tooltipIcon.addEventListener('click', (e) => e.stopPropagation()); // Prevent card click

    favBtnCard.querySelector('h3').appendChild(tooltipIcon);

    if (favCount === 0) {
        favBtnCard.classList.add('disabled');
        favBtnCard.querySelector('p').textContent = "Nessuna immagine salvata";
    }
    categoryGrid.appendChild(favBtnCard);

    // 3. Dynamic Category Cards
    appData.categories.forEach(cat => {
        categoryGrid.appendChild(createCategoryCard(
            cat.name, 
            `${countImages(cat.buildings)} Immagini`, 
            getEmoji(cat.name), 
            () => startSession(cat.id)
        ));
    });
}

function showGlobalTooltip(targetElement, text) {
    globalTooltip.textContent = text;
    const rect = targetElement.getBoundingClientRect();
    
    // Position to the right of the icon
    let top = rect.top;
    let left = rect.right + 10;
    
    // If it goes off-screen (mobile), flip to left
    if (left + 220 > window.innerWidth) {
        left = rect.left - 230; 
    }

    globalTooltip.style.top = `${top}px`;
    globalTooltip.style.left = `${left}px`;
    globalTooltip.classList.add('visible');
}

function hideGlobalTooltip() {
    globalTooltip.classList.remove('visible');
}

function createCategoryCard(title, subtitle, emoji, onClick, extraClass = '') {
    const btn = document.createElement('div');
    btn.className = `category-card ${extraClass}`;
    btn.innerHTML = `<h3>${emoji} ${title}</h3><p>${subtitle}</p>`;
    btn.addEventListener('click', onClick);
    return btn;
}

function countImages(buildings) {
    return buildings.reduce((acc, b) => acc + b.images.length, 0);
}

// --- SESSION LOGIC ---

function startSession(mode) {
    currentStack = [];
    
    appData.categories.forEach(cat => {
        cat.buildings.forEach(build => {
            build.images.forEach(img => {
                let include = false;
                
                if (mode === 'all') {
                    include = true;
                } else if (mode === 'favs') {
                    include = favoriteImages.includes(img);
                } else if (cat.id === mode) {
                    include = true;
                }

                if (include) {
                    currentStack.push({
                        name: build.name,
                        category: cat.name,
                        image: img
                    });
                }
            });
        });
    });

    if (currentStack.length === 0) {
        alert("No cards found for this selection.");
        return;
    }

    // Shuffle the stack (Fisher-Yates)
    for (let i = currentStack.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentStack[i], currentStack[j]] = [currentStack[j], currentStack[i]];
    }

    currentIndex = 0;
    updateCard(false); 
    
    selectionView.classList.add('hidden');
    flashcardView.classList.remove('hidden');
}

// --- FLASHCARD LOGIC ---

function updateCard(animate = true) {
    flashcard.classList.remove('is-flipped');
    
    if (animate) {
        flashcard.classList.add('swipe-in');
        setTimeout(() => flashcard.classList.remove('swipe-in'), 200);
    }

    const item = currentStack[currentIndex];
    
    // Set Content (with Cache Busting)
    cardImage.src = `${item.image}?v=${cacheBuster}`;
    
    cardTitle.textContent = item.name;
    cardCategory.textContent = item.category;
    
    // Update Controls
    const displayIndex = currentIndex + 1;
    const total = currentStack.length;
    counter.textContent = `${displayIndex} / ${total}`;
    
    const percentage = (displayIndex / total) * 100;
    progressFill.style.width = `${percentage}%`;

    // Favorite State
    updateFavButtonState(item.image);

    // Preload next images
    preloadImages();
}

function preloadImages() {
    for (let i = 1; i <= 3; i++) {
        if (currentIndex + i < currentStack.length) {
            new Image().src = `${currentStack[currentIndex + i].image}?v=${cacheBuster}`;
        }
    }
}

function updateFavButtonState(imagePath) {
    if (favoriteImages.includes(imagePath)) {
        favBtn.classList.add('active');
        favIcon.textContent = '❤'; 
    } else {
        favBtn.classList.remove('active');
        favIcon.textContent = '♡'; 
    }
}

// Favorites Toggle
favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const currentImg = currentStack[currentIndex].image;
    
    if (favoriteImages.includes(currentImg)) {
        favoriteImages = favoriteImages.filter(id => id !== currentImg);
    } else {
        favoriteImages.push(currentImg);
    }
    
    localStorage.setItem('archFlashFavsImg', JSON.stringify(favoriteImages));
    updateFavButtonState(currentImg);
});

// --- NAVIGATION & GESTURES ---

function nextCard() {
    if (currentIndex < currentStack.length - 1) {
        flashcard.classList.add('swipe-left'); 
        setTimeout(() => {
            flashcard.classList.remove('swipe-left');
            currentIndex++;
            updateCard();
        }, 150); 
    } else {
        alert("Hai finito il mazzo! Torno alla home.");
        goHome();
    }
}

function prevCard() {
    if (currentIndex > 0) {
        flashcard.classList.add('swipe-right'); 
        setTimeout(() => {
            flashcard.classList.remove('swipe-right');
            currentIndex--;
            updateCard();
        }, 150);
    }
}

window.goHome = function() {
    flashcardView.classList.add('hidden');
    selectionView.classList.remove('hidden');
    flashcard.classList.remove('is-flipped');
    initSelectionView(); 
};

// Button Event Listeners
document.getElementById('btn-back-home').addEventListener('click', goHome);
document.getElementById('btn-next').addEventListener('click', (e) => { e.stopPropagation(); nextCard(); });
document.getElementById('btn-prev').addEventListener('click', (e) => { e.stopPropagation(); prevCard(); });


// --- UNIFIED INPUT HANDLING (Touch & Mouse) ---

let startX = 0;
let startY = 0;
let isDragging = false;
const swipeThreshold = 30; 

// Touch Events
flashcard.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
}, {passive: false});

flashcard.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = startX - currentX;
    const diffY = startY - currentY;

    // Determine if user is scrolling horizontally or vertically
    if (Math.abs(diffX) > Math.abs(diffY)) {
        // If horizontal, prevent default (scrolling page) to allow swipe
        if (e.cancelable) e.preventDefault();
    }
}, {passive: false});

flashcard.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    handleInputEnd(startX, endX, startY, endY);
    isDragging = false;
});

// Mouse Events
flashcard.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
    flashcard.style.cursor = 'grabbing';
});

flashcard.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    const endX = e.clientX;
    const endY = e.clientY;
    handleInputEnd(startX, endX, startY, endY);
    isDragging = false;
    flashcard.style.cursor = 'grab';
});

flashcard.addEventListener('mouseleave', () => {
    isDragging = false;
    flashcard.style.cursor = 'grab';
});

function handleInputEnd(startX, endX, startY, endY) {
    const diffX = startX - endX;
    const diffY = startY - endY;

    // Swipe Detection
    if (Math.abs(diffX) > swipeThreshold) {
        if (diffX > 0) {
            nextCard(); // Swipe Left -> Next
        } else {
            prevCard(); // Swipe Right -> Previous
        }
    } 
    // Tap Detection (Minimal movement)
    else if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
        flashcard.classList.toggle('is-flipped');
    }
}