import React, { useState } from 'react';

export default function KennyBurns({ images = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleAnimationEnd = (e, index) => {
    if (images.length > 1 && index === currentIndex) {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }
  };

  if (!images || images.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: '#151515',
    }}>
      {images.map((src, index) => (
        <img
          key={index}
          src={src}
          alt=""
          aria-hidden="true"
          className={`kenny-burns-item ${index === currentIndex ? 'current' : ''}`}
          onAnimationEnd={(e) => handleAnimationEnd(e, index)}
        />
      ))}
      <style>{`
        @keyframes kenburns {
          from {
            transform: scale3d(1, 1, 1) translate3d(0, 0, 0);
          }
          to {
            transform: scale3d(1.05, 1.05, 1.05) translate3d(-4%, -2%, 0px);
          }
        }
        .kenny-burns-item {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
          opacity: 0;
          will-change: transform, opacity;
          transition: opacity 1s ease;
          transform: scale3d(1.05, 1.05, 1.05) translate3d(-4%, -2%, 0px);
          transform-origin: bottom left;
        }
        .kenny-burns-item.current {
          animation: kenburns 8s ease-out forwards;
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
