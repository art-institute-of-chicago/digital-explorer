import { useEffect, useRef } from 'react';
import closeIcon from '../assets/close-icon.svg';
import infoIcon from '../assets/info-icon.svg';

export default function InfoCard({ infoCardData, isToggled, setIsToggled, isVOModeActive }) {
  const toggleButtonRef = useRef(null);
  const cardRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  const stripHtml = (html) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isToggled) {
        setIsToggled(false);
        toggleButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isToggled, setIsToggled]);

  useEffect(() => {
    if (isToggled) {
      cardRef.current?.focus();

      if (isVOModeActive) {
        const titleText = stripHtml(infoCardData?.info_title || "Digital Explorer");
        const descText = stripHtml(infoCardData?.info_description || "");
        const fullText = `${titleText}. ${descText}`;

        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(fullText);
        utterance.rate = 0.9;
        synthRef.current.speak(utterance);
      }
    } else {
      toggleButtonRef.current?.focus();
      if (isVOModeActive) synthRef.current.cancel();
    }
    return () => synthRef.current.cancel();
  }, [isToggled, infoCardData, isVOModeActive]);

  const styles = {
    container: { position: 'absolute', top: '0', left: '0', zIndex: 2000, pointerEvents: 'none', width: '100%', height: '100%' },
    baseButton: { position: 'absolute', top: '35px', left: '35px', width: '50px', height: '50px', backgroundColor: '#f6f6f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', zIndex: 10000, pointerEvents: 'auto' },
    card: { position: 'absolute', top: '60px', left: '60px', backgroundColor: '#282829', color: 'white', maxWidth: '27.5%', minWidth: '450px', padding: '60px 50px', display: 'flex', flexDirection: 'column', pointerEvents: 'auto', textAlign: 'left', outline: 'none' },
    title: { fontFamily: "'Sabon Next LT Pro', serif", fontSize: '3rem', margin: 0, fontWeight: '400', lineHeight: '1.1' },
    description: { fontFamily: "'Sabon Next LT Pro', serif", fontSize: '1.4rem', lineHeight: '130%', marginTop: '1.5rem', opacity: '0.9' },
    metadata: { color: '#f6f6f6', marginTop: '4rem', fontFamily: '"Ideal Sans", "Helvetica Neue", Arial, sans-serif', fontSize: '1rem', fontWeight: '500', lineHeight: '130%' }
  };

  return (
    <div style={styles.container}>
      <button
        ref={toggleButtonRef}
        style={styles.baseButton}
        onClick={() => setIsToggled(!isToggled)}
        aria-expanded={isToggled}
        aria-controls="info-card-content"
        aria-label={isToggled ? "Close information" : "Open information"}
      >
        <img src={isToggled ? closeIcon : infoIcon} alt="" style={{ width: '100%' }} aria-hidden="true" />
      </button>

      {isToggled && (
        <section id="info-card-content" ref={cardRef} style={styles.card} tabIndex="-1" role="dialog" aria-labelledby="info-title">
          <div>
            <h2 id="info-title" style={styles.title} dangerouslySetInnerHTML={{ __html: infoCardData?.info_title || "Digital Explorer" }} />
            <div style={styles.description} dangerouslySetInnerHTML={{ __html: infoCardData?.info_description || "" }} />
          </div>
          <div style={styles.metadata} dangerouslySetInnerHTML={{ __html: infoCardData?.info_credits || `Art Institute of Chicago | ${new Date().getFullYear()}` }} />
        </section>
      )}
    </div>
  );
}