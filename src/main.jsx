import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import fontObservers from './lib/utils/fontObservers';

fontObservers({
  name: 'serif',
  variants: [
    { name: 'Sabon', weight: '400', style: 'normal' },
    { name: 'Sabon', weight: '400', style: 'italic' },
    { name: 'Sabon', weight: '500', style: 'normal' },
  ]
});

fontObservers({
  name: 'sans-serif',
  variants: [
    { name: 'Ideal Sans A', weight: '400', style: 'normal' },
    { name: 'Ideal Sans A', weight: '500', style: 'normal' },
    { name: 'Ideal Sans A', weight: '600', style: 'normal' },
    { name: 'Ideal Sans A', weight: '700', style: 'normal' },
    { name: 'Ideal Sans B', weight: '400', style: 'italic' },
  ]
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
