import React, { useState, useEffect } from 'react';

const Logo = ({ theme = 'dark', mode = 'sidebar' }) => {
  const [isTargetViewport, setIsTargetViewport] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsTargetViewport(width >= 350 && width <= 450);
    };

    handleResize(); // run on initial mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isSidebar = mode === 'sidebar';
  
  // Sidebar: 220px width, Login: 540px width
  const width = isSidebar ? 220 : 540;
  
  // Aspect ratio is 396/46 = ~8.6, height set proportionally
  const height = isSidebar ? 25 : 68;
  
  // Display light logo for the dark blue top nav in 350-450px range, otherwise fallback to theme defaults
  const logoSrc = isTargetViewport ? '/logo-light.png' : (theme === 'light' ? '/logo-dark.png' : '/logo-light.png');

  return (
    <img 
      src={logoSrc} 
      alt="Eazzio Telecaller" 
      style={{
        width: isSidebar ? `${width}px` : '100%',
        maxWidth: `${width}px`,
        height: 'auto',
        maxHeight: `${height}px`,
        aspectRatio: '396/46',
        display: 'inline-block',
        objectFit: 'contain',
      }}
    />
  );
};

export default Logo;

