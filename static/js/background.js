// Dynamic Background Animation using GSAP
// Creates floating geometric shapes/cards in the background

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
    // Random destination
    const destX = Math.random() * window.innerWidth;
    const destY = Math.random() * window.innerHeight;
    const duration = 20 + Math.random() * 40; // Slow movement

    gsap.to(element, {
        x: destX - parseFloat(element.style.left),
        y: destY - parseFloat(element.style.top),
        rotation: Math.random() * 360,
        rotationX: Math.random() * 360,
        rotationY: Math.random() * 360,
        duration: duration,
        ease: "sine.inOut",
        onComplete: () => animateShape(element) // Loop
    });
}

// Make it globally available if needed, though game.js calls it
window.initBackgroundAnimation = initBackgroundAnimation;
