import React, { useEffect, useRef } from 'react';

const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const AuroraBackground: React.FC = () => {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Create float letters
    for (let i = 0; i < 40; i++) {
      const e = document.createElement('div');
      e.className = 'float-letter';
      e.textContent = L[Math.floor(Math.random() * 26)];
      e.style.left = Math.random() * 100 + '%';
      e.style.fontSize = (30 + Math.random() * 64) + 'px';
      e.style.animationDuration = (5 + Math.random() * 7) + 's';
      e.style.animationDelay = (-Math.random() * 12) + 's';
      scene.appendChild(e);
    }

    // Create sparks
    for (let i = 0; i < 36; i++) {
      const e = document.createElement('div');
      e.className = 'spark';
      e.style.left = Math.random() * 100 + '%';
      e.style.top = Math.random() * 100 + '%';
      e.style.animationDuration = (2 + Math.random() * 4) + 's';
      e.style.animationDelay = (-Math.random() * 6) + 's';
      scene.appendChild(e);
    }

    // Interactive mouse move
    const handleMouseMove = (e: MouseEvent) => {
      if (!sceneRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5);
      const y = (e.clientY / window.innerHeight - 0.5);
      sceneRef.current.style.transform = `translate(${x * 18}px, ${y * 18}px)`;
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (scene) {
        // Cleanup dynamically created elements
        const letters = scene.querySelectorAll('.float-letter');
        const sparks = scene.querySelectorAll('.spark');
        letters.forEach(l => l.remove());
        sparks.forEach(s => s.remove());
      }
    };
  }, []);

  return (
    <div className="scene" id="scene" ref={sceneRef}>
      <div className="blob b1"></div>
      <div className="blob b2"></div>
      <div className="blob b3"></div>
    </div>
  );
};
