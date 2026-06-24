import React from 'react';

const Logo = ({ theme = 'dark', mode = 'sidebar' }) => {
  const isSidebar = mode === 'sidebar';
  
  // Sidebar: 200px width, Login: 480px width
  const width = isSidebar ? 200 : 480;
  
  // Aspect ratio is 396/46 = ~8.6, height set proportionally
  const height = isSidebar ? 23 : 56;
  
  const logoSrc = theme === 'dark' ? '/logo-dark.png' : '/logo-light.png';

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
