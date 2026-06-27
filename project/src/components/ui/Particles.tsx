import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  alpha: number;
}

const Particles: React.FC = () => {
  const particlesRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Particles animation
    const canvas = particlesRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    const setCanvasDimensions = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    setCanvasDimensions();
    window.addEventListener("resize", setCanvasDimensions);

    // Particle class
    class ParticleClass {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
      alpha: number;

      constructor() {
        const isLightMode = document.documentElement.classList.contains('light');
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.size = isLightMode ? Math.random() * 4 + 2 : Math.random() * 3 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.color = this.getRandomColor();
        this.alpha = isLightMode ? Math.random() * 0.8 + 0.2 : Math.random() * 0.6 + 0.4;
      }

      getRandomColor() {
        const isLightMode = document.documentElement.classList.contains('light');
        const colors = isLightMode ? [
          "rgba(59, 130, 246, 0.3)", // blue with lower opacity for light mode
          "rgba(236, 72, 153, 0.3)", // pink with lower opacity
          "rgba(34, 197, 94, 0.3)", // green with lower opacity
        ] : [
          "rgba(59, 130, 246, 1)", // blue
          "rgba(139, 92, 246, 1)", // purple
          "rgba(16, 185, 129, 1)", // green
        ];
        return colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas!.width || this.x < 0) {
          this.speedX = -this.speedX;
        }
        if (this.y > canvas!.height || this.y < 0) {
          this.speedY = -this.speedY;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha;
        ctx.fill();
      }
    }

    // Create particles
    const particles: ParticleClass[] = [];
    const particleCount = Math.min(
      100,
      Math.floor((window.innerWidth * window.innerHeight) / 10000)
    );

    for (let i = 0; i < particleCount; i++) {
      particles.push(new ParticleClass());
    }
    
    console.log(`Initialized ${particleCount} particles on canvas ${canvas.width}x${canvas.height}`);

    // Connect particles with lines
    function connectParticles() {
      if (!ctx) return;
      const maxDistance = 150;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99, 102, 241, ${
              0.4 * (1 - distance / maxDistance)
            })`;
            ctx.lineWidth = 1;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    }

    // Animation loop
    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const particle of particles) {
        particle.update();
        particle.draw();
      }

      connectParticles();
      requestAnimationFrame(animate);
    }

    animate();

    // Cleanup
    return () => {
      window.removeEventListener("resize", setCanvasDimensions);
    };
  }, []);

  return (
    <canvas
      ref={particlesRef}
      className="particles-bg-canvas-self"
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        zIndex: -1,
        top: '0px',
        left: '0px',
        pointerEvents: 'none'
      }}
    />
  );
};

export default Particles;