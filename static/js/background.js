// Dynamic Background Animation using GSAP
// Creates floating geometric shapes/cards in the background

let currentState = 'normal';

function initBackgroundAnimation() {
    const container = document.getElementById('bg-animation');
    // Clear previous if any (though this runs once)
    container.innerHTML = '';

    // Create floating elements
    const count = 15;
    for (let i = 0; i < count; i++) {
        createFloatingShape(container);
    }
}

function setBackgroundState(state) {
    if (state === currentState) return;
    currentState = state;

    const bg = document.getElementById('bg-animation');

    // Global style tweaks
    if(state === 'judging') {
        gsap.to(bg, { opacity: 0.05, duration: 1 });
        gsap.to(document.body, { backgroundColor: "#000000", duration: 1 });
    } else if (state === 'urgent') {
         gsap.to(bg, { opacity: 0.3, duration: 0.5 });
         gsap.to(document.body, { backgroundColor: "#2c0502", duration: 0.5 }); // Dark Red tint

         // Force restart animations for immediate speed up
         const shapes = bg.children;
         for(let s of shapes) {
             gsap.killTweensOf(s);
             animateShape(s);
         }
    } else {
         gsap.to(bg, { opacity: 0.1, duration: 1 });
         gsap.to(document.body, { backgroundColor: "#121212", duration: 1 });
    }
}

function createFloatingShape(container) {
    const shape = document.createElement('div');

    // Randomize style: either a "card" outline or a solid block
    const isCard = Math.random() > 0.5;
    const size = 50 + Math.random() * 100;

    shape.style.position = 'absolute';
    shape.style.width = `${size}px`;
    shape.style.height = `${size * 1.4}px`; // Card aspect ratio
    shape.style.opacity = 0.03 + Math.random() * 0.05; // Very subtle
    shape.style.borderRadius = '10px';

    if (isCard) {
        shape.style.border = '2px solid #fff';
        shape.style.background = 'transparent';
    } else {
        shape.style.background = '#fff';
    }

    // Initial Position
    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;

    shape.style.left = `${startX}px`;
    shape.style.top = `${startY}px`;

    container.appendChild(shape);

    // Animate indefinitely
    animateShape(shape);
}

function animateShape(element) {
    // Determine props based on currentState
    let durationBase = 20;
    let colorOverride = null;

    if (currentState === 'urgent') {
        durationBase = 2; // VERY FAST
        colorOverride = '#e74c3c'; // Red
    } else if (currentState === 'judging') {
        durationBase = 60; // Very slow
        colorOverride = '#f1c40f'; // Gold tint
    }

    const destX = Math.random() * window.innerWidth;
    const destY = Math.random() * window.innerHeight;
    const duration = durationBase + Math.random() * durationBase;

    // Apply color change
    if(colorOverride) {
         if(element.style.border.includes('solid')) element.style.borderColor = colorOverride;
         else element.style.backgroundColor = colorOverride;
    } else {
         if(element.style.border.includes('solid')) element.style.borderColor = '#fff';
         else element.style.backgroundColor = '#fff';
    }

    gsap.to(element, {
        x: destX - parseFloat(element.style.left),
        y: destY - parseFloat(element.style.top),
        rotation: Math.random() * 360,
        rotationX: Math.random() * 360,
        rotationY: Math.random() * 360,
        duration: duration,
        ease: "sine.inOut",
        onComplete: () => animateShape(element)
    });
}

// Make it globally available if needed, though game.js calls it
window.initBackgroundAnimation = initBackgroundAnimation;
window.setBackgroundState = setBackgroundState;
