import React, { useEffect, useState, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export const EsportsBackground: React.FC = () => {
  const [windowSize, setWindowSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 1920, height: typeof window !== 'undefined' ? window.innerHeight : 1080 });

  // Mouse tracking for parallax and spotlight
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for mouse values to prevent jitter
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse coordinates to range [-1, 1] for parallax
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      mouseX.set(x);
      mouseY.set(y);
    };

    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [mouseX, mouseY]);

  // --- Parallax Transforms for different layers ---
  
  // Layer 2: Aurora (moves opposite to mouse slightly)
  const auroraX = useTransform(smoothMouseX, [-1, 1], [30, -30]);
  const auroraY = useTransform(smoothMouseY, [-1, 1], [30, -30]);

  // Layer 4 & 6: Rings and Objects (moves with mouse slightly)
  const objectsX = useTransform(smoothMouseX, [-1, 1], [-40, 40]);
  const objectsY = useTransform(smoothMouseY, [-1, 1], [-40, 40]);

  // Layer 5: Grid (moves slightly to adjust perspective)
  const gridX = useTransform(smoothMouseX, [-1, 1], [-10, 10]);
  
  // Layer 9: Nebula (very deep, moves very slowly)
  const nebulaX = useTransform(smoothMouseX, [-1, 1], [15, -15]);
  const nebulaY = useTransform(smoothMouseY, [-1, 1], [15, -15]);

  // --- Spotlight calculation ---
  // Translate [-1, 1] back to pixels
  const spotX = useTransform(smoothMouseX, [-1, 1], [0, windowSize.width]);
  const spotY = useTransform(smoothMouseY, [-1, 1], [0, windowSize.height]);
  const spotlightStyle = useTransform(
    [spotX, spotY],
    ([x, y]) => `radial-gradient(circle 600px at ${x}px ${y}px, rgba(139, 92, 246, 0.12), transparent 80%)`
  );

  // --- Pre-calculated Random Data ---

  // Generate Particles
  const particles = useMemo(() => {
    return Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      size: Math.random() * 4 + 1,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.5 + 0.1
    }));
  }, []);

  // Generate Geometric Objects
  const geometricObjects = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      type: ['cube', 'hex', 'triangle'][Math.floor(Math.random() * 3)],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 60 + 20,
      rotationSpeed: Math.random() * 30 + 15,
      direction: Math.random() > 0.5 ? 1 : -1,
      opacity: Math.random() * 0.15 + 0.05
    }));
  }, []);

  // Generate Data Streams
  const dataStreams = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
      opacity: Math.random() * 0.3 + 0.1
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#050816]">
      {/* Layer 1: Animated Gradient Background */}
      <div 
        className="absolute inset-0 opacity-80 animate-bg-shift"
        style={{
          background: 'linear-gradient(-45deg, #050816, #0B1020, #120B2F, #1A103D)',
          backgroundSize: '400% 400%'
        }}
      />

      {/* Layer 9: Nebula Clouds (Deep background) */}
      <motion.div 
        className="absolute inset-0"
        style={{ x: nebulaX, y: nebulaY }}
      >
        <div className="absolute top-[10%] left-[20%] w-[800px] h-[800px] rounded-full bg-brand-purple/20 blur-[150px] mix-blend-screen opacity-30 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[10%] right-[10%] w-[900px] h-[900px] rounded-full bg-brand-pink/10 blur-[150px] mix-blend-screen opacity-20 animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
      </motion.div>

      {/* Layer 2: Aurora Lights */}
      <motion.div 
        className="absolute inset-0"
        style={{ x: auroraX, y: auroraY }}
      >
        <div className="absolute top-0 left-1/4 w-[1000px] h-[400px] bg-brand-cyan/20 blur-[120px] rounded-[100%] transform -rotate-12 mix-blend-screen animate-aurora" />
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[300px] bg-brand-purple/20 blur-[100px] rounded-[100%] transform rotate-12 mix-blend-screen animate-aurora" style={{ animationDelay: '-5s' }} />
      </motion.div>

      {/* Layer 5: Futuristic Digital Grid Floor */}
      <motion.div 
        className="absolute bottom-0 left-0 right-0 h-[60vh] origin-bottom border-t border-brand-purple/10"
        style={{ 
          x: gridX,
          transform: 'perspective(1000px) rotateX(70deg)',
          background: 'linear-gradient(to top, rgba(139, 92, 246, 0.05) 0%, transparent 100%)',
          backgroundImage: `
            linear-gradient(to right, rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      >
        {/* Fading overlay for grid */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-[#050816]" />
      </motion.div>

      {/* Layer 7: Volumetric Light Rays */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-purple/10 via-transparent to-transparent opacity-40 transform -skew-x-12 scale-150 origin-top-left" />
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-brand-cyan/5 via-transparent to-transparent opacity-30 transform skew-x-12 scale-150 origin-top-right" />
      </div>

      {/* Layer 8: Holographic Data Streams */}
      <div className="absolute inset-0 overflow-hidden opacity-40">
        {dataStreams.map((stream) => (
          <div
            key={`stream-${stream.id}`}
            className="absolute top-0 w-px h-full bg-gradient-to-b from-transparent via-brand-cyan/40 to-transparent animate-data-stream"
            style={{
              left: `${stream.x}%`,
              animationDuration: `${stream.duration}s`,
              animationDelay: `${stream.delay}s`,
              opacity: stream.opacity
            }}
          />
        ))}
      </div>

      {/* Layer 4: Rotating Energy Rings (Centered roughly behind typical card position) */}
      <motion.div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20 mix-blend-screen"
        style={{ x: objectsX, y: objectsY }}
      >
        <div className="absolute inset-0 rounded-full border-[2px] border-brand-purple/40 border-dashed animate-spin-slow" />
        <div className="absolute inset-8 rounded-full border-[1px] border-brand-cyan/30 animate-spin-reverse-slow" />
        <div className="absolute inset-16 rounded-full border-[4px] border-brand-pink/20 border-dotted animate-spin-slow" style={{ animationDuration: '30s' }} />
      </motion.div>

      {/* Layer 6: Floating Geometric Objects */}
      <motion.div className="absolute inset-0" style={{ x: objectsX, y: objectsY }}>
        {geometricObjects.map((obj) => (
          <div
            key={`geo-${obj.id}`}
            className="absolute border border-brand-purple/30 animate-float mix-blend-screen"
            style={{
              left: `${obj.x}%`,
              top: `${obj.y}%`,
              width: `${obj.size}px`,
              height: `${obj.size}px`,
              opacity: obj.opacity,
              animationDuration: '15s',
              animationDelay: `-${Math.random() * 10}s`,
              borderRadius: obj.type === 'cube' ? '4px' : obj.type === 'hex' ? '50%' : '0', // approximate shapes
              clipPath: obj.type === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none'
            }}
          >
             <div 
               className="w-full h-full" 
               style={{ 
                 animation: `spin-slow ${obj.rotationSpeed}s linear infinite ${obj.direction === 1 ? 'normal' : 'reverse'}` 
               }} 
             />
          </div>
        ))}
      </motion.div>

      {/* Layer 3: Particles */}
      <div className="absolute inset-0">
        {particles.map((p) => (
          <div
            key={`particle-${p.id}`}
            className="absolute rounded-full bg-white animate-float"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animationDuration: `${p.duration}s`,
              animationDelay: `-${p.delay}s`,
              boxShadow: `0 0 ${p.size * 2}px rgba(255,255,255,0.8)`
            }}
          />
        ))}
      </div>

      {/* Layer 10: Mouse Spotlight Overlay */}
      <motion.div 
        className="absolute inset-0 mix-blend-screen z-10"
        style={{ background: spotlightStyle }}
      />
      
      {/* Dark vignette to focus center and darken edges */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-[#050816]/90 z-20 pointer-events-none" 
           style={{ background: 'radial-gradient(circle at center, transparent 30%, #050816 100%)' }}/>
    </div>
  );
};
