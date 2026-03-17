import React, { useEffect, useRef, useState } from 'react';

export default function TitleAnnotation({
  infoData
}) {
  const title = infoData?.info_title || 'Digital Explorer';
  const description = infoData?.info_description || 'Explore 3D Models';
  const credits  = infoData?.info_credits || '<p>ART INSTITUTE OF CHICAGO</p>';

  useEffect(() => {

  });

  return (
    <div className='titleAnnotation' style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'fixed',
      top: '2vw',
      left: '2vw',
      maxWidth: '1100px',
      width: '100%',
      height: 'auto',
      padding: '2vw'
    }}>
      <div style={{
        width: '75px',
        height: '75px',
        color: 'red',
      }}
      >

      </div>
      <h2>{{title}}</h2>
      <p>{{description}}</p>
      <p>{{credits}}</p>
    </div>
  )
}